# License system

The product is licensed & resellable: every installed panel can only serve traffic when it holds a valid license from the **central license platform**. This document splits into (A) the panel-side license client (implemented in `apps/api`) and (B) the central platform (planned: `apps/license-api` + `apps/license-admin`, whose schemas already exist).

## A. Panel license client (`apps/api/src/modules/license/`)

### Configuration

| Env                     | Meaning                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| `LICENSE_SERVER_URL`    | base URL of the central platform (e.g. `https://license.example.com`) |
| `INSTALLATION_ID`       | unique id for this panel instance (used in every request)             |
| `LICENSE_SHARED_SECRET` | HMAC key shared with the platform; signs every request                |
| `LICENSE_GRACE_SECONDS` | offline tolerance; default `86400` (24h)                              |
| `APP_URL`               | panel origin sent as the license `domain`                             |

`LicenseService` (global) implements `OnApplicationBootstrap`: on boot it validates once and enqueues a periodic heartbeat.

### Local state

`LicenseState` (collection `license_state`, DB `smm_panel`), one doc keyed by `installationId` (unique):

- `status` (one of `trial, active, active_expired, inactive, suspended, revoked, expired, waiting`), `licenseType`, `domain`
- `activatedAt`, `expiresAt`, `lastValidatedAt`, `nextValidationAt`, `graceUntil`
- `signedAuthorization` (platform-signed payload), `validityToken`, `version`, `licenseId`, `licenseKeyHint`

### Validation & activation

- **Validate** (`validate()`): POST `${LICENSE_SERVER_URL}/api/v1/licenses/validate` with body `{ installationId, domain }` and header `x-license-signature: hmacSign(JSON.stringify(body), LICENSE_SHARED_SECRET)` (HMAC-SHA256 hex). 8s timeout (`timeoutSignal` AbortController helper). On 2xx, upsert `LicenseState` from the response; sets a re-validation cadence (6h for trial, 24h otherwise).
- **Activate** (`setActivation({ licenseKey, domain })`): POST `.../licenses/activate` with the same signing; stores a masked `licenseKeyHint` and the returned state.
- **Validate-on-boot**: `onApplicationBootstrap` runs `validate()`, and `enqueueHeartbeat()` schedules `license-heartbeat` on the `license` queue (`QUEUE_LICENSE`) so the panel self-revalidates without user traffic.
- **Unreachable server**: `handleUnreachable()` implements offline grace — state remains licensed until `graceUntil` (`lastValidatedAt + LICENSE_GRACE_SECONDS`), after which `isLicensed()` reports expired.

### Enforcement

- `isLicensed(): { licensed, status }` — returns `licensed: true` when **`LICENSE_SERVER_URL` is unset** (dev mode), otherwise 72h-grace-aware:
  - if now > `graceUntil` → not licensed;
  - else licensed iff `status ∈ { active, trial }` (and additional `active_expired` handling in the platform's returned state).
- **LicenseGuard** is an `APP_GUARD` (all routes, after JWT+permissions): skips `@Public()` routes; otherwise if `!licensed` → `403 ForbiddenException("Panel license is not active (<status>)")`.
- **Public license endpoints** (all `@Public()`):
  - `GET /license/status` — local `getState()`
  - `POST /license/activate` — `{ licenseKey, domain, installationId, version? }`
  - `POST /license/validate` — trigger a validation run

## B. Central license platform (planned)

Schemas already shipped in `@smm/database` (DB `smm_license`): `licenses`, `license_installations`, `license_activations`, `license_validations`, `license_events`, `license_products`, `license_clients`, `license_admins`, `product_versions`, `license_audit_logs`.

### Endpoint contract the panel expects

| Method | Path                         | Request (signed)                                   | Response                                                                                                        |
| ------ | ---------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/licenses/validate`  | `{ installationId, domain }`                       | `{ valid, status, licenseId, installationId, expiresAt, nextValidationAt, signedAuthorization, validityToken }` |
| POST   | `/api/v1/licenses/activate`  | `{ licenseKey, domain, installationId, version? }` | `{ activated, status, ...state }`                                                                               |
| POST   | `/api/v1/licenses/heartbeat` | `{ installationId, licenseKey? }`                  | same as validate                                                                                                |

### Platform behavior draft

1. Validate `x-license-signature` (HMAC compare, constant-time) and look up `licenseKeyHash = hashKey(licenseKey)`.
2. Enforce: license status `active`/`trial`; not expired; `domain` matches or is `*`; `activationLimit`/`maxInstallations` respected on activation; domain changes recorded in `domainHistory` and emit `LicenseEvent` (`domain_changed`, `INVALID_VALIDATION`, `INSTALLATION_MISMATCH`...).
3. Update `lastValidatedAt`, `LicenseInstallation.lastHeartbeatAt`; append `LicenseValidation` (TTL 90d) and `LicenseEvent`.
4. Return a platform-signed `signedAuthorization` (a JWT over `{ installationId, status, expiry }`) so the panel can prove validity in its own audit trail.
5. Admin (`apps/license-admin` + `apps/license-api` admin routes): manage products, clients, licenses (create/mask key/activate-limit/revoke/suspend), view activations/validations/events/audit.

### Security model

- Ever-paired secrets: platform stores only `licenseKeyHash`; panels only send `licenseKey` at activation; subsequent traffic uses `installationId` + signature.
- Every state-changing action writes a `LicenseEvent`; admin actions write `LicenseAuditLog`.
- Validation attempts are rate-limited (TTL docs) to blunt brute force; `LicenseActivation` tracks failures + error codes.
- Key generation: `@smm/security.generateApiKey`-style generation or a dedicated `SMM-XXXX-XXXX-XXXX` format; masked display `SMM-XXXX-****-****`.

## Panel go-live sequence

1. Operator sets `LICENSE_SERVER_URL`, `INSTALLATION_ID`, `LICENSE_SHARED_SECRET`, `APP_URL`.
2. Platform admin creates a license for the client (status `generated`), shares the raw key out-of-band.
3. Panel: `POST /license/activate` with the key → stored state `active`, heartbeat scheduled.
4. Panel revalidates every 6–24h and on boot; license expiry/suspension/revocation is pushed via validate responses and mirrored locally.

## Unlicensed behavior

`LicenseGuard` (all non-`@Public()` routes) returns 403 when not licensed, so the storefront and admin surfaces are unusable — activation is only possible through the public `/license/*` routes and `/health`/`/ready`.
