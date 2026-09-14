import "reflect-metadata";
import { connectMongo, userSchema, walletSchema, CUSTOMER_DB_NAME } from "@smm/database";
import { loadConfig, ConfigError } from "@smm/config";
import { loadDotEnvIfPresent } from "../src/env";
import { ensureSuperAdmin } from "../src/seed/super-admin";

/**
 * Super Admin seed command.
 *
 * Usage:
 *   npm run seed -w @smm/api                         # create Super Admin if missing
 *   npm run seed -w @smm/api -- --reset-password     # force password sync (explicit)
 *
 * Reads SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD from the API env. Creates the
 * account (role super_admin, active, hashed password, wallet) only when it does
 * not exist. Never prints credentials. Idempotent.
 */
async function main(): Promise<void> {
  loadDotEnvIfPresent();

  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(
      error instanceof ConfigError
        ? error.message
        : "Failed to load configuration. " + String(error),
    );
    process.exit(1);
  }

  if (!config.SUPER_ADMIN_EMAIL || !config.SUPER_ADMIN_PASSWORD) {
    console.error(
      "SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required for seeding. Add them to apps/api/.env",
    );
    process.exit(1);
  }

  const resetPassword = process.argv.includes("--reset-password");
  if (resetPassword) {
    console.log("--reset-password set: Super Admin password will be explicitly synchronized.");
  }

  const conn = await connectMongo({ uri: config.MONGODB_URI, dbName: CUSTOMER_DB_NAME });
  try {
    const User = conn.models.User ?? conn.model("User", userSchema, "users");
    const Wallet = conn.models.Wallet ?? conn.model("Wallet", walletSchema, "wallets");

    const result = await ensureSuperAdmin({ User, Wallet }, config, { resetPassword });

    switch (result.action) {
      case "created":
        console.log(`Super Admin created: ${result.email}`);
        break;
      case "exists":
        console.log(`Super Admin already exists: ${result.email} — password unchanged.`);
        break;
      case "password_updated":
        console.log(`Super Admin password updated: ${result.email}`);
        break;
      case "skipped_no_credentials":
        console.log("Super Admin seeding skipped (credentials not configured).");
        break;
    }
    console.log("Seed finished successfully.");
  } catch (error) {
    console.error("Seed failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await conn.close();
  }
}

void main();