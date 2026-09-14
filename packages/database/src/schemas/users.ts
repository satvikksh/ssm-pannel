import mongoose from "mongoose";
import { UserRole, type UserStatus } from "@smm/types";

export interface User {
  email: string;
  username: string;
  passwordHash: string;
  name?: string;
  status: UserStatus;
  role: UserRole;
  permissions?: string[];
  tokenVersion?: number;
  userGroupId?: mongoose.Types.ObjectId;
  referredBy?: mongoose.Types.ObjectId;
  referralCode: string;
  flags: {
    emailVerified: boolean;
    twoFactorEnabled: boolean;
    apiAccess: boolean;
  };
  lastLoginAt?: Date;
  lastLoginIp?: string;
  passwordChangedAt?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const userSchema = new mongoose.Schema<User>(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    username: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String },
    status: {
      type: String,
      enum: ["active", "suspended", "unverified", "banned"],
      default: "unverified",
    },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.USER },
    permissions: { type: [String], default: [] },
    tokenVersion: { type: Number, default: 0 },
    userGroupId: { type: mongoose.Schema.Types.ObjectId, ref: "UserGroup" },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    referralCode: { type: String, required: true },
    flags: {
      emailVerified: { type: Boolean, default: false },
      twoFactorEnabled: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
    },
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
    passwordChangedAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
  },
  { timestamps: true, collection: "users" },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ status: 1 });
userSchema.index({ referralCode: 1 }, { unique: true });
userSchema.index({ userGroupId: 1 });

export interface UserGroup {
  name: string;
  description?: string;
  markupPercent: number;
  fixedMarkup: number;
  isDefault: boolean;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

export const userGroupSchema = new mongoose.Schema<UserGroup>(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    markupPercent: { type: Number, default: 0, min: 0 },
    fixedMarkup: { type: Number, default: 0, min: 0 },
    isDefault: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true, collection: "user_groups" },
);

export interface Role {
  slug: string;
  name: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const roleSchema = new mongoose.Schema<Role>(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "roles" },
);

export interface Permission {
  slug: string;
  module: string;
  createdAt: Date;
  updatedAt: Date;
}

export const permissionSchema = new mongoose.Schema<Permission>(
  {
    slug: { type: String, required: true, unique: true },
    module: { type: String, required: true },
  },
  { timestamps: true, collection: "permissions" },
);