import mongoose from "mongoose";
import type {
  OrderStatus,
  OrderType,
  PricingSnapshot,
  DripFeedStatus,
  SubscriptionStatus,
} from "@smm/types";

export interface Order {
  publicOrderId: string;
  userId: mongoose.Types.ObjectId;
  serviceId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  providerServiceId?: string;
  providerOrderId?: string;
  orderType: OrderType;
  link: string;
  quantity: number;
  pricingSnapshot: PricingSnapshot;
  status: OrderStatus;
  startCount?: number;
  remains?: number;
  providerResponse?: Record<string, unknown>;
  idempotencyKey?: string;
  apiKeyId?: mongoose.Types.ObjectId;
  cancelReason?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const orderSchema = new mongoose.Schema<Order>(
  {
    publicOrderId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: "Provider", required: true },
    providerServiceId: { type: String },
    providerOrderId: { type: String },
    orderType: {
      type: String,
      enum: ["standard", "mass", "api", "admin", "drip_feed", "subscription"],
      default: "standard",
    },
    link: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    pricingSnapshot: {
      providerCost: { type: Number, required: true },
      baseRate: { type: Number, required: true },
      markup: { type: Number, required: true },
      discount: { type: Number, required: true },
      finalCharge: { type: Number, required: true },
      currency: { type: String, default: "INR" },
    },
    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "in_progress",
        "completed",
        "partial",
        "canceled",
        "refunded",
        "failed",
      ],
      default: "pending",
    },
    startCount: { type: Number },
    remains: { type: Number },
    providerResponse: { type: mongoose.Schema.Types.Mixed },
    idempotencyKey: { type: String, unique: true, sparse: true },
    apiKeyId: { type: mongoose.Schema.Types.ObjectId, ref: "ApiKey" },
    cancelReason: { type: String },
    completedAt: { type: Date },
  },
  { timestamps: true, collection: "orders" },
);

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ providerId: 1, providerOrderId: 1 });
orderSchema.index({ serviceId: 1 });

export interface OrderStatusHistory {
  orderId: mongoose.Types.ObjectId;
  from: OrderStatus;
  to: OrderStatus;
  note?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export const orderStatusHistorySchema = new mongoose.Schema<OrderStatusHistory>(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    note: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, collection: "order_status_history" },
);

orderStatusHistorySchema.index({ orderId: 1, createdAt: 1 });

export interface Refill {
  publicRefillId: string;
  orderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  providerRefillId?: string;
  quantity?: number;
  status: "pending" | "processing" | "completed" | "failed";
  providerResponse?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const refillSchema = new mongoose.Schema<Refill>(
  {
    publicRefillId: { type: String, required: true, unique: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: "Provider", required: true },
    providerRefillId: { type: String },
    quantity: { type: Number },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    providerResponse: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, collection: "refills" },
);

refillSchema.index({ orderId: 1, createdAt: 1 });

export interface DripFeedOrder {
  publicDripId: string;
  userId: mongoose.Types.ObjectId;
  serviceId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  link: string;
  totalQuantity: number;
  quantityPerRun: number;
  runs: number;
  intervalMinutes: number;
  startAt: Date;
  nextRunAt: Date;
  completedRuns: number;
  remainingRuns: number;
  status: DripFeedStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const dripFeedOrderSchema = new mongoose.Schema<DripFeedOrder>(
  {
    publicDripId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: "Provider", required: true },
    link: { type: String, required: true },
    totalQuantity: { type: Number, required: true },
    quantityPerRun: { type: Number, required: true },
    runs: { type: Number, required: true },
    intervalMinutes: { type: Number, required: true },
    startAt: { type: Date, required: true },
    nextRunAt: { type: Date, required: true },
    completedRuns: { type: Number, default: 0 },
    remainingRuns: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "active", "paused", "completed", "canceled", "failed"],
      default: "pending",
    },
  },
  { timestamps: true, collection: "drip_feed_orders" },
);

dripFeedOrderSchema.index({ status: 1, nextRunAt: 1 });
dripFeedOrderSchema.index({ userId: 1, createdAt: -1 });

export interface Subscription {
  publicSubscriptionId: string;
  userId: mongoose.Types.ObjectId;
  serviceId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  link: string;
  quantity: number;
  runs: number;
  intervalDays: number;
  nextRunAt: Date;
  completedRuns: number;
  providerSubscriptionId?: string;
  status: SubscriptionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const subscriptionSchema = new mongoose.Schema<Subscription>(
  {
    publicSubscriptionId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: "Provider", required: true },
    link: { type: String, required: true },
    quantity: { type: Number, required: true },
    runs: { type: Number, required: true },
    intervalDays: { type: Number, required: true },
    nextRunAt: { type: Date, required: true },
    completedRuns: { type: Number, default: 0 },
    providerSubscriptionId: { type: String },
    status: { type: String, enum: ["active", "paused", "canceled", "completed", "failed"], default: "active" },
  },
  { timestamps: true, collection: "subscriptions" },
);

subscriptionSchema.index({ status: 1, nextRunAt: 1 });