# Payments & wallet deposit

`PaymentsService` covers deposits that load the user's wallet, manual payment review, and gateway webhook ingestion. The domain invariants are **at-most-once credit** and **full audit trail**.

## Deposit initiation

`POST /payments/deposit` `{ amount, gateway, paymentMethod? }`:

1. Validate via `createDepositSchema` (amount > 0, ≤ 1,000,000; gateway in `razorpay|stripe|paypal|manual|upi`).
2. Check configured bounds: `settings.payments.minimumDeposit` / `maximumDeposit` (defaults 1 / 1M).
3. Create a `Payment` record (`status: pending`, `publicPaymentId = publicId("PAY")`).

`PAYMENT_GATEWAYS = { manual: {enabled:true}, stripe: {enabled:false}, razorpay: {enabled:false}, paypal: {enabled:false} }`. Currently supported in-app: **manual/UPI** (administrator-confirmed). Stripe/Razorpay/PayPal need a future integration worker that: creates a gateway PaymentIntent, watches it, and emits webhooks (see ROADMAP). Until then non-manual gateways resolve to the same `pending` record.

## Manual payments

`POST /payments/manual` `{ amount, gateway: manual|upi, transactionRef, notes? }`:

- Creates a `Payment` with `proof: { transactionRef, notes }` and `status: pending`.
- Admin reviews via:
  - `POST /payments/admin/:id/approve` (perms `payments.approve`)
  - `POST /payments/admin/:id/reject` (perms `payments.approve`, reason required)

`approvePayment`:

1. Load payment; if `status !== "pending"` → no-op (idempotent; never double-credit).
2. `walletService.credit(userId, amount, { type: "deposit", referenceType: "payment", referenceId })`.
3. Set `status: approved`, `processedAt`, `adminId`.

## Gateway webhooks

`POST /payments/webhook/:gateway` is `@Public()` — gateway signature/verification is expected inside the handler:

1. `handleWebhook(gateway, eventId, eventType, payload, signature?)`:
   - Stripe: compare the signature against `STRIPE_WEBHOOK_SECRET` (simplified check; strengthen for production).
   - **Idempotency**: upsert `PaymentWebhook` on unique `{gateway, eventId}`; if `processed` already → skip.
   - Map `eventType` to a credit: success/charged/captured events credit the matching `Payment` via `approvePayment` logic, with an amount check within `0.001` of the stored amount.
   - Record event outcome (`processed`, `error`) on the webhook doc.
2. Reject payment functions mirror approval with the rejection reason surfaced to the user.

## Distinguishing flows

| Flow                      | Entry                               | Credit path                                                      | Guard                          |
| ------------------------- | ----------------------------------- | ---------------------------------------------------------------- | ------------------------------ |
| Manual deposit            | `POST /payments/manual`             | admin `approvePayment`                                           | `status` flip pending→approved |
| Gateway credit            | `POST /payments/webhook/:gateway`   | `processGatewayEvent`→credit                                     | unique `{gateway,eventId}`     |
| Admin manual credit/debit | `POST /admin/users/:userId/balance` | `WalletService.credit/debit` type `manual_credit`/`manual_debit` | permission `admin.finance`     |

All credits go through `WalletService`, producing a `WalletTransaction` with `referenceType`/`referenceId` linking back to the payment; `referenceType = "payment"` collisions prevent manual double-entry.

## Ledger linkage

`WalletTransaction` records `balanceBefore`/`balanceAfter` for every mutation: deposits, order debits, refunds, commissions, adjustments. Reconciliations and the admin dashboard (`revenue`/`orders-by-status`) aggregate from these ledger + payment records rather than trusting wallet balances.

## Future gateway integration (planned)

Design contract for a worker-based gateway adapter: create payment intent → store `gatewayTransactionId` → listen for webhook → upsert `{gateway,eventId}` → credit once. Webhook signature verification per gateway (Stripe `STRIPE_WEBHOOK_SECRET`, etc.). See [QUEUES.md](QUEUES.md) `payments` queue and [ROADMAP.md](ROADMAP.md).
