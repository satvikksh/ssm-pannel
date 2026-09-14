import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { loadConfig } from "@smm/config";
import { ensureSuperAdmin } from "../../seed/super-admin";

/**
 * Runs on API startup and ensures the Super Admin account exists when
 * SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are configured. This is
 * idempotent: the password is never overwritten for an existing account.
 *
 * The explicit `npm run seed` command is still the primary mechanism; this
 * hook provides an additional safety net for deployments where the env vars
 * are present but the seed was never run.
 */
@Injectable()
export class SuperAdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SuperAdminBootstrapService.name);

  constructor(
    @InjectModel("User") private readonly userModel: Model<any>,
    @InjectModel("Wallet") private readonly walletModel: Model<any>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const config = loadConfig();
      if (!config.SUPER_ADMIN_EMAIL || !config.SUPER_ADMIN_PASSWORD) return;

      const result = await ensureSuperAdmin(
        { User: this.userModel, Wallet: this.walletModel },
        config,
      );

      if (result.action === "created") {
        this.logger.log(`Super Admin bootstrapped: ${result.email}`);
      } else if (result.action === "exists") {
        this.logger.log(`Super Admin already present: ${result.email}`);
      }
    } catch (error) {
      this.logger.warn(`Super Admin bootstrap skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
