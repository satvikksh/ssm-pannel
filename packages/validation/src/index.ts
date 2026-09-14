import { z } from "zod";
import { isValidObjectId } from "@smm/utils";

export const objectIdSchema = z
  .string()
  .refine(isValidObjectId, { message: "Invalid object id" });

export const emailSchema = z.string().email().max(254).transform((v) => v.toLowerCase());

export const passwordSchema = z.string().min(8).max(128);

export const usernameSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9_.]+$/i, "Username can only contain letters, numbers, underscore, dot");

export const linkSchema = z.string().url().max(2048);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(120).optional(),
  sortBy: z.string().max(40).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  name: z.string().max(80).optional(),
  referralCode: z.string().max(30).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(16).max(256),
  newPassword: passwordSchema,
});

export const createOrderSchema = z.object({
  serviceId: objectIdSchema,
  link: linkSchema,
  quantity: z.coerce.number().int().min(1).max(10_000_000),
  couponCode: z.string().max(40).optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export const createMassOrderSchema = z.object({
  orders: z.array(createOrderSchema).min(1).max(100),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export const createRefillSchema = z.object({
  orderId: objectIdSchema,
});

export const cancelOrderSchema = z.object({
  orderId: objectIdSchema,
});

export const createDripFeedSchema = z.object({
  serviceId: objectIdSchema,
  link: linkSchema,
  totalQuantity: z.coerce.number().int().min(1).max(10_000_000),
  quantityPerRun: z.coerce.number().int().min(1).max(1_000_000),
  intervalMinutes: z.coerce.number().int().min(5).max(60 * 24 * 90),
  startAt: z.coerce.date().optional(),
});

export const createSubscriptionSchema = z.object({
  serviceId: objectIdSchema,
  link: linkSchema,
  quantity: z.coerce.number().int().min(1).max(1_000_000),
  intervalDays: z.coerce.number().int().min(1).max(365),
});

export const createDepositSchema = z.object({
  amount: z.coerce.number().positive().max(1_000_000),
  gateway: z.enum(["razorpay", "stripe", "paypal", "manual", "upi"]),
  paymentMethod: z.string().max(40).optional(),
});

export const createManualPaymentSchema = z.object({
  amount: z.coerce.number().positive().max(1_000_000),
  gateway: z.enum(["manual", "upi"]),
  transactionRef: z.string().min(4).max(128),
  notes: z.string().max(500).optional(),
});

export const createApiKeySchema = z.object({
  name: z.string().min(2).max(60),
  permissions: z.array(z.string()).default([]),
  ipRestrictions: z.array(z.string().ip()).max(10).default([]),
});

export const createTicketSchema = z.object({
  subject: z.string().min(3).max(160),
  category: z.string().min(2).max(60),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  message: z.string().min(3).max(5000),
});

export const replyTicketSchema = z.object({
  message: z.string().min(1).max(5000),
});

export const createCouponSchema = z.object({
  code: z.string().min(3).max(40),
  type: z.enum(["fixed", "percentage"]),
  value: z.coerce.number().positive(),
  minimumAmount: z.coerce.number().nonnegative().optional(),
  maximumDiscount: z.coerce.number().nonnegative().optional(),
  perUserLimit: z.coerce.number().int().min(1).default(1),
  usageLimit: z.coerce.number().int().min(1).default(1),
  expiresAt: z.coerce.date().optional(),
});

export const createProviderSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
  adapter: z.string().min(2).max(60),
  baseUrl: z.string().url(),
  apiKey: z.string().min(4).optional(),
  apiSecret: z.string().min(4).optional(),
});

export const createServiceSchema = z.object({
  name: z.string().min(2).max(160),
  categoryId: objectIdSchema,
  providerId: objectIdSchema,
  providerServiceId: z.string().min(1).max(120),
  providerCost: z.coerce.number().nonnegative(),
  customerPrice: z.coerce.number().positive(),
  resellerPrice: z.coerce.number().positive().optional(),
  minimum: z.coerce.number().int().min(1).default(1),
  maximum: z.coerce.number().int().min(1).default(1_000_000),
  refillSupported: z.boolean().default(false),
  cancelSupported: z.boolean().default(false),
  dripFeedSupported: z.boolean().default(false),
  subscriptionSupported: z.boolean().default(false),
  status: z.enum(["active", "inactive", "disabled"]).default("active"),
});

export const adminAdjustBalanceSchema = z.object({
  userId: objectIdSchema,
  amount: z.coerce.number().nonnegative(),
  type: z.enum(["manual_credit", "manual_debit", "bonus", "adjustment", "chargeback"]),
  description: z.string().max(500).optional(),
  reason: z.string().max(500).optional(),
});

export const applyCouponSchema = z.object({
  code: z.string().min(3).max(40),
  amount: z.coerce.number().positive(),
  serviceIds: z.array(objectIdSchema).optional(),
});

// ---- License platform DTOs ----
export const licenseActivateSchema = z.object({
  licenseKey: z.string().min(8).max(128),
  domain: z.string().min(3).max(255),
  installationId: z.string().min(8).max(128),
  version: z.string().max(40).optional(),
});

export const licenseValidateSchema = z.object({
  licenseKey: z.string().min(8).max(128),
  domain: z.string().min(3).max(255),
  installationId: z.string().min(8).max(128),
  version: z.string().max(40).optional(),
});

export const licenseHeartbeatSchema = z.object({
  installationId: z.string().min(8).max(128),
  licenseKey: z.string().min(8).max(128),
});

export const licenseClientSchema = z.object({
  name: z.string().min(2).max(120),
  email: emailSchema,
  company: z.string().max(120).optional(),
});

export const licenseCreateSchema = z.object({
  productId: objectIdSchema,
  clientId: objectIdSchema,
  type: z.enum(["trial", "monthly", "quarterly", "yearly", "lifetime", "custom"]),
  durationDays: z.coerce.number().int().positive().optional(),
  activationLimit: z.coerce.number().int().min(1).default(1),
  maxInstallations: z.coerce.number().int().min(1).default(1),
  domain: z.string().optional(),
});