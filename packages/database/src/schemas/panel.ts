import mongoose from "mongoose";
import type { LicenseStatus, LicenseType } from "@smm/types";

/**
 * License state stored in the CUSTOMER installation database. This only caches
 * the result of a license validation performed against the CENTRAL license
 * server. The signed authorization token makes it tamper-resistant. License
 * authority is NOT located here — it lives on the license server.
 */
export interface LicenseState {
  licenseKeyHint?: string;
  licenseId?: string;
  installationId: string;
  status: LicenseStatus;
  licenseType?: LicenseType;
  domain?: string;
  activatedAt?: Date;
  expiresAt?: Date;
  lastValidatedAt?: Date;
  nextValidationAt?: Date;
  signedAuthorization?: string; // from license server (HMAC)
  validityToken?: string; // random per-install token requested at activation
  graceUntil?: Date;
  version?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const licenseStateSchema = new mongoose.Schema<LicenseState>(
  {
    licenseKeyHint: { type: String },
    licenseId: { type: String },
    installationId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["trial", "active", "active_expired", "inactive", "suspended", "revoked", "expired", "waiting"],
      default: "waiting",
    },
    licenseType: { type: String },
    domain: { type: String },
    activatedAt: { type: Date },
    expiresAt: { type: Date },
    lastValidatedAt: { type: Date },
    nextValidationAt: { type: Date },
    signedAuthorization: { type: String },
    validityToken: { type: String },
    graceUntil: { type: Date },
    version: { type: String },
    notes: { type: String },
  },
  { timestamps: true, collection: "license_state" },
);

export interface SettingsDoc {
  key: string;
  value: Record<string, unknown>;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const settingsSchema = new mongoose.Schema<SettingsDoc>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "settings" },
);

export interface ChildPanel {
  publicPanelId: string;
  parentUserId: mongoose.Types.ObjectId;
  domain?: string;
  name: string;
  status: "pending" | "active" | "suspended";
  branding: Record<string, unknown>;
  serviceOverrides: Record<string, unknown>;
  userCount: number;
  licenseConsumed: number;
  createdAt: Date;
  updatedAt: Date;
}

export const childPanelSchema = new mongoose.Schema<ChildPanel>(
  {
    publicPanelId: { type: String, required: true, unique: true },
    parentUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    domain: { type: String },
    name: { type: String, required: true },
    status: { type: String, enum: ["pending", "active", "suspended"], default: "pending" },
    branding: { type: mongoose.Schema.Types.Mixed, default: {} },
    serviceOverrides: { type: mongoose.Schema.Types.Mixed, default: {} },
    userCount: { type: Number, default: 0 },
    licenseConsumed: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "child_panels" },
);

export interface Referral {
  referrerId: mongoose.Types.ObjectId;
  referredUserId: mongoose.Types.ObjectId;
  createdOrdersValue: number;
  createdAt: Date;
}

export const referralSchema = new mongoose.Schema<Referral>(
  {
    referrerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    createdOrdersValue: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "referrals" },
);

referralSchema.index({ referrerId: 1, createdAt: -1 });

export interface ReferralCommission {
  referrerId: mongoose.Types.ObjectId;
  referredUserId: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId;
  amount: number;
  percent: number;
  status: "pending" | "available" | "paid" | "voided";
  payoutRequestId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

export const referralCommissionSchema = new mongoose.Schema<ReferralCommission>(
  {
    referrerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    amount: { type: Number, required: true },
    percent: { type: Number, required: true },
    status: { type: String, enum: ["pending", "available", "paid", "voided"], default: "pending" },
    payoutRequestId: { type: mongoose.Schema.Types.ObjectId, ref: "PayoutRequest" },
  },
  { timestamps: true, collection: "referral_commissions" },
);

export interface PayoutRequest {
  publicPayoutId: string;
  userId: mongoose.Types.ObjectId;
  amount: number;
  method: string;
  details: Record<string, unknown>;
  status: "pending" | "approved" | "paid" | "rejected";
  adminId?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const payoutRequestSchema = new mongoose.Schema<PayoutRequest>(
  {
    publicPayoutId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    method: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["pending", "approved", "paid", "rejected"], default: "pending" },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectionReason: { type: String },
  },
  { timestamps: true, collection: "payout_requests" },
);

export interface AuditLog {
  adminId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  action: string;
  resourceType?: string;
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  createdAt: Date;
}

export const auditLogSchema = new mongoose.Schema<AuditLog>(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    resourceType: { type: String },
    resourceId: { type: String },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    reason: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    requestId: { type: String },
  },
  { timestamps: true, collection: "audit_logs" },
);

auditLogSchema.index({ adminId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 400 });

export interface SystemLog {
  level: string;
  service: string;
  message: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export const systemLogSchema = new mongoose.Schema<SystemLog>(
  {
    level: { type: String, required: true },
    service: { type: String, required: true },
    message: { type: String, required: true },
    requestId: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, collection: "system_logs" },
);

systemLogSchema.index({ service: 1, createdAt: -1 });
systemLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });