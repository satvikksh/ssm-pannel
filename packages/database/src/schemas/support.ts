import mongoose from "mongoose";
import type { CouponType, CouponStatus, TicketStatus, TicketPriority } from "@smm/types";

export interface ApiKey {
  keyId: string;
  userId: mongoose.Types.ObjectId;
  name: string;
  keyHash: string;
  permissions: string[];
  ipRestrictions?: string[];
  enabled: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const apiKeySchema = new mongoose.Schema<ApiKey>(
  {
    keyId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    keyHash: { type: String, required: true, unique: true },
    permissions: { type: [String], default: [] },
    ipRestrictions: { type: [String], default: [] },
    enabled: { type: Boolean, default: true },
    lastUsedAt: { type: Date },
  },
  { timestamps: true, collection: "api_keys" },
);

export interface ApiLog {
  apiKeyId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  endpoint: string;
  method: string;
  statusCode: number;
  ip?: string;
  requestId?: string;
  durationMs?: number;
  createdAt: Date;
}

export const apiLogSchema = new mongoose.Schema<ApiLog>(
  {
    apiKeyId: { type: mongoose.Schema.Types.ObjectId, ref: "ApiKey" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    endpoint: { type: String, required: true },
    method: { type: String, required: true },
    statusCode: { type: Number, required: true },
    ip: { type: String },
    requestId: { type: String },
    durationMs: { type: Number },
  },
  { timestamps: true, collection: "api_logs" },
);

apiLogSchema.index({ userId: 1, createdAt: -1 });
apiLogSchema.index({ apiKeyId: 1, createdAt: -1 });
apiLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export interface Coupon {
  code: string;
  type: CouponType;
  value: number;
  minimumAmount?: number;
  maximumDiscount?: number;
  serviceIds?: mongoose.Types.ObjectId[];
  categoryIds?: mongoose.Types.ObjectId[];
  perUserLimit: number;
  usageLimit: number;
  usedCount: number;
  startAt?: Date;
  expiresAt?: Date;
  status: CouponStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const couponSchema = new mongoose.Schema<Coupon>(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    type: { type: String, enum: ["fixed", "percentage"], required: true },
    value: { type: Number, required: true },
    minimumAmount: { type: Number },
    maximumDiscount: { type: Number },
    serviceIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    categoryIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    perUserLimit: { type: Number, default: 1 },
    usageLimit: { type: Number, default: 1 },
    usedCount: { type: Number, default: 0 },
    startAt: { type: Date },
    expiresAt: { type: Date },
    status: { type: String, enum: ["active", "inactive", "expired"], default: "active" },
  },
  { timestamps: true, collection: "coupons" },
);

export interface CouponRedemption {
  couponId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId;
  discount: number;
  createdAt: Date;
}

export const couponRedemptionSchema = new mongoose.Schema<CouponRedemption>(
  {
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    discount: { type: Number, required: true },
  },
  { timestamps: true, collection: "coupon_redemptions" },
);

couponRedemptionSchema.index({ couponId: 1, userId: 1 });

export interface Ticket {
  publicTicketId: string;
  userId: mongoose.Types.ObjectId;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo?: mongoose.Types.ObjectId;
  lastReplyAt?: Date;
  internalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ticketSchema = new mongoose.Schema<Ticket>(
  {
    publicTicketId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true },
    category: { type: String, required: true },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
    status: { type: String, enum: ["open", "pending", "answered", "closed"], default: "open" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    lastReplyAt: { type: Date },
    internalNotes: { type: String },
  },
  { timestamps: true, collection: "tickets" },
);

ticketSchema.index({ userId: 1, createdAt: -1 });
ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ assignedTo: 1, status: 1 });

export interface TicketMessage {
  ticketId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderRole: "user" | "admin";
  body: string;
  attachments?: string[];
  isInternal: boolean;
  createdAt: Date;
}

export const ticketMessageSchema = new mongoose.Schema<TicketMessage>(
  {
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket", required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderRole: { type: String, enum: ["user", "admin"], required: true },
    body: { type: String, required: true },
    attachments: { type: [String], default: [] },
    isInternal: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "ticket_messages" },
);

ticketMessageSchema.index({ ticketId: 1, createdAt: 1 });

export interface Notification {
  userId: mongoose.Types.ObjectId;
  type: string;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
}

export const notificationSchema = new mongoose.Schema<Notification>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    link: { type: String },
    read: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true, collection: "notifications" },
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 });