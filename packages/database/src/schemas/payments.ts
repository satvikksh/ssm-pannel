import mongoose from "mongoose";
import type { PaymentStatus, PaymentGateway, PaymentMethodType } from "@smm/types";
import { CURRENCY } from "@smm/types";

export interface Payment {
  publicPaymentId: string;
  userId: mongoose.Types.ObjectId;
  gateway: PaymentGateway;
  amount: number;
  currency: string;
  status: PaymentStatus;
  gatewayTransactionId?: string;
  gatewayPaymentRef?: string;
  paymentMethod?: string;
  methodCode?: string;
  proof?: {
    filePath?: string;
    transactionRef?: string;
    notes?: string;
  };
  adminId?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  metadata?: Record<string, unknown>;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const paymentSchema = new mongoose.Schema<Payment>(
  {
    publicPaymentId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    gateway: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: CURRENCY },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "failed", "processing"],
      default: "pending",
    },
    gatewayTransactionId: { type: String, unique: true, sparse: true },
    gatewayPaymentRef: { type: String },
    paymentMethod: { type: String },
    methodCode: { type: String },
    proof: {
      filePath: { type: String },
      transactionRef: { type: String },
      notes: { type: String },
    },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectionReason: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    processedAt: { type: Date },
  },
  { timestamps: true, collection: "payments" },
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

/**
 * PaymentMethod — the authoritative list of deposit/withdrawal methods. Fully
 * dynamic: admins create/update/disable rows; the user panel only renders
 * `enabled` methods. Gateway credentials live only in `config` and are NEVER
 * serialized to the client.
 */
export interface PaymentMethod {
  code: string;
  name: string;
  type: PaymentMethodType;
  description?: string;
  enabled: boolean;
  sortOrder: number;
  minAmount?: number;
  maxAmount?: number;
  instructions?: string;
  config?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const paymentMethodSchema = new mongoose.Schema<PaymentMethod>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    description: { type: String },
    enabled: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    minAmount: { type: Number },
    maxAmount: { type: Number },
    instructions: { type: String },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "payment_methods" },
);

export interface PaymentWebhook {
  gateway: PaymentGateway;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  processed: boolean;
  error?: string;
  processedAt?: Date;
  createdAt: Date;
}

export const paymentWebhookSchema = new mongoose.Schema<PaymentWebhook>(
  {
    gateway: { type: String, required: true },
    eventId: { type: String, required: true },
    eventType: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    processed: { type: Boolean, default: false },
    error: { type: String },
    processedAt: { type: Date },
  },
  { timestamps: true, collection: "payment_webhooks" },
);

paymentWebhookSchema.index({ gateway: 1, eventId: 1 }, { unique: true });