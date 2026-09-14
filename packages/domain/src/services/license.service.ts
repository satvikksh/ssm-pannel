import {
  BadGatewayException,
  Injectable,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Queue } from "bullmq";
import { Inject } from "@nestjs/common";
import { createLogger } from "@smm/logger";
import { hmacSign } from "@smm/security";
import { LicenseStatus } from "@smm/types";
import { QueueName, QueueTokens } from "@smm/queue";

export interface LicenseValidationResult {
  ok: boolean;
  status: string;
  reason?: string;
  signedAuthorization?: string;
  expiresAt?: Date;
  graceUntil?: Date;
}

@Injectable()
export class LicenseService implements OnApplicationBootstrap {
  private readonly logger = createLogger({ name: "license-client" });
  private readonly serverUrl = process.env.LICENSE_SERVER_URL ?? "";
  private readonly sharedSecret = process.env.LICENSE_SHARED_SECRET ?? "";
  private readonly installationId = process.env.INSTALLATION_ID ?? "";

  constructor(
    @InjectModel("LicenseState") private readonly licenseModel: Model<any>,
    @Inject(QueueTokens[QueueName.LICENSE]) private readonly licenseQueue: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.serverUrl || !this.installationId) {
      this.logger.warn("License server not configured; running without remote validation", {
        requestId: "license",
      });
      return;
    }
    try {
      await this.validate();
      await this.enqueueHeartbeat();
    } catch (error) {
      this.logger.error(`License validation failed at startup (grace). ${String(error)}`, {
        requestId: "license",
      });
    }
  }

  async getInstallation(): Promise<string> {
    return this.installationId || "dev-installation";
  }

  /** Current cached state. Never throws when unlicensed; returns status. */
  async getState() {
    const state = (await this.licenseModel.findOne({
      installationId: this.installationId || "dev-installation",
    }).lean()) as any;
    if (!state) {
      return { installationId: this.installationId, status: LicenseStatus.WAITING, expiresAt: null, graceUntil: null };
    }
    return state;
  }

  /** Force a validation round-trip to the central license server. */
  async validate(): Promise<LicenseValidationResult> {
    const installationId = this.installationId || "dev-installation";
    if (!this.serverUrl) {
      return { ok: true, status: LicenseStatus.ACTIVE, reason: "license server disabled" };
    }

    const payload = { installationId, domain: process.env.APP_URL ?? "" };
    const signature = hmacSign(JSON.stringify(payload), this.sharedSecret);
    let res: Response;
    try {
      res = await fetch(`${this.serverUrl}/api/v1/licenses/validate`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-license-signature": signature },
        body: JSON.stringify(payload),
        signal: this.timeoutSignal(8000),
      });
    } catch (error) {
      return this.handleUnreachable();
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: false, status: String(body?.status ?? LicenseStatus.SUSPENDED), reason: String(body?.error ?? "license invalid") };
    }

    const result = (await res.json()) as {
      status: string;
      expiresAt?: string;
      graceUntil?: string;
      signedAuthorization?: string;
    };
    const nextAt = new Date(Date.now() + this.validationIntervalMs(result.status));

    await this.licenseModel.findOneAndUpdate(
      { installationId },
      {
        $set: {
          installationId,
          domain: process.env.APP_URL,
          status: result.status,
          expiresAt: result.expiresAt ? new Date(result.expiresAt) : undefined,
          graceUntil: result.graceUntil ? new Date(result.graceUntil) : undefined,
          signedAuthorization: result.signedAuthorization,
          lastValidatedAt: new Date(),
          nextValidationAt: nextAt,
          version: process.env.APP_VERSION ?? "1.0.0",
        },
      },
      { upsert: true },
    );

    return { ok: result.status === LicenseStatus.ACTIVE, status: result.status, signedAuthorization: result.signedAuthorization };
  }

  /** Cached-state check used by the license guard (no network). */
  async isLicensed(): Promise<{ licensed: boolean; status: string }> {
    if (!this.serverUrl) return { licensed: true, status: LicenseStatus.ACTIVE };
    const state = await this.getState();
    const now = Date.now();
    const graceMs = 72 * 60 * 60 * 1000;
    const exceedsGrace = state.lastValidatedAt && now - new Date(state.lastValidatedAt).getTime() > graceMs;

    if (exceedsGrace) return { licensed: false, status: LicenseStatus.EXPIRED };
    return { licensed: ['active', 'trial'].includes(state.status), status: state.status };
  }

  async enqueueHeartbeat(): Promise<void> {
    await this.licenseQueue.add(
      "license-heartbeat",
      { installationId: this.installationId || "dev-installation", at: new Date() },
      { jobId: `license-heartbeat-${Date.now()}`, attempts: 5, backoff: { type: "exponential", delay: 60_000 } },
    );
  }

  async setActivation(dto: { licenseKey: string; domain: string }): Promise<void> {
    const installationId = this.installationId || "dev-installation";
    if (!this.serverUrl) throw new BadGatewayException("License server not configured");

    const payload = { installationId, licenseKey: dto.licenseKey, domain: dto.domain };
    const signature = hmacSign(JSON.stringify(payload), this.sharedSecret);
    const res = await fetch(`${this.serverUrl}/api/v1/licenses/activate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-license-signature": signature },
      body: JSON.stringify(payload),
      signal: this.timeoutSignal(8000),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      throw new BadGatewayException(String(body?.error ?? "Activation failed"));
    }
    const result = (await res.json()) as { status: string; expiresAt?: string; signedAuthorization?: string; licenseId?: string };
    await this.licenseModel.findOneAndUpdate(
      { installationId },
      {
        $set: {
          installationId,
          domain: dto.domain,
          status: result.status ?? LicenseStatus.ACTIVE,
          licenseKeyHint: dto.licenseKey.slice(0, 4) + "****" + dto.licenseKey.slice(-4),
          licenseId: result.licenseId,
          expiresAt: result.expiresAt ? new Date(result.expiresAt) : undefined,
          signedAuthorization: result.signedAuthorization,
          activatedAt: new Date(),
          lastValidatedAt: new Date(),
          nextValidationAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
          version: process.env.APP_VERSION ?? "1.0.0",
        },
      },
      { upsert: true },
    );
  }

  /**
   * Mirrors a successful authority activation into the local cache WITHOUT a
   * round-trip to a remote license server (used when the authority is hosted
   * in-process on the same API — dev/local standalone).
   */
  async mirrorActivation(dto: { licenseKey: string; domain: string; licenseId?: string }): Promise<void> {
    const installationId = this.installationId || "dev-installation";
    await this.licenseModel.findOneAndUpdate(
      { installationId },
      {
        $set: {
          installationId,
          domain: dto.domain,
          status: LicenseStatus.ACTIVE,
          licenseKeyHint: dto.licenseKey.slice(0, 4) + "****" + dto.licenseKey.slice(-4),
          licenseId: dto.licenseId,
          activatedAt: new Date(),
          lastValidatedAt: new Date(),
          nextValidationAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          version: process.env.APP_VERSION ?? "1.0.0",
        },
      },
      { upsert: true },
    );
  }

  async resetLocalState(): Promise<void> {
    await this.licenseModel.deleteMany({ installationId: this.installationId || "dev-installation" });
  }

  private timeoutSignal(ms: number): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  }

  private validationIntervalMs(status: string): number {
    if (status === LicenseStatus.TRIAL) return 6 * 60 * 60 * 1000;
    return 24 * 60 * 60 * 1000;
  }

  private async handleUnreachable(): Promise<LicenseValidationResult> {
    const state = await this.getState();
    const withinGrace =
      state?.lastValidatedAt && Date.now() - new Date(state.lastValidatedAt).getTime() < 72 * 60 * 60 * 1000;
    if (withinGrace && state?.status === LicenseStatus.ACTIVE) {
      return { ok: true, status: LicenseStatus.ACTIVE, reason: "offline grace period" };
    }
    return { ok: false, status: LicenseStatus.EXPIRED, reason: "license server unreachable" };
  }
}