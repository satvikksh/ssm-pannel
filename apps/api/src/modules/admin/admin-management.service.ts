import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { hashPassword } from "@smm/security";
import { publicId } from "@smm/utils";
import { ADMIN_ROLES, UserRole } from "@smm/types";
import { CreateAdminDto, UpdateAdminDto } from "./dto/admin-management.dto";

@Injectable()
export class AdminManagementService {
  constructor(
    @InjectModel("User") private readonly userModel: Model<any>,
    @InjectModel("Wallet") private readonly walletModel: Model<any>,
  ) {}

  async create(dto: CreateAdminDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.userModel.findOne({
      $or: [{ email }, { username: email.split("@")[0] }],
    });
    if (existing) {
      throw new BadRequestException(
        existing.email?.toLowerCase() === email
          ? "An account with this email already exists."
          : "This username is already taken.",
      );
    }

    const role = dto.role ?? UserRole.ADMIN;
    const passwordHash = await hashPassword(dto.password);
    const user = await this.userModel.create({
      email,
      username: email.split("@")[0]?.toLowerCase() || "admin",
      passwordHash,
      name: dto.name ?? "Admin",
      status: dto.status ?? "active",
      role,
      permissions: dto.permissions ?? [],
      tokenVersion: 0,
      referralCode: publicId("ADM").replace("ADM-", "").slice(0, 8).toUpperCase(),
      flags: { emailVerified: true, twoFactorEnabled: false, apiAccess: false },
      failedLoginAttempts: 0,
    });

    await this.walletModel.create({
      userId: user._id,
      balance: 0,
      pendingBalance: 0,
      currency: "INR",
    });

    return this.getById(String(user._id));
  }

  async list(page = 1, pageSize = 50, search?: string, status?: string) {
    const query: Record<string, unknown> = {
      role: { $in: [...ADMIN_ROLES] },
    };
    if (search) query.$or = [{ email: { $regex: search, $options: "i" } }, { name: { $regex: search, $options: "i" } }];
    if (status) query.status = status;

    const [itemsRaw, total] = await Promise.all([
      this.userModel
        .find(query)
        .select("-passwordHash")
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean() as Promise<any[]>,
      this.userModel.countDocuments(query),
    ]);

    return {
      items: itemsRaw.map((u) => ({
        ...u,
        _id: String(u._id),
      })),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async getById(id: string) {
    const userRaw = (await this.userModel
      .findById(id)
      .select("-passwordHash")
      .lean()) as any;
    if (!userRaw) throw new NotFoundException("Admin not found");
    return { ...userRaw, _id: String(userRaw._id) };
  }

  async update(id: string, dto: UpdateAdminDto) {
    const target = await this.userModel.findById(id);
    if (!target) throw new NotFoundException("Admin not found");
    if (target.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException(
        "Super Admin accounts cannot be edited through Admin Management.",
      );
    }

    const set: Record<string, unknown> = {};
    if (dto.name !== undefined) set.name = dto.name;
    if (dto.role !== undefined) set.role = dto.role;
    if (dto.status !== undefined) set.status = dto.status;
    if (dto.permissions !== undefined) set.permissions = dto.permissions;

    const updated = (await this.userModel
      .findByIdAndUpdate(id, { $set: set }, { new: true })
      .select("-passwordHash")
      .lean()) as any;
    return { ...updated, _id: String(updated._id) };
  }

  async resetPassword(id: string, password: string) {
    const target = await this.userModel.findById(id);
    if (!target) throw new NotFoundException("Admin not found");
    target.passwordHash = await hashPassword(password);
    // Revokes every previously issued session.
    target.tokenVersion = (target.tokenVersion ?? 0) + 1;
    target.passwordChangedAt = new Date();
    await target.save();
    return { ok: true };
  }

  async revokeSessions(id: string) {
    const target = await this.userModel.findById(id);
    if (!target) throw new NotFoundException("Admin not found");
    target.tokenVersion = (target.tokenVersion ?? 0) + 1;
    await target.save();
    return { ok: true };
  }
}