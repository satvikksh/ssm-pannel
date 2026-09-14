import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_URL: z.string().url().default("http://localhost:4000"),
  // Comma-separated list of additional browser origins allowed by CORS (e.g.
  // the frontend). In production the API only permits APP_URL + these.
  CORS_ORIGINS: z.string().optional(),
  // Required — MongoDB Atlas (or explicitly configured dev/test instance).
  // No localhost fallback: a missing/invalid URI fails startup loudly.
  MONGODB_URI: z.string().min(1),
  // Optional Super Admin bootstrap credentials (server-side only). When set,
  // `npm run seed -w @smm/api` (or the API bootstrap init) creates the account
  // if missing. NEVER required by the API itself; never exposed to frontends.
  // Must be configured for the seeding flow to run.
  SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SUPER_ADMIN_PASSWORD: z.string().min(8).optional(),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(32).default("change-me-to-a-long-random-string-32chars+"),
  // "expiresIn" durations passed to jsonwebtoken
  JWT_ACCESS_TTL: z.string().default("1d"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  // Encryption key for third-party credentials at rest (hex, 64 chars)
  ENCRYPTION_KEY: z.string().optional(),
  // License platform connectivity (customer installation -> license server)
  LICENSE_SERVER_URL: z.string().url().optional(),
  LICENSE_CLIENT_ID: z.string().optional(),
  LICENSE_CLIENT_SECRET: z.string().optional(),
  LICENSE_PUBLIC_KEY: z.string().optional(),
  LICENSE_DOMAIN: z.string().optional(),
  LICENSE_GRACE_SECONDS: z.coerce.number().int().default(86400),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_NAME: z.string().optional().default("SMM Panel"),
  SMTP_FROM_EMAIL: z.string().email().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().default(100),
});

export type AppEnv = z.infer<typeof envSchema>;

export class ConfigError extends Error {
  constructor(issues: string[]) {
    super(`Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join("\n")}`);
    this.name = "ConfigError";
  }
}

let cached: AppEnv | null = null;

export function loadConfig(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues.map((i) => i.message));
  }
  if (parsed.data.NODE_ENV === "production" && !process.env.JWT_SECRET) {
    throw new ConfigError(["JWT_SECRET is required in production"]);
  }
  cached = parsed.data;
  return cached;
}

export function resetConfigForTests(): void {
  cached = null;
}