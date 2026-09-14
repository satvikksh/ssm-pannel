# Packages reference

Every package is strict TypeScript, compiled to CommonJS in its own `dist/`. This document is the authoritative reference for their public surfaces.

## @smm/config

Zod-validated environment configuration, parsed once and cached.

- `envSchema` — zod schema over `process.env`.
- `AppEnv` — inferred type.
- `loadConfig(): AppEnv` — throws `ConfigError` listing all validation issues; in production also throws if `JWT_SECRET` is unset.
- `resetConfigForTests(): void` — clears the module cache.

### Environment variables

| Var                                                                                              | Default                               | Required   | Notes                                 |
| ------------------------------------------------------------------------------------------------ | ------------------------------------- | ---------- | ------------------------------------- |
| `NODE_ENV`                                                                                       | `development`                         | —          | dev/test/production                   |
| `PORT`                                                                                           | `4000`                                | —          | int > 0                               |
| `APP_URL`                                                                                        | `http://localhost:4000`               | —          | URL; CORS origin                      |
| `MONGODB_URI`                                                                                    | `mongodb://localhost:27017/smm-panel` | —          |                                       |
| `REDIS_URL`                                                                                      | `redis://localhost:6379`              | —          | also `rediss://` supported            |
| `JWT_SECRET`                                                                                     | sample                                | production | min 32 chars                          |
| `JWT_ACCESS_TTL`                                                                                 | `1d`                                  | —          | msmr-style string                     |
| `JWT_REFRESH_TTL`                                                                                | `30d`                                 | —          |                                       |
| `ENCRYPTION_KEY`                                                                                 | —                                     | —          | 64 hex chars for AES-256-GCM at-rest  |
| `LICENSE_SERVER_URL`                                                                             | —                                     | —          | central license server base URL       |
| `LICENSE_CLIENT_ID` / `LICENSE_CLIENT_SECRET` / `LICENSE_PUBLIC_KEY` / `LICENSE_DOMAIN`          | —                                     | —          | license platform credentials (future) |
| `LICENSE_GRACE_SECONDS`                                                                          | `86400`                               | —          | offline grace                         |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM_NAME` / `SMTP_FROM_EMAIL` | —                                     | —          | email (future worker)                 |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`                                                    | —                                     | —          |                                       |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`                                                        | —                                     | —          |                                       |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`                                                      | —                                     | —          |                                       |
| `RATE_LIMIT_WINDOW_MS`                                                                           | `60000`                               | —          | throttler (currently unused)          |
| `RATE_LIMIT_MAX`                                                                                 | `100`                                 | —          |                                       |

## @smm/types

Domain enums/constants as `as const` objects with derived types. Full values:

- **OrderStatus**: `pending, processing, in_progress, completed, partial, canceled, refunded, failed`; `ORDER_STATUS_FLOW = [pending, processing, in_progress, completed]`.
- **WalletTransactionType**: `deposit, order_debit, refund, manual_credit, manual_debit, referral, bonus, chargeback, adjustment, payment_refund`.
- **WalletTransactionStatus**: `pending, success, failed, canceled`.
- **UserStatus**: `active, suspended, unverified, banned`.
- **UserRole**: `super_admin, admin, finance_manager, support_agent, service_manager, user`.
- **PaymentStatus**: `pending, approved, rejected, failed, processing`; **PaymentGateway**: `razorpay, stripe, paypal, manual, upi`.
- **OrderType**: `standard, mass, api, admin, drip_feed, subscription`.
- **RefillStatus**: `pending, processing, completed, failed`.
- **DripFeedStatus**: `pending, active, paused, completed, canceled, failed`.
- **SubscriptionStatus**: `active, paused, canceled, completed, failed`.
- **CouponType**: `fixed, percentage`; **CouponStatus**: `active, inactive, expired`.
- **TicketStatus**: `open, pending, answered, closed`; **TicketPriority**: `low, medium, high, urgent`.
- **ServiceStatus**: `active, inactive, disabled`; **ProviderStatus**: `active, inactive, suspended, degraded`; **CategoryStatus**: `active, inactive`.
- **LicenseStatus**: `trial, active, active_expired, inactive, suspended, revoked, expired, waiting, unknown, generated`.
- **LicenseType**: `trial, monthly, quarterly, yearly, lifetime, custom`.
- **LicenseEventType**: `activated, validated, invalid_validation, domain_mismatch, installation_mismatch, expired, suspended, revoked, reset, domain_changed, deactivated, heartbeat, admin_action, activation_limit`.
- **QueueName**: `order-processing, order-status, provider-sync, refill-processing, drip-feed, subscription-processing, email, payments, notifications, reports, license, cleanup`.
- **UserApiPermission**: `services.view, orders.create, orders.view, orders.refill, orders.cancel, balance.view`.
- **Platform**: `instagram, youtube, tiktok, facebook, telegram, x, discord, website, other`.
- **SERVICE_TYPES**: `["followers","likes","views","comments","shares","subscribers","reactions","mentions","other"]`.

Type aliases/interfaces: `PricingSnapshot`, `Money`, `PaginationMeta`, `Paginated<T>`, `ApiSuccess<T>`, `ApiError`, `ApiResponse<T>`.

## @smm/security

| Function         | Signature                                           | Notes                                          |
| ---------------- | --------------------------------------------------- | ---------------------------------------------- |
| `hashPassword`   | `(password) => Promise<string>`                     | bcryptjs, 12 rounds                            |
| `verifyPassword` | `(password, hash) => Promise<boolean>`              | false on empty hash                            |
| `signJwt`        | `(payload, {secret, expiresIn}) => Promise<string>` | issuer `smm-panel`                             |
| `verifyJwt<T>`   | `(token, secret) => Promise<T>`                     |                                                |
| `hmacSign`       | `(payload, secret) => string`                       | HMAC-SHA256 hex                                |
| `hmacVerify`     | `(payload, expected, secret) => boolean`            | timing-safe                                    |
| `apiSign`        | `(secret, body, timestamp) => string`               | `hmacSign(\`${timestamp}.${body}\`)`           |
| `encryptSecret`  | `(plaintext, keyHex) => string`                     | AES-256-GCM `iv:tag:ciphertext`                |
| `decryptSecret`  | `(payload, keyHex) => string`                       |                                                |
| `hashKey`        | `(secret) => string`                                | HMAC-SHA256 with static key — indexed key hash |
| `generateApiKey` | `() => {keyId, secret, keyHash}`                    | `smm_…` + `sk_…`                               |
| `generateOtp`    | `() => string`                                      | 6-digit                                        |
| `randomSecret`   | `(bytes = 32) => string`                            | base64url                                      |

## @smm/logger

- `LogLevel`: `fatal, error, warn, info, debug, trace`.
- `LogContext`: `{requestId?, userId?, orderId?, installationId?, licenseId?, ...}`.
- `Logger` interface: `child(bindings)`, `fatal/error/warn/info/debug/trace(message, context?)`.
- `createLogger({level?, name?, redact[]?})` — pino, ISO timestamps, `base: undefined`, default redaction censor `[REDACTED]` for password, api keys/secrets, tokens, auth headers, private keys.
- `createNestLogger(...)` — same output plus Nest `log`/`verbose`/`setLogLevels`; use with `app.useLogger(...)`.
- `generateRequestId(): string` — randomUUID.

## @smm/database

- `CUSTOMER_DB_NAME = "smm_panel"`, `LICENSE_DB_NAME = "smm_license"`.
- `CustomerCollections` and `LicenseCollections` — canonical collection-name constants.
- `connectMongo({uri, dbName?})` — new `Mongoose()` per call, pool 2–20, 5s server selection, 45s socket timeout.
- `isConnected(connection)` — `readyState === 1`.
- `withTransaction(connection, fn(session))` — real session transaction; throws if not connected.
- `getModel(name, schema, collection?)` — idempotent model registration (avoids `OverwriteModelError`).
- Exports every Mongoose schema: `userSchema`, `userGroupSchema`, `roleSchema`, `permissionSchema`, `walletSchema`, `walletTransactionSchema`, `orderSchema`, `orderStatusHistorySchema`, `refillSchema`, `dripFeedOrderSchema`, `subscriptionSchema`, `categorySchema`, `serviceSchema`, `servicePriceSchema`, `providerSchema`, `providerServiceSchema`, `paymentSchema`, `paymentWebhookSchema`, `apiKeySchema`, `apiLogSchema`, `couponSchema`, `couponRedemptionSchema`, `ticketSchema`, `ticketMessageSchema`, `notificationSchema`, `licenseStateSchema`, `settingsSchema`, `childPanelSchema`, `referralSchema`, `referralCommissionSchema`, `payoutRequestSchema`, `auditLogSchema`, `systemLogSchema`, plus all `license*Schema` / `productVersionSchema` / `licenseAuditLogSchema` for the platform.

## @smm/utils

Money helpers over decimal.js (`MONEY_DECIMALS = 4`): `amount`, `add`, `sub`, `mul`, `div` (return `Decimal`), `toFixed`, `roundMoney`, `gte`, `isPositive`, `toNumber`.

IDs and helpers: `publicId(prefix)` → `{prefix}-{nanoid16}`; `randomToken`, `randomCode`, `shortId`; `normalizeDomain`, `isValidDomain`, `isValidEmail`, `isValidLink`, `isValidObjectId`, `maskSecret` (`ab****yz`), `toQueryString`, `sanitizeText`, `slugify`, `simpleHash`.

## @smm/validation

Zod schemas (all lowercase, camelCase fields): `objectIdSchema`, `emailSchema`, `passwordSchema` (8–128), `usernameSchema` (3–32), `linkSchema`, `paginationSchema`, `registerSchema`, `loginSchema`, `changePasswordSchema`, `resetPasswordSchema`, `createOrderSchema`, `createMassOrderSchema`, `createRefillSchema`, `cancelOrderSchema`, `createDripFeedSchema`, `createSubscriptionSchema`, `createDepositSchema`, `createManualPaymentSchema`, `createApiKeySchema`, `createTicketSchema`, `replyTicketSchema`, `createCouponSchema`, `createProviderSchema`, `createServiceSchema`, `adminAdjustBalanceSchema`, `applyCouponSchema`, `licenseActivateSchema`, `licenseValidateSchema`, `licenseHeartbeatSchema`, `licenseClientSchema`, `licenseCreateSchema`.

## @smm/ui

Empty — planned shared UI kit (React + Tailwind) for `apps/web` and `apps/license-admin`.
