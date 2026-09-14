# Order lifecycle

`OrdersService` (non-global module, consumed by controllers and `UserApiModule`). Handles standard, mass, api, admin, drip-feed and subscription order types; drip-feed and subscriptions additionally create their own domain records and a matching `Order`.

## 1. Creation (`create(input)`)

1. **Idempotency**: if `input.idempotencyKey` matches an existing order (sparse unique index), return the existing order — safe for client retries.
2. **Service validation**: service exists, `status: active`, `quantity` within `[minimum, maximum]`.
3. **Coupon**: if `couponCode`, server-side validate (active, not expired, usage/per-user limits, `minimumAmount`) and compute the discount.
4. **Pricing**: `ServicesService.computePrice` (see [PROVIDERS.md](PROVIDERS.md)) produces the `PricingSnapshot`.
5. **Debit**: `walletService.debit(userId, finalCharge, { type: "order_debit", referenceType: "order" })` — atomic; throws `INSUFFICIENT_BALANCE` if funds are short. This is the only guard between request and fulfillment.
6. **Persist order**: `publicOrderId = publicId("ORD")`, defaults: `orderType: standard`, `status: pending`, `pricingSnapshot`, `apiKeyId` stamped when created via the third-party API.
7. **Record coupon redemption** (when a coupon applied) + **OrderStatusHistory** entry (`→ pending`).
8. **Enqueue submission**: `orderQueue.add("submit-order", { orderId }, { jobId: "order-submit-<publicOrderId>", attempts: 3 })`.

> Deliberately no cross-document transaction: the wallet debit is the dominating invariant (funds are always reserved first). The order document itself can be created safely after.

## 2. Provider submission (`submitToProvider`) — worker job `submit-order`

1. `ProviderFactory.getAdapter(providerId)`.
2. `adapter.createOrder({ providerServiceId, link, quantity, runs?, interval? })`.
3. On success: set `providerOrderId`, `status = processing`, record history; schedule **status polling** once.
4. On failure:
   - `markHealth(providerId, false, error)`.
   - Mark order `failed`, record history, and **refund** the customer (`walletService.refund(order, ...)` — type `refund`, referenceType `order`).
   - The job may retry per BullMQ backoff (exponential, up to 3 tries).

## 3. Status sync (`syncStatus`) — worker job `check-status`

- Read `getOrderStatus(providerOrderId)` via the adapter.
- **Normalization** (substring match, tolerant of provider dialect):
  - `complete` → `completed`
  - `cancel` → `canceled`
  - `refund` → `refunded`
  - `partial` → `partial`
  - `fail|error` → `failed`
  - `processing` → `processing`
  - `progress` → `in_progress`
  - `pending` → `pending`
- Update `startCount`/`remains` when the provider returns them.
- Transitions are appended to `OrderStatusHistory`; terminal states end the poll loop; `completed` sets `completedAt` and triggers `completed`-time hooks (referral commission, drip/subscription bookkeeping).
- Non-terminal states: keep polling (`attempts: 5`, exponential backoff 10s) until completion.

## 4. Cancel & refund

- `cancelOrder(userId, orderId)`: only allowed for user-owned, non-terminal orders where `service.cancelSupported`; calls adapter `cancelOrder`; refunds the wallet (`walletService.refund`); sets `status = canceled`, records `cancelReason` and history.
- `refundOrder(order, reason)`: called when a provider reports a refund or when a canceled order must reverse funds — same `refund` ledger type; idempotent for terminal states.

## 5. Admin & API surface

| Route                                     | Behavior                                                            |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `POST /orders`                            | creates order (JWT)                                                 |
| `GET /orders/my`                          | paginated user orders (optional `status`)                           |
| `GET /orders/my/:id`                      | single order for the owner (admin flag supports staff views)        |
| `GET /orders/estimate?serviceId&quantity` | price preview, no funds moved                                       |
| `POST /orders/my/:id/cancel`              | cancel + refund                                                     |
| `GET /orders/admin/all`                   | staff list with filters (`orders.manage`)                           |
| `POST /order` (X-API-Key)                 | third-party create (body uses `service`, forces `orderType: "api"`) |
| `GET /order/:orderId` (X-API-Key)         | third-party lookup                                                  |
| `POST /cancel` (X-API-Key)                | third-party cancel                                                  |

## Derived features

- **Refills** ([refills module]): eligible on `completed`/`partial` orders when `refillSupported`; enqueues `refill-processing`. See [QUEUES.md](QUEUES.md).
- **Drip-feed**: one `DripFeedOrder` splits `totalQuantity` into `runs` of `quantityPerRun` every `intervalMinutes`; each run debits per-run cost, creates an `Order`, and schedules the next run. Pause/resume supported.
- **Subscriptions**: recurring `intervalDays` deliveries while `status == active`; pause/cancel supported.

## Error/edge principles

- Money is only moved by `WalletService`; order/refund paths never touch balance directly.
- Refund is only attempted once per order (guard on non-terminal status and explicit `refunded`/`canceled` end state).
- Provider loss is surfaced through `Provider.health` (`consecutiveFailures`, `lastError`) and reflected in `dashboard.metrics`.
- Status normalization is intentionally substring-based (covers dialects like "Completed", "CANCELLED", "Partial") and any unmatched status is left `pending`/`processing` so the poll continues.
