# Security

Threat model, controls, and remaining work. Controls live in `@smm/security` and are applied throughout `apps/api`.

## Trust boundaries

```
[Client] ──HTTPS──▶ [nginx] ──▶ [apps/api] ──▶ [MongoDB smm_panel]
                          │          │
                          │          └─▶ [Redis] (queues only)
                          │
                          ▼
                    [license-api] (central, HMAC)  ──▶ [MongoDB smm_license]
```

- The panel is a public-facing API. Login, registration and the third-party API-key routes are anonymous-entry; everything else requires context.
- Providers are untrusted upstreams: their responses are validated/coerced into typed results before touching domain state.
- The central license platform is mutually authenticated (panel↔platform via shared-secret HMAC).
- MongoDB and Redis are never exposed to clients — only the API process reaches them.

## Cryptographic primitives (`@smm/security`)

| Purpose                  | Mechanism                                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passwords                | bcrypt 12 rounds (`hashPassword`/`verifyPassword`)                                                                                                   |
| Sessions                 | JWT HS256 (`signJwt`/`verifyJwt`) with distinct access (`type:"access"`) and refresh (`type:"refresh"`) tokens; issuer `smm-panel`                   |
| At-rest provider secrets | AES-256-GCM (`encryptSecret`/`decryptSecret`), key from `ENCRYPTION_KEY` (64 hex chars), stored as `ivHex:tagHex:ciphertextHex` in `Provider.config` |
| License auth             | HMAC-SHA256 (`hmacSign`/`hmacVerify`), constant-time compare; header `x-license-signature`                                                           |
| Provider request signing | `apiSign(secret, body, timestamp)` — `hmacSign(\`${timestamp}.${body}\`)`, for adapters that require it                                              |
| API keys                 | `generateApiKey()` → `{keyId, secret, keyHash}`; DB stores `hashKey(secret)` only (indexed, non-reversible); secret shown once                       |
| Otp/tokens               | `generateOtp()` (6-digit), `randomSecret(bytes)` (base64url)                                                                                         |

## Input validation layering

1. Class-validator DTOs at the transport boundary (whitelist, transform).
2. zod schemas (`@smm/validation`) in service functions: quantity bounds `1..10M`, password `8..128`, username pattern, gateway enums, IP CIDRs for API keys, money ranges (`≤ 1M` deposits/order quantities), link length `8..2048`.
3. Cross-field invariants in services: coupon min-amount vs order total, refill eligibility on `completed|partial`, cancel only when `cancelSupported`, provider health gating.

Sensitive values (`password`, `apiKey`, secrets, tokens, authorization headers) are redacted by the pino logger's default `redact` paths (`[REDACTED]`).

## Session & access controls

- Login lockout: 5 failures → 15-min lock (`lockedUntil`); suspended/banned accounts rejected at login and every protected route via JWT claim rejection on login only — enforce status at request time for robustness.
- Global guard chain: `JwtAuthGuard` → `PermissionsGuard` → `LicenseGuard` (all honor `@Public()`).
- RBAC: `super_admin`/`admin` bypass; otherwise `@RequirePermissions(...)` checks `user.permissions`/`payload.permissions`.
- Third-party API keys: IP-restrictable (max 10 CIDRs), permission-scoped (default `services.view, orders.create, orders.view, balance.view`), revocable, logged per call (`ApiLog` TTL 30d).

## Transport hardening (in `main.ts`)

- `helmet()` sets security headers.
- CORS restricted to `APP_URL` (allowlist) with `credentials: true`.
- HTTPS termination at nginx (TLS 1.2+/1.3); see [DEPLOYMENT.md](DEPLOYMENT.md).
- Global prefix `/api/v1`; Swagger only outside production.
- `x-request-id` propagated for correlation (see ROADMAP for middleware coverage).

## Money & integrity invariants

- All balance changes via `WalletService` atomic guarded updates (`findOneAndUpdate` + balance guard); ledger rows are immutable.
- Payment approvals and webhooks: exactly-once credit (status flip + unique `{gateway,eventId}`).
- Order creation: idempotency key (sparse unique), wallet debit before order persist.
- Amounts compared with Decimal; webhook amount matched within `0.001`.
- Admin balance adjustment restricted to `manual_credit`/`manual_debit` and `admin.finance` permission.

## Secrets management guidance

- Always set `JWT_SECRET` (≥32 chars) in production (enforced by `loadConfig`).
- `ENCRYPTION_KEY`: 64 hex chars, generated once per environment; rotating requires re-encrypting provider secrets.
- `LICENSE_SHARED_SECRET`: per-panel random; deliver out-of-band with the license key.
- Provider API keys typed via `X-API-Key`/body/query per `authStyle`; stored encrypted, never returned (`findAll()` strips `config`).
- No secrets in logs, env dumps, or image layers; .env is gitignored.

## Known gaps (see ROADMAP)

- Rate limiting (`RATE_LIMIT_*` + `@nestjs/throttler`) declared but **not wired**; bind `ThrottlerGuard` on login/register and API-key routes.
- `JwtAuthGuard` returns 403 (deny) rather than 401 on invalid token — inconsistent with REST conventions.
- Password-reset tokens stored in plaintext on the user doc (1h expiry); prefer storing hashes and emailing via the worker.
- No CSRF concerns for bearer-API, but consider SameSite+Secure cookies if a web client stores tokens in cookies.
- Webhook signature verification is simplified (single-shared signature); per-gateway verification must be strict in the gateway-integration milestone.
- `@nestjs/throttler` dep unused; `RequestIdMiddleware` only wired via SettingsModule so request IDs are generated by the exception filter fallback elsewhere.
- Worker/web/UI shipping secrets (e.g. SMTP creds) must follow the same redaction rules (`@smm/logger`).
