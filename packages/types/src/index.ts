export const OrderStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  PARTIAL: "partial",
  CANCELED: "canceled",
  REFUNDED: "refunded",
  FAILED: "failed",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PROCESSING,
  OrderStatus.IN_PROGRESS,
  OrderStatus.COMPLETED,
];

export const WalletTransactionType = {
  DEPOSIT: "deposit",
  ORDER_DEBIT: "order_debit",
  REFUND: "refund",
  MANUAL_CREDIT: "manual_credit",
  MANUAL_DEBIT: "manual_debit",
  REFERRAL: "referral",
  BONUS: "bonus",
  CHARGEBACK: "chargeback",
  ADJUSTMENT: "adjustment",
  PAYMENT_REFUND: "payment_refund",
} as const;

export type WalletTransactionType =
  (typeof WalletTransactionType)[keyof typeof WalletTransactionType];

export const WalletTransactionStatus = {
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
  CANCELED: "canceled",
} as const;

export type WalletTransactionStatus =
  (typeof WalletTransactionStatus)[keyof typeof WalletTransactionStatus];

export const UserStatus = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  UNVERIFIED: "unverified",
  BANNED: "banned",
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const UserRole = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  USER: "user",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const AdminPermission = {
  ADMIN_DASHBOARD: "admin.dashboard",
  ADMIN_FINANCE: "admin.finance",
  ADMIN_MANAGE: "admin.manage",
  USERS_VIEW: "users.view",
  USERS_EDIT: "users.edit",
  ORDERS_MANAGE: "orders.manage",
  SERVICES_MANAGE: "services.manage",
  PROVIDERS_MANAGE: "providers.manage",
  PAYMENTS_VIEW: "payments.view",
  PAYMENTS_APPROVE: "payments.approve",
  PAYMENTS_MANAGE: "payments.manage",
  COUPONS_MANAGE: "coupons.manage",
  TICKETS_VIEW: "tickets.view",
  TICKETS_MANAGE: "tickets.manage",
  SETTINGS_MANAGE: "settings.manage",
  LICENSE_MANAGE: "license.manage",
  NOTIFICATIONS_MANAGE: "notifications.manage",
} as const;

export type AdminPermission = (typeof AdminPermission)[keyof typeof AdminPermission];

export const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const APP_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const PaymentStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  FAILED: "failed",
  PROCESSING: "processing",
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentGateway = {
  RAZORPAY: "razorpay",
  STRIPE: "stripe",
  PAYPAL: "paypal",
  MANUAL: "manual",
  UPI: "upi",
} as const;

export type PaymentGateway =
  (typeof PaymentGateway)[keyof typeof PaymentGateway];

export const PaymentMethodType = {
  UPI: "upi",
  RAZORPAY: "razorpay",
  STRIPE: "stripe",
  PAYPAL: "paypal",
  PAYU: "payu",
  PHONEPE: "phonepe",
  NETBANKING: "netbanking",
  CARD: "card",
  MANUAL: "manual",
  OTHER: "other",
} as const;

export type PaymentMethodType =
  (typeof PaymentMethodType)[keyof typeof PaymentMethodType];

export const CURRENCY = "INR";
export const CURRENCY_SYMBOL = "₹";
export const DEFAULT_MONEY_MINOR_UNITS = 100;

export interface PaymentMethodDef {
  code: string;
  name: string;
  type: PaymentMethodType;
  description?: string;
  enabled: boolean;
  sortOrder: number;
  minAmount?: number;
  maxAmount?: number;
  instructions?: string;
}

export const OrderType = {
  STANDARD: "standard",
  MASS: "mass",
  API: "api",
  ADMIN: "admin",
  DRIP_FEED: "drip_feed",
  SUBSCRIPTION: "subscription",
} as const;

export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export const RefillStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type RefillStatus = (typeof RefillStatus)[keyof typeof RefillStatus];

export const DripFeedStatus = {
  PENDING: "pending",
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
  CANCELED: "canceled",
  FAILED: "failed",
} as const;

export type DripFeedStatus = (typeof DripFeedStatus)[keyof typeof DripFeedStatus];

export const SubscriptionStatus = {
  ACTIVE: "active",
  PAUSED: "paused",
  CANCELED: "canceled",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const CouponType = {
  FIXED: "fixed",
  PERCENTAGE: "percentage",
} as const;

export type CouponType = (typeof CouponType)[keyof typeof CouponType];

export const CouponStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  EXPIRED: "expired",
} as const;

export type CouponStatus = (typeof CouponStatus)[keyof typeof CouponStatus];

export const TicketStatus = {
  OPEN: "open",
  PENDING: "pending",
  ANSWERED: "answered",
  CLOSED: "closed",
} as const;

export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TicketPriority = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
} as const;

export type TicketPriority = (typeof TicketPriority)[keyof typeof TicketPriority];

export const ServiceStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  DISABLED: "disabled",
} as const;

export type ServiceStatus = (typeof ServiceStatus)[keyof typeof ServiceStatus];

export const ProviderStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
  DEGRADED: "degraded",
} as const;

export type ProviderStatus = (typeof ProviderStatus)[keyof typeof ProviderStatus];

export const CategoryStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export type CategoryStatus = (typeof CategoryStatus)[keyof typeof CategoryStatus];

export const LicenseStatus = {
  TRIAL: "trial",
  ACTIVE: "active",
  ACTIVE_EXPIRED: "active_expired",
  INACTIVE: "inactive",
  PENDING: "pending",
  APPROVED: "approved",
  SUSPENDED: "suspended",
  REVOKED: "revoked",
  EXPIRED: "expired",
  WAITING: "waiting",
  UNKNOWN: "unknown",
  GENERATED: "generated",
} as const;

export type LicenseStatus = (typeof LicenseStatus)[keyof typeof LicenseStatus];

export const LicenseEventType = {
  ACTIVATED: "activated",
  VALIDATED: "validated",
  INVALID_VALIDATION: "invalid_validation",
  DOMAIN_MISMATCH: "domain_mismatch",
  INSTALLATION_MISMATCH: "installation_mismatch",
  EXPIRED: "expired",
  SUSPENDED: "suspended",
  REVOKED: "revoked",
  RESET: "reset",
  DOMAIN_CHANGED: "domain_changed",
  DEACTIVATED: "deactivated",
  HEARTBEAT: "heartbeat",
  ADMIN_ACTION: "admin_action",
  ACTIVATION_LIMIT: "activation_limit",
  APPROVED: "approved",
  ASSIGNED: "assigned",
} as const;

export type LicenseEventType =
  (typeof LicenseEventType)[keyof typeof LicenseEventType];

/** Result of a centralized "can this Admin use the panel?" check. */
export interface AdminLicenseAccess {
  granted: boolean;
  code?: string;
  message?: string;
  licenseKeyHint?: string;
  status?: LicenseStatus;
  expiresAt?: string | null;
  installationId?: string;
  domain?: string;
}

export const LicenseType = {
  TRIAL: "trial",
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  YEARLY: "yearly",
  LIFETIME: "lifetime",
  CUSTOM: "custom",
} as const;

export type LicenseType = (typeof LicenseType)[keyof typeof LicenseType];

export const QueueName = {
  ORDER_PROCESSING: "order-processing",
  ORDER_STATUS: "order-status",
  PROVIDER_SYNC: "provider-sync",
  REFILL_PROCESSING: "refill-processing",
  DRIP_FEED: "drip-feed",
  SUBSCRIPTION_PROCESSING: "subscription-processing",
  EMAIL: "email",
  PAYMENTS: "payments",
  NOTIFICATIONS: "notifications",
  REPORTS: "reports",
  LICENSE: "license",
  CLEANUP: "cleanup",
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];

export const UserApiPermission = {
  SERVICES_VIEW: "services.view",
  ORDERS_CREATE: "orders.create",
  ORDERS_VIEW: "orders.view",
  ORDERS_REFILL: "orders.refill",
  ORDERS_CANCEL: "orders.cancel",
  BALANCE_VIEW: "balance.view",
} as const;

export type UserApiPermission =
  (typeof UserApiPermission)[keyof typeof UserApiPermission];

export type PricingSnapshot = {
  providerCost: number;
  baseRate: number;
  markup: number;
  discount: number;
  finalCharge: number;
  currency: string;
};

export type Money = {
  amount: number;
  currency: string;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Paginated<T> = {
  items: T[];
  meta: PaginationMeta;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId: string;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
  requestId: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export const Platform = {
  INSTAGRAM: "instagram",
  YOUTUBE: "youtube",
  TIKTOK: "tiktok",
  FACEBOOK: "facebook",
  TELEGRAM: "telegram",
  X: "x",
  DISCORD: "discord",
  WEBSITE: "website",
  OTHER: "other",
} as const;

export type Platform = (typeof Platform)[keyof typeof Platform];

export const SERVICE_TYPES = [
  "followers",
  "likes",
  "views",
  "comments",
  "shares",
  "subscribers",
  "reactions",
  "mentions",
  "other",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];