# Authentication & authorization

## Identity model

Users live in `users`. `status` gates login: `active` only; `suspended`/`banned` are rejected with `UNAUTHORIZED`. Roles (`UserRole`) and a permission system (metdata-based `@RequirePermissions`) control authorization. An optional `UserGroup` can attach group-level markup; `User.flags.apiAccess` and `ApiKey` records control third-party API access.

## Password

- Hashed with bcrypt 12 rounds at registration and on every password change/reset (`@smm/security` `hashPassword`).
- `changePassword` verifies `currentPassword` first.
- Lockout: after **5 consecutive failed logins** the account is locked for **15 minutes** (`lockedUntil`), then `failedLoginAttempts` resets.
- `verifyPassword` returns false when no hash exists (no user-confirmation oracle).

## Registration flow

`POST /auth/register` (public):

1. Validate via zod `registerSchema`.
2. Check email/username uniqueness.
3. Create user with `status: active`, `role: user`, `referralCode` from `publicId("REF")` (uppercased).
4. If a valid `referralCode` is provided, set `user.referredBy` and link a `Referral` document.
5. Create the `Wallet` (balance 0, USD).
6. Return `{userId, email}` — no session yet; the client logs in.

## Login & tokens

`POST /auth/login` → `{ accessToken, refreshToken, expiresIn }`.

- Access token: JWT signed with `JWT_SECRET`, `expiresIn = JWT_ACCESS_TTL` (default 1d), payload `{ sub, role, type: "access", ... }`, issuer `smm-panel`.
- Refresh token: `type: "refresh"`, `expiresIn = JWT_REFRESH_TTL` (default 30d).
- `POST /auth/refresh` verifies the refresh token and that `payload.type === "refresh"`, then issues a new pair.

## Guard stack (global)

Registered via `APP_GUARD` providers; execution order = registration order:

1. **JwtAuthGuard** — if the route is `@Public()` (metadata `IS_PUBLIC_KEY`) → allow. Otherwise require `Authorization: Bearer <token>`, verify with `JWT_SECRET`, require `payload.type === "access"`. On success sets `request.user = { id: payload.sub, role: payload.role, payload }`. On failure returns 403 (deny).
2. **PermissionsGuard** — if no `@RequirePermissions(...)` on the handler/class → allow. If `role` is `super_admin` or `admin` → allow. Otherwise require every permission to be present in `request.user.permissions` (or `payload.permissions`); else 403 `Insufficient permissions`.
3. **LicenseGuard** — skip when `@Public()` or when `LICENSE_SERVER_URL` is unset; otherwise require a valid local license state; else 403.

`@Public()` opts a route out of JWT (and, transitively, permissions and license checking is still skipped for it by LicenseGuard because it honors the same flag).

## Permissions

Declarative: `@RequirePermissions("users.edit", "orders.manage")`. The permission strings are free-form but follow `resource.action` (see [types](PACKAGES.md) `UserApiPermission` for the API-key flavor). Roles/permissions are currently enforced via `user.role` plus `payload.permissions`; the `roles`/`permissions` collections exist in `@smm/database` for a future dynamic role engine.

Admin roles set: `super_admin, admin, finance_manager, support_agent, service_manager` (exported as `ADMIN_ROLES`).

## Third-party API keys

Users create API keys through `POST /api-keys` (JWT-authenticated):

- `createApiKeySchema`: `{ name, permissions[], ipRestrictions[] }` (max 10 IP CIDRs).
- Default permissions: `["services.view","orders.create","orders.view","balance.view"]`.
- `@smm/security.generateApiKey()` returns `keyId` (`smm_...`), `secret` (`sk_...`) shown **once**, and `keyHash` (`hashKey(secret)`, HMAC-SHA256 with a static key — meant to be an indexed, non-reversible value).
- Stored: `ApiKey { keyId, userId, name, keyHash, permissions, ipRestrictions, enabled }`.

Public integration routes (`POST /order`, `GET /order/:orderId`, `POST /cancel`, `POST /refill`, `GET /balance`) are marked `@Public()` + `@UseGuards(ApiKeyAuthGuard)`.

**ApiKeyAuthGuard** validates `X-API-Key`:

1. `hashKey(secret)` → lookup `{ keyHash, enabled: true }`.
2. If `ipRestrictions` is non-empty, require the request IP to match one of them (ClientRequest IP, CIDR check).
3. Attach `request.user = { id, role: "user", permissions, apiKeyId }` and `request.apiKey`.
4. The service layer maps key permissions onto operations; `apiCreateOrder` forces `orderType: "api"` and stamps `apiKeyId` on the order.
5. `UserApiService.log(...)` records an `ApiLog` entry (endpoint, method, status, ip, requestId, duration) after each call — a `requestId`-scoped audit trail.

## Known limitations (resolve via ROADMAP)

- JWT fallback secret in `AuthModule` (`process.env.JWT_SECRET ?? "change-me-in-production"`) — always set `JWT_SECRET` in real deployments; `loadConfig` enforces it in production.
- `JwtAuthGuard` returns `false` (403) instead of `UnauthorizedException` (401) on missing/invalid tokens — consider aligning to 401 for dashboard routes.
- In-memory password-reset tokens are held on the user document with a 1h expiry — a future worker should email the token (SMTP env vars exist) and the ideal design stores only a hashed token.
- API keys are plaintext-only at creation; no rotation UI yet.
- Rate limiting (`RATE_LIMIT_*` envs, `@nestjs/throttler` dependency) is declared but not wired. Bind `ThrottlerGuard` before login/register and the public API-key routes.
