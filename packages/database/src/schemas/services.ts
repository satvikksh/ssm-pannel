import mongoose from "mongoose";
import type {
  Platform,
  ServiceStatus,
  ServiceType,
  ProviderStatus,
  CategoryStatus,
} from "@smm/types";

export interface Category {
  name: string;
  slug: string;
  platform?: Platform;
  description?: string;
  icon?: string;
  sortOrder: number;
  status: CategoryStatus;
  visibility: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const categorySchema = new mongoose.Schema<Category>(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    platform: {
      type: String,
      enum: ["instagram", "youtube", "tiktok", "facebook", "telegram", "x", "discord", "website", "other"],
    },
    description: { type: String },
    icon: { type: String },
    sortOrder: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    visibility: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "categories" },
);

export interface Service {
  name: string;
  slug: string;
  description?: string;
  platform?: Platform;
  serviceType: ServiceType;
  categoryId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  providerServiceId: string;
  providerCost: number;
  customerPrice: number;
  resellerPrice?: number;
  minimum: number;
  maximum: number;
  averageStartTime?: number;
  averageCompletionTime?: number;
  refillSupported: boolean;
  cancelSupported: boolean;
  dripFeedSupported: boolean;
  subscriptionSupported: boolean;
  customOrderFields?: { min?: number; max?: number; example?: string; tips?: string; placeholder?: string };
  status: ServiceStatus;
  visibility: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export const serviceSchema = new mongoose.Schema<Service>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String },
    platform: { type: String },
    serviceType: { type: String, default: "other" },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: "Provider", required: true },
    providerServiceId: { type: String, required: true },
    providerCost: { type: Number, required: true },
    customerPrice: { type: Number, required: true },
    resellerPrice: { type: Number },
    minimum: { type: Number, required: true },
    maximum: { type: Number, required: true },
    averageStartTime: { type: Number },
    averageCompletionTime: { type: Number },
    refillSupported: { type: Boolean, default: false },
    cancelSupported: { type: Boolean, default: false },
    dripFeedSupported: { type: Boolean, default: false },
    subscriptionSupported: { type: Boolean, default: false },
    customOrderFields: { type: mongoose.Schema.Types.Mixed },
    status: { type: String, enum: ["active", "inactive", "disabled"], default: "active" },
    visibility: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "services" },
);

serviceSchema.index({ categoryId: 1, status: 1 });
serviceSchema.index({ providerId: 1 });
serviceSchema.index({ providerId: 1, providerServiceId: 1 }, { unique: true });
serviceSchema.index({ slug: 1 }, { unique: true });

export interface ServicePrice {
  serviceId: mongoose.Types.ObjectId;
  userGroupId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  price: number;
  createdAt: Date;
  updatedAt: Date;
}

export const servicePriceSchema = new mongoose.Schema<ServicePrice>(
  {
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    userGroupId: { type: mongoose.Schema.Types.ObjectId, ref: "UserGroup" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    price: { type: Number, required: true },
  },
  { timestamps: true, collection: "service_prices" },
);

servicePriceSchema.index({ serviceId: 1, userGroupId: 1, userId: 1 }, { unique: true });

export interface Provider {
  name: string;
  slug: string;
  adapter: string;
  baseUrl: string;
  status: ProviderStatus;
  config: {
    apiKey?: string; // encrypted at rest
    apiSecret?: string; // encrypted at rest
    [key: string]: unknown;
  };
  health: {
    score: number;
    lastOkAt?: Date;
    lastErrorAt?: Date;
    lastError?: string;
    consecutiveFailures: number;
  };
  balance?: number;
  currency: string;
  timeoutMs: number;
  retries: number;
  createdAt: Date;
  updatedAt: Date;
}

export const providerSchema = new mongoose.Schema<Provider>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    adapter: { type: String, required: true },
    baseUrl: { type: String, required: true },
    status: { type: String, enum: ["active", "inactive", "suspended", "degraded"], default: "active" },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    health: {
      score: { type: Number, default: 100 },
      lastOkAt: { type: Date },
      lastErrorAt: { type: Date },
      lastError: { type: String },
      consecutiveFailures: { type: Number, default: 0 },
    },
    balance: { type: Number },
    currency: { type: String, default: "INR" },
    timeoutMs: { type: Number, default: 30000 },
    retries: { type: Number, default: 3 },
  },
  { timestamps: true, collection: "providers" },
);

export interface ProviderService {
  providerId: mongoose.Types.ObjectId;
  providerServiceId: string;
  name: string;
  type?: string;
  category?: string;
  price: number;
  min?: number;
  max?: number;
  refill?: boolean;
  cancel?: boolean;
  dripFeed?: boolean;
  subscription?: boolean;
  raw: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const providerServiceSchema = new mongoose.Schema<ProviderService>(
  {
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: "Provider", required: true },
    providerServiceId: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String },
    category: { type: String },
    price: { type: Number },
    min: { type: Number },
    max: { type: Number },
    refill: { type: Boolean, default: false },
    cancel: { type: Boolean, default: false },
    dripFeed: { type: Boolean, default: false },
    subscription: { type: Boolean, default: false },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "provider_services" },
);

providerServiceSchema.index({ providerId: 1, providerServiceId: 1 }, { unique: true });