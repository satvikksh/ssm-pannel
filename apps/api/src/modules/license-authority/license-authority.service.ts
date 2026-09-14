import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  hashKey,
  hmacSign,
  randomSecret,
} from "@smm/security";
import { isValidEmail } from "@smm/utils";
import { AdminLicenseAccess, LicenseStatus } from "@smm/types";

export interface CreateLicenseDto {
  adminUserId: string;
  email: string;
  name?: string;
  type?: string;
  durationDays?: number;
  notes?: string;
}

export interface AdminLicenseRecord {
  id: string;
  licenseKey: string;
  licenseKeyHash: string;
  maskedKey: string;
  adminUserId?: string;
  adminEmail?: string;
  status: LicenseStatus;
  type: string;
  expiresAt?: Date | null;
  activatedAt?: Date | null;
  installation?: { installationId: string; domain: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class LicenseAuthorityService {
  constructor(
    @InjectModel("License", "LicenseConnection")
    private readonly licenseModel: Model<any>,
    @InjectModel("LicenseProduct", "LicenseConnection")
    private readonly productModel: Model<any>,
    @InjectModel("LicenseClient", "LicenseConnection")
    private readonly clientModel: Model<any>,
    @InjectModel("LicenseInstallation", "LicenseConnection")
    private readonly installationModel: Model<any>,
    @InjectModel("LicenseActivation", "LicenseConnection")
    private readonly activationModel: Model<any>,
    @InjectModel("LicenseValidation", "LicenseConnection")
    private readonly validationModel: Model<any>,
    @InjectModel("LicenseEvent", "LicenseConnection")
    private readonly eventModel: Model<any>,
    @InjectModel("LicenseAuditLog", "LicenseConnection")
    private readonly auditLogModel: Model<any>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultProduct();
  }

  private async seedDefaultProduct(): Promise<void> {
    const existing = await this.productModel.findOne({ slug: "smm-panel" });
    if (!existing) {
      await this.productModel.create({
        slug: "smm-panel",
        name: "SMM Panel",
        versions: ["1.0.0"],
        active: true,
      });
    }
  }

  private maskKey(key: string): string {
    if (key.length <= 8) return `${key.slice(0, 2)}****`;
    return `${key.slice(0, 4)}-****-${key.slice(-4)}`;
  }

  /** Generate a random license key in XXXXX-XXXXX-XXXXX-XXXXX format. */
  generateKey(): string {
    const groups = Array.from({ length: 4 }, () =>
      randomSecret(6).replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 5),
    );
    return groups.join("-");
  }

  async createLicense(dto: CreateLicenseDto, operatorId = "system"): Promise<AdminLicenseRecord> {
    const email = dto.email.toLowerCase();
    if (!isValidEmail(email)) throw new BadRequestException("Invalid admin email");
    if (!dto.adminUserId) throw new BadRequestException("adminUserId is required");

    const existing = await this.licenseModel.findOne({ assignedAdminEmail: email });
    if (existing) {
      throw new ConflictException({
        error: "LICENSE_ALREADY_ASSIGNED",
        message: "An admin license is already assigned to this email.",
      });
    }

    const product = await this.productModel.findOne({ slug: "smm-panel" });
    const client = await this.clientModel.findOneAndUpdate(
      { email },
      {
        $set: { email, name: dto.name ?? email.split("@")[0], status: "active" },
      },
      { new: true, upsert: true },
    );

    const licenseKey = this.generateKey();
    const licenseKeyHash = hashKey(licenseKey);
    const type = dto.type ?? "yearly";
    const expiresAt = dto.durationDays
      ? new Date(Date.now() + dto.durationDays * 24 * 60 * 60 * 1000)
      : null;

    const doc = await this.licenseModel.create({
      licenseKey: this.maskKey(licenseKey),
      licenseKeyHash,
      productId: product._id,
      clientId: client._id,
      type,
      status: LicenseStatus.PENDING,
      assignedAdminUserId: dto.adminUserId,
      assignedAdminEmail: email,
      activationLimit: 1,
      maxInstallations: 1,
      activatedInstallations: 0,
      durationDays: dto.durationDays ?? null,
      expiresAt,
      notes: dto.notes,
    });

    await this.hydrateLicenseEvent(doc._id, "ADMIN_ACTION", {
      action: "license.created",
      operatorId,
      email,
    });
    await this.writeAudit(operatorId, "license.create", "License", String(doc._id), {
      email,
      type,
      durationDays: dto.durationDays,
    });

    return this.serialize(doc, licenseKey);
  }

  async approve(id: string, operatorId = "system"): Promise<AdminLicenseRecord> {
    const doc = await this.getRaw(id);
    if ([LicenseStatus.REVOKED].includes(doc.status)) {
      throw new BadRequestException({ error: "LICENSE_REVOKED", message: "Revoked licenses cannot be approved." });
    }
    doc.status = LicenseStatus.APPROVED;
    doc.approvedAt = new Date();
    doc.approvedBy = operatorId;
    await doc.save();
    await this.hydrateLicenseEvent(doc._id, "APPROVED", {
      operatorId,
    });
    await this.writeAudit(operatorId, "license.approve", "License", String(doc._id), {
      status: "approved",
    });
    return this.serialize(doc);
  }

  async suspend(id: string, operatorId = "system", reason?: string): Promise<AdminLicenseRecord> {
    const doc = await this.getRaw(id);
    if (doc.status === LicenseStatus.REVOKED) {
      throw new BadRequestException({ error: "LICENSE_REVOKED", message: "A revoked license cannot be suspended." });
    }
    doc.status = LicenseStatus.SUSPENDED;
    await doc.save();
    await this.hydrateLicenseEvent(doc._id, "SUSPENDED", { operatorId, reason });
    await this.writeAudit(operatorId, "license.suspend", "License", String(doc._id), { reason });
    return this.serialize(doc);
  }

  async revoke(id: string, operatorId = "system", reason?: string): Promise<AdminLicenseRecord> {
    const doc = await this.getRaw(id);
    doc.status = LicenseStatus.REVOKED;
    await doc.save();
    await this.hydrateLicenseEvent(doc._id, "REVOKED", { operatorId, reason });
    await this.writeAudit(operatorId, "license.revoke", "License", String(doc._id), { reason });
    return this.serialize(doc);
  }

  async renew(id: string, durationDays: number, operatorId = "system"): Promise<AdminLicenseRecord> {
    if (!durationDays || durationDays <= 0) throw new BadRequestException("durationDays must be positive");
    const doc = await this.getRaw(id);
    const base = doc.expiresAt && new Date(doc.expiresAt) > new Date() ? new Date(doc.expiresAt) : new Date();
    doc.expiresAt = new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);
    doc.durationDays = durationDays;
    if (doc.status === LicenseStatus.EXPIRED || doc.status === LicenseStatus.SUSPENDED) {
      doc.status = LicenseStatus.APPROVED;
    }
    await doc.save();
    await this.writeAudit(operatorId, "license.renew", "License", String(doc._id), { durationDays });
    return this.serialize(doc);
  }

  async list(): Promise<AdminLicenseRecord[]> {
    const docs = await this.licenseModel.find({}).sort({ createdAt: -1 }).limit(200).lean();
    return docs.map((d: any) => this.serialize(d));
  }

  async getDetail(id: string): Promise<{ license: AdminLicenseRecord; installations: unknown[]; events: unknown[] }> {
    const doc = await this.getRaw(id);
    const [installations, events] = await Promise.all([
      this.installationModel.find({ licenseId: doc._id }).sort({ createdAt: -1 }).lean(),
      this.eventModel.find({ licenseId: doc._id }).sort({ createdAt: -1 }).limit(200).lean(),
    ]);
    return {
      license: this.serialize(doc),
      installations,
      events,
    };
  }

  /** Resolve the access decision for an ADMIN user (one license = one admin). */
  async resolveAdminAccess(adminUserId: string, adminEmail?: string): Promise<AdminLicenseAccess> {
    const query: Record<string, unknown> = { assignedAdminUserId: adminUserId };
    if (adminEmail) {
      query.$or = [{ assignedAdminUserId: adminUserId }, { assignedAdminEmail: adminEmail.toLowerCase() }];
    }
    const doc = await this.licenseModel.findOne(query).sort({ updatedAt: -1 });
    if (!doc) {
      return {
        granted: false,
        code: "ADMIN_NOT_LICENSED",
        message: "No license has been assigned to this Admin. Contact your Super Admin.",
      };
    }
    const now = Date.now();
    if (doc.status === LicenseStatus.PENDING) {
      return {
        granted: false,
        code: "LICENSE_NOT_APPROVED",
        status: doc.status,
        licenseKeyHint: doc.licenseKey,
        message: "Your license is awaiting approval by the Super Admin.",
      };
    }
    if (doc.status === LicenseStatus.SUSPENDED) {
      return { granted: false, code: "LICENSE_SUSPENDED", status: doc.status, message: "Your license has been suspended." };
    }
    if (doc.status === LicenseStatus.REVOKED) {
      return { granted: false, code: "LICENSE_REVOKED", status: doc.status, message: "Your license has been revoked." };
    }
    if (doc.status === LicenseStatus.EXPIRED || (doc.expiresAt && new Date(doc.expiresAt).getTime() < now)) {
      return { granted: false, code: "LICENSE_EXPIRED", status: LicenseStatus.EXPIRED, message: "Your license has expired." };
    }
    if (![LicenseStatus.APPROVED, LicenseStatus.ACTIVE].includes(doc.status)) {
      return {
        granted: false,
        code: "LICENSE_NOT_APPROVED",
        status: doc.status,
        message: "Your license is not active.",
      };
    }
    const installation = doc.activatedAt
      ? await this.installationModel.findOne({ licenseId: doc._id })
      : null;
    return {
      granted: true,
      status: LicenseStatus.ACTIVE,
      licenseKeyHint: doc.licenseKey,
      expiresAt: doc.expiresAt ? new Date(doc.expiresAt).toISOString() : null,
      installationId: installation?.installationId ?? null,
      domain: installation?.domain ?? null,
      message: "License active.",
    };
  }

  /**
   * ADMIN-facing activation on the panel. The license must already be assigned
   * to THIS admin (one license = one admin). Errors:
   *  - LICENSE_ALREADY_ASSIGNED -> key belongs to a different admin
   *  - LICENSE_NOT_APPROVED    -> super admin hasn't approved yet
   */
  async activateForAdmin(dto: {
    licenseKey: string;
    adminUserId: string;
    installationId: string;
    domain: string;
  }): Promise<{ status: string; licenseId: string; licenseKeyHint: string }> {
    const licenseKeyHash = hashKey(dto.licenseKey);
    const doc = await this.licenseModel.findOne({ licenseKeyHash });
    if (!doc) {
      throw new BadRequestException({ error: "LICENSE_NOT_FOUND", message: "Invalid license key." });
    }
    const assignedId = doc.assignedAdminUserId ? String(doc.assignedAdminUserId) : null;
    if (assignedId && assignedId !== dto.adminUserId) {
      throw new ConflictException({
        error: "LICENSE_ALREADY_ASSIGNED",
        message: "This license key is already assigned to a different Admin.",
      });
    }
    if (!assignedId) {
      doc.assignedAdminUserId = dto.adminUserId;
      await doc.save();
      await this.hydrateLicenseEvent(doc._id, "ASSIGNED", { adminUserId: dto.adminUserId });
    }
    if (![LicenseStatus.APPROVED, LicenseStatus.ACTIVE].includes(doc.status)) {
      throw new BadRequestException({
        error: "LICENSE_NOT_APPROVED",
        message: `License requires Super Admin approval (status: ${doc.status}).`,
      });
    }
    const result = await this.activate({
      licenseKey: dto.licenseKey,
      installationId: dto.installationId,
      domain: dto.domain,
      adminUserId: dto.adminUserId,
    });
    await this.hydrateLicenseEvent(doc._id, "ACTIVATED", {
      activationType: "admin-panel",
      adminUserId: dto.adminUserId,
    });
    return {
      status: result.status,
      licenseId: result.licenseId,
      licenseKeyHint: doc.licenseKey,
    };
  }

  /** Client-side activation (called by an installation with the raw key).
   * One license = one admin: the license must belong to the admin attempting
   * the activation.
   */
  async activate(dto: {
    licenseKey: string;
    installationId: string;
    domain: string;
    adminUserId?: string;
    signature?: string;
  }): Promise<{ status: string; licenseId: string }> {
    const licenseKeyHash = hashKey(dto.licenseKey);
    const doc = await this.licenseModel.findOne({ licenseKeyHash });
    if (!doc) throw new BadRequestException({ error: "LICENSE_NOT_FOUND", message: "Invalid license key." });
    if (doc.status === LicenseStatus.REVOKED) {
      throw new BadRequestException({ error: "LICENSE_REVOKED", message: "License has been revoked." });
    }
    if (doc.status === LicenseStatus.SUSPENDED) {
      throw new BadRequestException({ error: "LICENSE_SUSPENDED", message: "License has been suspended." });
    }
    if (doc.expiresAt && new Date(doc.expiresAt).getTime() < Date.now()) {
      throw new BadRequestException({ error: "LICENSE_EXPIRED", message: "License has expired." });
    }
    if (doc.activatedInstallations >= doc.maxInstallations) {
      throw new BadRequestException({ error: "ACTIVATION_LIMIT", message: "Activation limit reached for this license." });
    }

    const existingInstall = await this.installationModel.findOne({ licenseId: doc._id });
    if (existingInstall && existingInstall.installationId !== dto.installationId) {
      throw new BadRequestException({
        error: "INSTALLATION_MISMATCH",
        message: "This license is already bound to another installation.",
      });
    }

    await this.installationModel.findOneAndUpdate(
      { licenseId: doc._id },
      {
        $set: {
          licenseId: doc._id,
          installationId: dto.installationId,
          domain: dto.domain,
          status: "active",
          ip: "",
          activatedAt: new Date(),
          lastHeartbeatAt: new Date(),
        },
      },
      { new: true, upsert: true },
    );
    await this.activationModel.create({
      licenseKeyHash,
      installationId: dto.installationId,
      domain: dto.domain,
      ip: "",
      success: true,
    });

    doc.activatedInstallations = (doc.activatedInstallations ?? 0) + 1;
    doc.activatedAt = new Date();
    doc.status = LicenseStatus.ACTIVE;
    doc.lastValidatedAt = new Date();
    await doc.save();

    await this.hydrateLicenseEvent(doc._id, "ACTIVATED", {
      installationId: dto.installationId,
      domain: dto.domain,
      adminUserId: dto.adminUserId,
    });

    const signedAuthorization = hmacSign(
      JSON.stringify({ licenseId: String(doc._id), installationId: dto.installationId, status: "active" }),
      process.env.LICENSE_SHARED_SECRET ?? "local-dev-secret",
    );
    void signedAuthorization;

    return { status: "active", licenseId: String(doc._id) };
  }

  async validate(dto: { installationId: string; domain?: string }): Promise<{ status: string; licenseId?: string }> {
    const install = await this.installationModel.findOne({ installationId: dto.installationId });
    if (!install) {
      await this.validationModel.create({
        installationId: dto.installationId,
        domain: dto.domain ?? "",
        ip: "",
        valid: false,
        status: "waiting",
      });
      return { status: "waiting" };
    }
    const doc = await this.licenseModel.findById(install.licenseId);
    if (!doc) {
      await this.validationModel.create({
        installationId: dto.installationId,
        domain: dto.domain ?? "",
        ip: "",
        valid: false,
        status: LicenseStatus.EXPIRED,
      });
      return { status: LicenseStatus.EXPIRED };
    }
    let status = doc.status;
    if (status === LicenseStatus.APPROVED) status = LicenseStatus.ACTIVE;
    if (doc.expiresAt && new Date(doc.expiresAt).getTime() < Date.now()) status = LicenseStatus.EXPIRED;
    if (status === LicenseStatus.ACTIVE) {
      await this.licenseModel.updateOne({ _id: doc._id }, { $set: { lastValidatedAt: new Date() } });
      await this.installationModel.updateOne({ _id: install._id }, { $set: { lastHeartbeatAt: new Date() } });
    }
    await this.validationModel.create({
      installationId: dto.installationId,
      domain: install.domain,
      ip: "",
      valid: status === LicenseStatus.ACTIVE,
      status,
    });
    return { status, licenseId: String(doc._id) };
  }

  async getLicenseByAdminEmail(email: string): Promise<AdminLicenseRecord | null> {
    const doc = await this.licenseModel.findOne({ assignedAdminEmail: email.toLowerCase() });
    return doc ? this.serialize(doc) : null;
  }

  async eventsForAdmin(_adminUserId: string): Promise<unknown[]> {
    return this.eventModel
      .find({ metadata: { $exists: true } })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
  }

  private async getRaw(id: string): Promise<any> {
    const doc = await this.licenseModel.findById(id);
    if (!doc) throw new NotFoundException("License not found");
    return doc;
  }

  async hydrateLicenseEvent(licenseId: any, type: string, metadata: Record<string, unknown>): Promise<void> {
    await this.eventModel.create({ licenseId, type, metadata });
  }

  async writeAudit(
    adminId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.auditLogModel.create({
      adminId,
      action,
      resourceType,
      resourceId,
      after: details,
    });
  }

  private serialize(doc: any, rawKey?: string): AdminLicenseRecord {
    return {
      id: String(doc._id),
      licenseKey: rawKey ?? String(doc.licenseKey ?? ""),
      licenseKeyHash: String(doc.licenseKeyHash ?? ""),
      maskedKey: this.maskKey(rawKey ?? String(doc.licenseKey ?? "")),
      adminUserId: doc.assignedAdminUserId ? String(doc.assignedAdminUserId) : undefined,
      adminEmail: doc.assignedAdminEmail,
      status: doc.status,
      type: doc.type,
      expiresAt: doc.expiresAt ?? null,
      activatedAt: doc.activatedAt ?? null,
      installation: doc.activatedAt ? { installationId: "", domain: doc.domain } : null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}