import type { Model } from "mongoose";
import { hashPassword } from "@smm/security";
import { UserRole } from "@smm/types";
import { publicId, randomCode } from "@smm/utils";
import type { AppEnv } from "@smm/config";

export interface EnsureSuperAdminModels {
  User: Model<any>;
  Wallet: Model<any>;
}

export interface EnsureSuperAdminOptions {
  resetPassword?: boolean;
}

export interface EnsureSuperAdminResult {
  email: string;
  action: "created" | "exists" | "password_updated" | "skipped_no_credentials";
  passwordChanged: boolean;
}

/**
 * Idempotent Super Admin bootstrap.
 *
 * - If the account for `SUPER_ADMIN_EMAIL` does NOT exist, it is created with
 *   the highest role (`super_admin`), `status: active`, a bcrypt-hashed
 *   password from `SUPER_ADMIN_PASSWORD` and a wallet.
 * - If it DOES exist, the password is left untouched by default. The account
 *   role/status are only repaired if they drifted (this is not a credential
 *   reset). Pass `{ resetPassword: true }` to explicitly overwrite the
 *   password to the env value (used by `npm run seed -- --reset-password`).
 * - The plaintext password is never logged or returned.
 */
export async function ensureSuperAdmin(
  { User, Wallet }: EnsureSuperAdminModels,
  config: AppEnv,
  options: EnsureSuperAdminOptions = {},
): Promise<EnsureSuperAdminResult> {
  const email = config.SUPER_ADMIN_EMAIL;
  const password = config.SUPER_ADMIN_PASSWORD;
  if (!email || !password) {
    return { email: "", action: "skipped_no_credentials", passwordChanged: false };
  }

  const normalizedEmail = email.toLowerCase().trim();

  const existing = await User.findOne({ email: normalizedEmail });

  if (existing) {
    if (options.resetPassword) {
      const passwordHash = await hashPassword(password);
      await User.updateOne(
        { _id: existing._id },
        { $set: { passwordHash, passwordChangedAt: new Date(), status: "active" } },
      );
      return { email: normalizedEmail, action: "password_updated", passwordChanged: true };
    }

    const updates: Record<string, unknown> = {};
    if (existing.role !== UserRole.SUPER_ADMIN) updates.role = UserRole.SUPER_ADMIN;
    if (existing.status !== "active") updates.status = "active";
    if (existing.flags?.emailVerified !== true) updates["flags.emailVerified"] = true;
    if (Object.keys(updates).length > 0) {
      await User.updateOne({ _id: existing._id }, { $set: updates });
    }
    return { email: normalizedEmail, action: "exists", passwordChanged: false };
  }

  const username = await availableUsername(User, normalizedEmail);
  const passwordHash = await hashPassword(password);

  const user = await User.create({
    email: normalizedEmail,
    username,
    passwordHash,
    name: "Super Admin",
    status: "active",
    role: UserRole.SUPER_ADMIN,
    flags: { emailVerified: true, twoFactorEnabled: false, apiAccess: true },
    referralCode: publicId("REF").replace("REF-", "").slice(0, 8).toUpperCase(),
    failedLoginAttempts: 0,
  });

  await Wallet.create({
    userId: user._id,
    balance: 0,
    pendingBalance: 0,
    currency: "INR",
  });

  return { email: normalizedEmail, action: "created", passwordChanged: false };
}

async function availableUsername(User: Model<any>, email: string): Promise<string> {
  const base =
    (email.split("@")[0] || "superadmin").toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 16) ||
    "superadmin";
  const free = await User.findOne({ username: base });
  if (!free) return base;
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}_${randomCode(6).toLowerCase()}`;
    const found = await User.findOne({ username: candidate });
    if (!found) return candidate;
  }
  return `${base}_${Date.now().toString(36)}`.slice(0, 30);
}