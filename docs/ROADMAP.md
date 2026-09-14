# Roadmap

State of the project and sequencing for the remaining build-out.

## Implemented & verified

- **Monorepo**: npm workspaces + Turbo, `typecheck`/`build` green across all 8 packages and `@smm/api`; API boots with DI resolved; `/ready`, `/health` (degraded when Redis down), Swagger at `/api/docs`.
- **Packages**: `config`, `database` (all schemas + both DBs), `logger` (pino + Nest adapter), `security` (crypto primitives), `types` (full enum set), `utils` (decimal money + IDs + validation helpers), `validation` (zod for every domain).
- **API modules**: auth, users, settings, wallet (ledger), services (pricing), providers (adapters + factory + health), orders (submit/status/cancel + idempotency + refunds), payments (manual approve/reject + webhook idempotency), refills, drip-feed, subscriptions, coupons, tickets, notifications, referrals, user-api (third-party keys + public endpoints), license (client + guard), admin (dashboard/adjustments), queue (12 BullMQ queues), health (`/health` `/ready` + Redis provider).
- **Verification hooks**: mongoose TTL indexes, unique idempotency indexes, optimistic wallet concurrency.

## Missing / broken right now

| Item                         | Detail                                                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/worker`                | Empty dir. No consumers for the 12 queues — submitted orders never reach a provider, statuses never poll, license heartbeat never runs. **Highest priority.**    |
| `apps/web`                   | Empty dir. Customer-panel UI (Next.js) not started.                                                                                                              |
| `apps/license-api`           | Empty dir. No central server to validate/activate against — `LICENSE_SERVER_URL` must stay unset (dev mode).                                                     |
| `apps/license-admin`         | Empty dir. No license-platform admin UI.                                                                                                                         |
| `packages/ui`                | Empty package (no manifest, no src).                                                                                                                             |
| Seed                         | `npm run seed` → missing `apps/api/scripts/seed.ts`. Nothing creates the initial admin, categories, providers, or settings.                                      |
| Rate limiting                | `@nestjs/throttler` + `RATE_LIMIT_*` envs declared but not wired.                                                                                                |
| Request-ID middleware        | Only integrated through `SettingsModule.configure`; other flows rely on the filter fallback. Wire it globally (bootstrap) so every log line carries a requestId. |
| Tests                        | vitest/supertest declared; no suites written yet (see [TESTING.md](TESTING.md)).                                                                                 |
| Deploy                       | `deploy/` empty; no Docker/ncompose/nginx/env-example.                                                                                                           |
| Status enforcement           | `JwtAuthGuard` denies with 403 rather than 401; account `status` only checked at login, not per-request.                                                         |
| Gateway integrations         | Stripe/Razorpay/PayPal flagged `enabled: false`; only manual/UPI deposits work.                                                                                  |
| Password reset email         | Tokens stored in plaintext on the user doc; no SMTP send (worker email queue).                                                                                   |
| Provider credential rotation | No UI/flow to rotate encrypted secrets.                                                                                                                          |

## Prioritized milestones

### M1 — Worker (next)

- Implement `apps/worker` per the contract in [QUEUES.md](QUEUES.md): 12 processors, idempotent, BullMQ-V5 compatible, pino logging, graceful shutdown.
- Wire `provider-sync`, `subscription-processing`, `email` (password-reset links), `notifications`, `reports`, `cleanup` producers that today only exist as queues.
- Controller tests + worker idempotency tests (FakeProviderAdapter).
- Gate: an end-to-end order completes `pending → processing → completed` on a running stack.

### M2 — Seed, hardening, deployable

- Write `apps/api/scripts/seed.ts`: super-admin, default categories, FakeProviderAdapter provider + services, baseline settings.
- Global request-id middleware; ThrottlerGuard binding (login/register/API-key routes); align 403→401 for protected routes.
- `.env.example` per app; Dockerfiles + `deploy/docker-compose.yml` (api, worker, mongo, redis, nginx); `/ready` healthchecks.
- Seed + test suites focusing on wallet/orders/payments ([TESTING.md](TESTING.md)).

### M3 — Web panel

- `packages/ui` shared kit (React + Tailwind), then `apps/web` (Next.js; per repo AGENTS.md, this Next version differs from classic Next — read `node_modules/next/dist/docs/` before coding; params/searchParams are async Promises; middleware lives in `proxy.ts`).
- Pages: auth, storefront (services/categories), order placement + status, orders history, wallet (deposit/ledger), drip-feed/subscriptions, tickets, notifications, API keys, settings/admin dashboards.
- API consumer via `@smm/client`-style fetch wrapper shared with `@smm/ui`.

### M4 — License platform

- `apps/license-api`: implement the endpoint contract in [LICENSE-SYSTEM.md](LICENSE-SYSTEM.md) (validate/activate/heartbeat + admin CRUD) on DB `smm_license`; HMAC + licenseKeyHash handling; event/validation/audit logging.
- `apps/license-admin`: product/client/license management UI + activation/validation viewer.
- Panel↔platform integration test in CI with a real `LICENSE_SERVER_URL`.

### M5 — Payments & scale

- Gateway worker for Stripe/Razorpay/PayPal (`payments` queue): create intents, consume webhooks, per-gateway signature verification.
- Caching/pricing performance pass; CDN-friendly catalog responses behind license gate.

## Guiding principles for the build-out

- Money and state mutations stay server-side via `WalletService`/ledger and idempotent processors.
- The worker never imports NestJS controllers; shared domain logic lives in packages or plain processor modules.
- Public API surfaces keep the single envelope/error contract.
- Everything new ships with at least the targeted tests from [TESTING.md](TESTING.md).
