# Testing strategy

Test tooling is `vitest` (unit/integration) + `supertest` (controller-level, declared as devDeps but no suites written yet). Runs via `npm test` (turbo `test`).

## Layers

| Layer               | Tool                           | Scope                                                                         |
| ------------------- | ------------------------------ | ----------------------------------------------------------------------------- |
| Package units       | vitest                         | `@smm/utils` money math, `@smm/security` crypto, `@smm/validation` schemas    |
| Service integration | vitest + real/hybrid Mongo     | wallet concurrency, order flow with FakeProviderAdapter, payments idempotency |
| HTTP                | supertest + Nest TestingModule | route→guard→service wiring, envelope shape                                    |
| Worker (planned)    | vitest                         | job processors (idempotency, retry, terminal states) using in-memory BullMQ   |
| E2E                 | vitest                         | full `register → deposit → order → status → refill` against local Mongo/Redis |

Decide a Mongo strategy: either `mongodb-memory-server` (isolated, slower cold start) or a dedicated `smm_panel_test` DB with per-suite cleanup. Prefer memory server for CI determinism; keep `REDIS_URL` pointing at a throwaway instance.

## Highest-value test areas

### 1. `@smm/utils` money

- `add/sub/mul/div` exactness, `roundMoney` half-up, `gte/isPositive` boundaries.
- `publicId` uniqueness + prefix, `normalizeDomain` (strip proto/www/port/path, lowercase), `isValidObjectId`.

### 2. `@smm/security`

- bcrypt round-trip; verify fails on wrong/empty hash.
- JWT sign/verify + expiry enforcement + issuer/type claims.
- HMAC sign/verify (constant-time path incl. length mismatch).
- `encryptSecret`/`decryptSecret` round-trip and bad-key errors.
- `hashKey` determinism; `generateApiKey` shape (`smm_…`/`sk_…`) and uniqueness.

### 3. `@smm/validation`

- Every schema: required/optional, bounds (quantity 1..10M, password 8..128, deposit ≤1M), enum membership, coercion of numeric strings, IP constraints in `createApiKeySchema`, email lowercasing.

### 4. Wallet concurrency (the correctness core)

- Concurrent `debit` for N orders against one wallet → total debited correctly, one `INSUFFICIENT_BALANCE` beyond balance.
- `credit`/`debit` each append exactly one ledger row with correct `balanceBefore/After`.
- Refund credited once; double-refund second call no-ops.

### 5. Order pipeline (use FakeProviderAdapter)

- Create → debit deducted, order persisted pending, `submit-order` enqueued.
- `submitToProvider` success → `processing`, `providerOrderId` set, `check-status` scheduled.
- Failure → `failed` + full refund.
- Idempotent second create with same `idempotencyKey` returns the same order, no second debit.
- `syncStatus` normalization table (complete/cancel/refund/partial/fail/progress/processing/pending variants).

### 6. Payments

- Manual deposit → admin approve credits once; re-approve no-ops.
- Webhook: duplicate `{gateway,eventId}` processed once; amount mismatch rejects; correct event credits the wallet.
- `admin` balance adjustment permissions + type restrictions.

### 7. Auth & guards

- Lockout after 5 failures; suspended/banned rejected.
- `@Public()` routes skip guards; guarded routes 403 without token; permissions matrix (`users.view` etc.).
- API-key routes: valid `X-API-Key` w/ perms, IP restriction deny/allow, revoked key rejected.

### 8. License client (contract tests)

- `validate`/`activate` HMAC headers correct; offline grace → `isLicensed` until `graceUntil`; license `suspended`/`revoked` → guard denies on non-public routes.
- Sign-off for the worker and license-platform teams.

## Fixtures

Seed factories (see ROADMAP seed milestone) that create: user+wallet, admin, provider (FakeProviderAdapter) + 3 services, category, order, coupon, ticket. Provide a `TestContext` helper covering `NestTestingModule` boot with `.env.test`.

## Envelope contract

Assert the `ApiError` shape on every 4xx/5xx: `{ success:false, error:{ code, message, details? }, requestId }` and `ApiSuccess`: `{ success:true, data }`. Write a shared assertion utility to enforce consistency across suites.

## CI

Turbo `test` runs after `build`; keep suites fast (< 60s) so CI stays snappy. Add a `test:cov` coverage threshold (aim: ≥70% package coverage, ≥60% apps/api) with `@vitest/coverage-v8`.

## Open items (tracked in ROADMAP)

- No suites exist yet; prioritize wallet/order/payments per above.
- `supertest` + TestingModule wiring helper to be created in `apps/api/test/`.
- Worker suites depend on the worker app being implemented.
