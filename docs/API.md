# API conventions

Base URL: `https://<host>/api/v1` (global prefix set in `main.ts`; `health` and `ready` are **excluded** and served at `/health` and `/ready`).

Swagger (non-production only): `/api/docs` (UI) and `/api/docs-json`.

## Response envelopes

Every non-error response is `{ success: true, data: ... }`. The `auth` controller uses the shared `ok(data, requestId)` helper; most modules hand-roll the same shape. Successful responses include a `requestId` when the `RequestIdMiddleware` has set one (see ROADMAP for uniform coverage).

Errors all convert to:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "details": { "fields": ["quantity"] }
  },
  "requestId": "9f5c-..."
}
```

Code vocabulary (from `AllExceptionsFilter`): `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `BAD_REQUEST`, `CONFLICT`, `INSUFFICIENT_BALANCE`, `INTERNAL_ERROR`, and `PAYLOAD_TOO_LARGE`/`TOO_MANY_REQUESTS` where applicable. `requestId` is read from the `x-request-id` header, then `request.requestId`, then a fresh UUID; it is echoed on the error response so logs can be correlated.

## Authentication — two audiences

1. **Dashboard / admin users**: `Authorization: Bearer <accessToken>`. Exercised by the global `JwtAuthGuard` (skipped on `@Public()` routes) and `PermissionsGuard` (`@RequirePermissions("users.view")` etc.). See [AUTH.md](AUTH.md).
2. **Third-party integrators** (storefront API): `X-API-Key: <secret>`. Exercised by `@Public()` + `@UseGuards(ApiKeyAuthGuard)` routes. API keys carry permissions scoping what the key may do.

`CurrentUser` param decorator exposes `request.user` (`{ id, role, permissions?, email? }`).

## Pagination

List endpoints accept `page` (≥1) and `pageSize` (1–100) query params and return `meta`:

```json
{
  "items": [],
  "meta": { "page": 1, "pageSize": 20, "total": 42, "totalPages": 3 }
}
```

## Route map (global prefix `/api/v1`)

Unauthenticated:** & specified with `@Public()`.

| Method                          | Path                         | Guard  | Permission       | Notes                                            |
| ------------------------------- | ---------------------------- | ------ | ---------------- | ------------------------------------------------ |
| POST                            | /auth/register               | Public |                  | register user                                    |
| POST                            | /auth/login                  | Public |                  | login                                            |
| POST                            | /auth/refresh                | Public |                  | refresh token                                    |
| POST                            | /auth/forgot-password        | Public |                  | always `{ok:true}`                               |
| POST                            | /auth/reset-password         | Public |                  |                                                  |
| POST                            | /auth/change-password        | JWT    |                  |                                                  |
| GET                             | /auth/me                     | JWT    |                  | user + wallet balance                            |
| POST                            | /auth/logout                 | JWT    |                  | no-op `{ok:true}`                                |
| GET                             | /services/categories         | Public |                  |                                                  |
| GET                             | /services                    | Public |                  | catalog                                          |
| GET                             | /services/:id/price          | JWT    |                  | server-side estimate w/ user price               |
| POST                            | /services                    | JWT    | services.manage  |                                                  |
| PATCH                           | /services/:id                | JWT    | services.manage  |                                                  |
| GET                             | /services/admin/all          | JWT    | services.manage  |                                                  |
| POST                            | /services/prices             | JWT    | services.manage  | custom/group pricing                             |
| POST                            | /providers                   | JWT    | providers.manage | create provider                                  |
| GET                             | /providers                   | Public |                  |                                                  |
| POST                            | /providers/:id/sync          | JWT    | providers.manage | pull provider services                           |
| POST                            | /providers/:id/balance       | JWT    | providers.manage |                                                  |
| POST                            | /providers/:id/test          | JWT    | providers.manage |                                                  |
| GET                             | /providers/:id/services      | JWT    | providers.manage |                                                  |
| POST                            | /orders                      | JWT    |                  | creates order                                    |
| GET                             | /orders/my                   | JWT    |                  |                                                  |
| GET                             | /orders/my/:id               | JWT    |                  |                                                  |
| GET                             | /orders/estimate             | JWT    |                  | `?serviceId&quantity`                            |
| POST                            | /orders/my/:id/cancel        | JWT    |                  |                                                  |
| GET                             | /orders/admin/all            | JWT    | orders.manage    |                                                  |
| POST                            | /payments/deposit            | JWT    |                  | initiate manual or gateway deposit               |
| POST                            | /payments/manual             | JWT    |                  | submit manual payment w/ proof                   |
| POST                            | /payments/admin/:id/approve  | JWT    | payments.approve | credits wallet once                              |
| POST                            | /payments/admin/:id/reject   | JWT    | payments.approve |                                                  |
| POST                            | /payments/webhook/:gateway   | Public |                  | provider-recommended creds sent via headers      |
| GET                             | /payments/my                 | JWT    |                  |                                                  |
| GET                             | /payments/admin/all          | JWT    | payments.view    |                                                  |
| POST                            | /refills                     | JWT    |                  | create refill for completed/partial order        |
| GET                             | /refills/my                  | JWT    |                  |                                                  |
| POST                            | /drip-feed                   | JWT    |                  |                                                  |
| GET                             | /drip-feed/my                | JWT    |                  |                                                  |
| PATCH                           | /drip-feed/:id/pause         | JWT    |                  |                                                  |
| PATCH                           | /drip-feed/:id/resume        | JWT    |                  |                                                  |
| POST                            | /subscriptions               | JWT    |                  |                                                  |
| GET                             | /subscriptions/my            | JWT    |                  |                                                  |
| PATCH                           | /subscriptions/:id/:status   | JWT    |                  | active/paused/canceled                           |
| POST                            | /coupons                     | JWT    | coupons.manage   |                                                  |
| GET                             | /coupons                     | JWT    | coupons.manage   |                                                  |
| PATCH                           | /coupons/:id/status          | JWT    | coupons.manage   |                                                  |
| POST                            | /tickets                     | JWT    |                  | create ticket                                    |
| GET                             | /tickets/my                  | JWT    |                  |                                                  |
| GET                             | /tickets/my/:id              | JWT    |                  | ticket + messages                                |
| POST                            | /tickets/my/:id/reply        | JWT    |                  |                                                  |
| POST                            | /tickets/my/:id/close        | JWT    |                  |                                                  |
| GET                             | /tickets/admin/all           | JWT    | tickets.view     |                                                  |
| POST                            | /tickets/admin/:id/reply     | JWT    | tickets.manage   | may be internal                                  |
| GET                             | /notifications/my            | JWT    |                  | includes `unread` count                          |
| PATCH                           | /notifications/read/:id      | JWT    |                  |                                                  |
| POST                            | /notifications/read-all      | JWT    |                  |                                                  |
| GET                             | /referrals/my                | JWT    |                  |                                                  |
| GET                             | /referrals/commission        | JWT    |                  |                                                  |
| GET                             | /wallet                      | JWT    |                  | balance                                          |
| GET                             | /wallet/transactions         | JWT    |                  | ledger, paginated                                |
| POST                            | /users                       | JWT    | users.edit       | create admin user                                |
| GET                             | /users                       | JWT    | users.view       | list w/ balances                                 |
| GET                             | /users/:id                   | JWT    | users.view       |                                                  |
| PATCH                           | /users/:id/status            | JWT    | users.edit       | active/suspended/banned                          |
| PATCH                           | /users/:id/reset-password    | JWT    | users.edit       |                                                  |
| GET                             | /settings/public             | Public |                  | general/payments/appearance/orders/announcements |
| GET                             | /settings                    | JWT    | settings.manage  |                                                  |
| PATCH                           | /settings                    | JWT    | settings.manage  |                                                  |
| GET                             | /settings/:key               | JWT    |                  |                                                  |
| GET                             | /admin/dashboard             | JWT    | admin.dashboard  |                                                  |
| GET                             | /admin/revenue               | JWT    | admin.dashboard  | daily aggregations                               |
| GET                             | /admin/orders-by-status      | JWT    | admin.dashboard  |                                                  |
| POST                            | /admin/users/:userId/balance | JWT    | admin.finance    | manual credit/debit                              |
| GET                             | /license/status              | Public |                  | local license state                              |
| POST                            | /license/activate            | Public |                  | activate with key                                |
| POST                            | /license/validate            | Public |                  | force validation                                 |
| **Third-party API** (X-API-Key) |                              |        |                  |                                                  |
| POST                            | /order                       | ApiKey | key perms        | body uses `service` field                        |
| GET                             | /order/:orderId              | ApiKey | orders.view      |                                                  |
| POST                            | /cancel                      | ApiKey | orders.cancel    |                                                  |
| POST                            | /refill                      | ApiKey | orders.refill    |                                                  |
| GET                             | /balance                     | ApiKey | balance.view     |                                                  |
| **API-key management** (JWT)    |                              |        |                  |                                                  |
| POST                            | /api-keys                    | JWT    |                  | returns secret once                              |
| GET                             | /api-keys                    | JWT    |                  |                                                  |
| POST                            | /api-keys/:keyId/revoke      | JWT    |                  |                                                  |
| **Unprefixed**                  |                              |        |                  |                                                  |
| GET                             | /health                      | Public |                  | mongo+redis check                                |
| GET                             | /ready                       | Public |                  | mongo-only readiness                             |

Note `orders` and `order` (third-party) are distinct routes; `UserApiController` deliberately uses an empty controller path and only defines the public integration endpoints plus `api-keys` management so there are no prefix conflicts.

## Versioning

Version is fixed at `v1` in the global prefix. Breaking changes bump the prefix (`/api/v2`) rather than breaking envelope/error conventions.

## Validation

- Controller DTOs (class-validator) whitelist incoming bodies (`forbidNonWhitelisted: false`).
- Services re-validate semantics via `@smm/validation` zod schemas, which encode quantity bounds, enums, password policy and money range.
