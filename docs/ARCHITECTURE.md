# Architecture

## System overview

The product is a **resellable SMM panel**: panel operators install a copy of the customer panel for each end customer, while a **central license platform** controls activation, entitlements and subscription renewals. Every installed panel must present a valid license to serve traffic.

Three processing tiers:

1. **Customer panel API** (`apps/api`, NestJS) — the only implemented tier. Serves the storefront API, user wallets, order/drip/subscription lifecycle, payments, tickets, API keys for third-party integrators, and the license client.
2. **Job workers** (`apps/worker`, planned) — BullMQ consumers for the 12 queues. The API enqueues jobs; the worker executes provider submissions, status checks, refills, drip runs, heartbeat and cleanup.
3. **License platform** (`apps/license-api` + `apps/license-admin`, planned) — central activation/validation service and admin UI. The license client in the panel calls it over authenticated HTTPS.

## Tech stack

| Layer              | Choice                                                               |
| ------------------ | -------------------------------------------------------------------- |
| Language           | TypeScript 5.7, strict mode                                          |
| API framework      | NestJS 10 (Express adapter), class-validator + class-transformer     |
| Validation package | zod (`@smm/validation`), used at service boundaries                  |
| Database           | MongoDB via Mongoose 8; two logical DBs (`smm_panel`, `smm_license`) |
| Queues             | BullMQ 5 on Redis                                                    |
| Money math         | decimal.js (`@smm/utils`); never raw floats                          |
| Logging            | pino (`@smm/logger`), ISO timestamps, built-in redaction             |
| Build/run          | npm workspaces + Turbo 2; CJS output                                 |
| Schedule/leases    | BullMQ delayed jobs + `removeOnComplete.age` retention               |

## Process model

```
                    ┌──────────────────────────────┐
   browser/id-api → │  apps/api  (NestJS, stateless)│──→ MongoDB smm_panel
                    │  global prefix /api/v1        │──→ Redis (queues)
                    └──────────────┬───────────────┘
                                   │ enqueue
                    ┌──────────────▼───────────────┐     ┌──────────────────┐
                    │  apps/worker (BullMQ workers)│────▶│ provider API     │
                    │  planned                     │     │ (generic/fake)   │
                    └──────────────┬───────────────┘     └──────────────────┘
                                   │ HTTPS + HMAC
                    ┌──────────────▼───────────────┐     ┌──────────────────┐
                    │  apps/license-api (planned)  │────▶│ MongoDB smm_license│
                    └──────────────┬───────────────┘     └──────────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  apps/license-admin (planned)│
                    └──────────────────────────────┘
```

The API talks to MongoDB, Redis and (for the license client) the license platform. It is horizontally scalable behind nginx. The worker is deployed as a separate long-running process.

## Request lifecycle (customer API)

1. Express request arrives; `helmet()` sets security headers; CORS limited to `APP_URL`.
2. `RequestIdMiddleware` (`SettingsModule.configure`) derives/sets `x-request-id` on request and response (currently registered only for settings-declared module wiring — see ROADMAP).
3. Global prefix `/api/v1` applies except `health`/`ready`, which stay at `/health` and `/ready`.
4. Global pipes: `ValidationPipe({ whitelist: true, transform: true })` validates controller DTOs.
5. Global guards run in registration order:
   - `JwtAuthGuard` — reads the Bearer token, verifies `type === "access"`, attaches `request.user = { id, role, payload }`, skips `@Public()`.
   - `PermissionsGuard` — short-circuits unless `@RequirePermissions(...)` is present; super_admin/admin bypass; throws 403 otherwise.
   - `LicenseGuard` — skips `@Public()` routes; otherwise blocks the request when the panel license is not valid (`ForbiddenException`) unless the panel runs without a configured `LICENSE_SERVER_URL`.
6. `@Public()` + `@UseGuards(ApiKeyAuthGuard)` routes authenticate third-party integrators via `X-API-Key`.
7. Controllers call services; services write to Mongoose models (documents are persisted through the shared schema registry) and enqueue BullMQ jobs for background work.
8. `AllExceptionsFilter` converts every error to the canonical `ApiError` envelope with a `requestId`; unknown errors become 500 `INTERNAL_ERROR` and are logged with stack.

## Module graph (apps/api)

All modules are `@Global()` **except** `OrdersModule` and `SettingsModule`. `OrdersModule` is imported explicitly by `UserApiModule`; `SettingsModule` is standalone.

```
AppModule
├── ConfigModule (global)
├── MongooseModule.forRoot(db smm_panel)
├── EventEmitterModule.forRoot()
├── HealthModule         // REDIS_CLIENT provider (ioredis, lazy), /health /ready
├── QueueModule.configure({ connectionUrl })  // 12 BullMQ queue providers
├── AuthModule           // JwtModule, AuthService, JwtAuthGuard + PermissionsGuard as APP_GUARD
├── UsersModule          // User, UserGroup
├── SettingsModule       // Settings + RequestIdMiddleware
├── WalletModule         // WalletService (ledger)
├── ServicesModule       // pricing engine
├── ProvidersModule      // ProviderFactory + adapters
├── OrdersModule         // NOT global; order submit/status/cancel
├── PaymentsModule       // deposits + webhooks
├── RefillsModule        // refill create/process
├── DripFeedModule       // drip orders
├── SubscriptionsModule  // recurring subscriptions
├── CouponsModule
├── TicketsModule
├── NotificationsModule
├── ReferralsModule      // commissions
├── UserApiModule        // imports OrdersModule; third-party API + key management
├── LicenseModule        // LicenseService + LicenseGuard (APP_GUARD)
└── AdminModule          // dashboard + balance adjustments
```

Global guards are contributed by two modules: `JwtAuthGuard` + `PermissionsGuard` (AuthModule) and `LicenseGuard` (LicenseModule). Because APP_GUARD ordering follows provider registration, the effective order is JWT → Permissions → License, all honoring `@Public()`.

## Cross-cutting decisions

- **Money**: every monetary value is a Decimal internally (`@smm/utils`); stored as number in MongoDB; 4-decimal precision helpers, `roundMoney` at 2 places for display. Never sum floats.
- **IDs**: public-facing IDs are `{prefix}-{nanoid16}` (`ORD-…`, `REF-…`, `DRP-…`, `SUB-…`, `PAY-…`); Mongo `_id`s stay private.
- **Ledger**: wallet `debit`/`credit` are optimistic-concurrency single-document updates with an immutable `WalletTransaction` record — no two-phase commit across documents.
- **Idempotency**: orders accept an `idempotencyKey` (unique sparse index); payment webhooks dedupe on unique `{gateway, eventId}`; balance adjustments and payment approvals are guarded against double-credit.
- **Errors**: one response envelope (`ApiError`), one code vocabulary, `requestId` then-correlated in logs.
- **Security**: bcrypt(12) for passwords, AES-256-GCM at-rest for provider secrets, HMAC-SHA256 for license signatures and provider request signing, keyed hashing for API keys. See [SECURITY.md](SECURITY.md).

## What is not yet implemented

Worker processes, the web panel, the license platform, shared UI kit, seeding, concrete deployment manifests and rate limiting are planned. Details and sequencing are in [ROADMAP.md](ROADMAP.md).
