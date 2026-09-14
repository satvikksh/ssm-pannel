import mongoose from "mongoose";
import type { LicenseStatus, LicenseType, LicenseEventType } from "@smm/types";

export interface LicenseProduct {
  slug: string;
  name: string;
  description?: string;
  versions: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const licenseProductSchema = new mongoose.Schema<LicenseProduct>(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    versions: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "license_products" },
);

export interface LicenseClient {
  name: string;
  email: string;
  company?: string;
  status: "active" | "suspended" | "inactive";
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const licenseClientSchema = new mongoose.Schema<LicenseClient>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    company: { type: String },
    status: { type: String, enum: ["active", "suspended", "inactive"], default: "active" },
    notes: { type: String },
  },
  { timestamps: true, collection: "license_clients" },
);

export interface License {
  licenseKey: string; // plaintext derived (keyed) — only partial stored
  licenseKeyHash: string; // used for lookup
  productId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  type: LicenseType;
  status: LicenseStatus;
  domain?: string;
  activationLimit: number;
  durationDays?: number; // for non-lifetime
  expiresAt?: Date;
  activatedAt?: Date;
  lastValidatedAt?: Date;
  activatedInstallations: number;
  maxInstallations: number;
  assignedAdminUserId?: string; // customer Admin user (one license = one admin)
  assignedAdminEmail?: string;
  approvedAt?: Date;
  approvedBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const licenseSchema = new mongoose.Schema<License>(
  {
    licenseKeyHash: { type: String, required: true, unique: true },
    licenseKey: { type: String }, // masked, e.g. "ABCX-***-****"
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "LicenseProduct", required: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "LicenseClient", required: true },
    type: { type: String, enum: ["trial", "monthly", "quarterly", "yearly", "lifetime", "custom"], required: true },
    status: {
      type: String,
      enum: [
        "trial", "active", "active_expired", "inactive", "suspended", "revoked", "expired", "waiting", "generated",
        "pending", "approved",
      ],
      default: "generated",
    },
    domain: { type: String },
    activationLimit: { type: Number, default: 1 },
    maxInstallations: { type: Number, default: 1 },
    activatedInstallations: { type: Number, default: 0 },
    durationDays: { type: Number },
    expiresAt: { type: Date },
    activatedAt: { type: Date },
    lastValidatedAt: { type: Date },
    assignedAdminUserId: { type: String },
    assignedAdminEmail: { type: String },
    approvedAt: { type: Date },
    approvedBy: { type: String },
    notes: { type: String },
  },
  { timestamps: true, collection: "licenses" },
);

licenseSchema.index({ productId: 1, status: 1 });
licenseSchema.index({ clientId: 1, status: 1 });
licenseSchema.index({ expiresAt: 1 });
licenseSchema.index({ assignedAdminUserId: 1 });
licenseSchema.index({ assignedAdminEmail: 1 });

export interface LicenseInstallation {
  installationId: string;
  licenseId: mongoose.Types.ObjectId;
  domain: string;
  domainHistory: { domain: string; changedAt: Date; reason?: string }[];
  status: "active" | "suspended" | "revoked" | "expired" | "deactivated";
  ip: string;
  activatedAt: Date;
  lastHeartbeatAt?: Date;
  version?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const licenseInstallationSchema = new mongoose.Schema<LicenseInstallation>(
  {
    installationId: { type: String, required: true, unique: true },
    licenseId: { type: mongoose.Schema.Types.ObjectId, ref: "License", required: true },
    domain: { type: String, required: true },
    domainHistory: {
      type: [
        {
          domain: String,
          changedAt: Date,
          reason: String,
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "suspended", "revoked", "expired", "deactivated"],
      default: "active",
    },
    ip: { type: String },
    activatedAt: { type: Date },
    lastHeartbeatAt: { type: Date },
    version: { type: String },
  },
  { timestamps: true, collection: "license_installations" },
);

licenseInstallationSchema.index({ licenseId: 1 });
licenseInstallationSchema.index({ domain: 1 });

export interface LicenseActivation {
  licenseKeyHash: string;
  installationId: string;
  domain: string;
  ip: string;
  success: boolean;
  errorCode?: string;
  createdAt: Date;
}

export const licenseActivationSchema = new mongoose.Schema<LicenseActivation>(
  {
    licenseKeyHash: { type: String, required: true },
    installationId: { type: String, required: true },
    domain: { type: String, required: true },
    ip: { type: String },
    success: { type: Boolean, default: false },
    errorCode: { type: String },
  },
  { timestamps: true, collection: "license_activations" },
);

licenseActivationSchema.index({ createdAt: -1 });
licenseActivationSchema.index({ licenseKeyHash: 1, createdAt: -1 });

export interface LicenseValidation {
  licenseKeyHash: string;
  installationId: string;
  domain: string;
  ip: string;
  valid: boolean;
  status?: string;
  errorCode?: string;
  version?: string;
  createdAt: Date;
}

export const licenseValidationSchema = new mongoose.Schema<LicenseValidation>(
  {
    licenseKeyHash: { type: String, required: true },
    installationId: { type: String, required: true },
    domain: { type: String, required: true },
    ip: { type: String },
    valid: { type: Boolean, required: true },
    status: { type: String },
    errorCode: { type: String },
    version: { type: String },
  },
  { timestamps: true, collection: "license_validations" },
);

licenseValidationSchema.index({ licenseKeyHash: 1, createdAt: -1 });
licenseValidationSchema.index({ installationId: 1, createdAt: -1 });
licenseValidationSchema.index({ valid: 1, createdAt: -1 });
licenseValidationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export interface LicenseEvent {
  licenseId?: mongoose.Types.ObjectId;
  installationId?: string;
  type: LicenseEventType;
  domain?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export const licenseEventSchema = new mongoose.Schema<LicenseEvent>(
  {
    licenseId: { type: mongoose.Schema.Types.ObjectId, ref: "License" },
    installationId: { type: String },
    type: {
      type: String,
      enum: [
        "activated",
        "validated",
        "invalid_validation",
        "domain_mismatch",
        "installation_mismatch",
        "expired",
        "suspended",
        "revoked",
        "reset",
        "domain_changed",
        "deactivated",
        "heartbeat",
        "admin_action",
        "activation_limit",
        "approved",
        "assigned",
      ],
      required: true,
    },
    domain: { type: String },
    ip: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, collection: "license_events" },
);

licenseEventSchema.index({ licenseId: 1, createdAt: -1 });
licenseEventSchema.index({ installationId: 1, createdAt: -1 });
licenseEventSchema.index({ type: 1, createdAt: -1 });

export interface LicenseAdmin {
  email: string;
  passwordHash: string;
  name: string;
  role: string;
  twoFactorEnabled: boolean;
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  status: "active" | "suspended";
  createdAt: Date;
  updatedAt: Date;
}

export const licenseAdminSchema = new mongoose.Schema<LicenseAdmin>(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, default: "super_admin" },
    twoFactorEnabled: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
  },
  { timestamps: true, collection: "license_admins" },
);

export interface ProductVersion {
  productId: mongoose.Types.ObjectId;
  version: string;
  minVersion?: string;
  recommendedVersion?: string;
  releaseNotes?: string;
  releasedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const productVersionSchema = new mongoose.Schema<ProductVersion>(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "LicenseProduct", required: true },
    version: { type: String, required: true },
    minVersion: { type: String },
    recommendedVersion: { type: String },
    releaseNotes: { type: String },
    releasedAt: { type: Date },
  },
  { timestamps: true, collection: "product_versions" },
);

productVersionSchema.index({ productId: 1, version: 1 }, { unique: true });

export interface LicenseAuditLog {
  adminId?: mongoose.Types.ObjectId;
  adminEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  ip?: string;
  createdAt: Date;
}

export const licenseAuditLogSchema = new mongoose.Schema<LicenseAuditLog>(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "LicenseAdmin" },
    adminEmail: { type: String },
    action: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    reason: { type: String },
    ip: { type: String },
  },
  { timestamps: true, collection: "license_audit_logs" },
);

licenseAuditLogSchema.index({ adminId: 1, createdAt: -1 });
licenseAuditLogSchema.index({ action: 1, createdAt: -1 });