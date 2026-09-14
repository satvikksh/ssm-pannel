# Wallet & ledger

`WalletService` (global module) is the **only** code path that mutates user balances. Everything else — orders, refunds, deposit approvals, commissions, admin adjustments — calls `credit`/`debit`.

## Account model

- `Wallet { userId (unique), balance, pendingBalance, currency ("USD") }` — one wallet per user, created lazily by `ensureWallet` (e.g. at registration and at first credit/debit).
- `WalletTransaction` is an immutable ledger row: `{ userId, type, status (default success), amount (signed), balanceBefore, balanceAfter, referenceType, referenceId, description, metadata }`.

Every mutation writes exactly one ledger row carrying `balanceBefore`/`balanceAfter` — statement-reconcilable by construction.

## Concurrency: optimistic single-document update

Both `debit` and `credit`:

1. `ensureWallet(userId)`.
2. Atomic update with a **guard condition**:
   - Debit: `findOneAndUpdate({ _id, balance: { $gte: amount } }, { $inc: { balance: -amount } })`.
   - Credit: `findOneAndUpdate({ _id }, { $inc: { balance: +amount } })`.
3. If the guarded update returns null (debit only) → retry a bounded number of times; the final state decides `INSUFFICIENT_BALANCE`.
4. Read the resulting balance, compute `balanceBefore = balanceAfter - amount`, insert the ledger row referencing the order/payment.

This avoids document-level transactions for the hot path and is safe under concurrent requests (Mongo's findOneAndUpdate is atomic per document, and the balance guard is the invariant).

## Transaction types

`WalletTransactionType` (from `@smm/types`): `deposit, order_debit, refund, manual_credit, manual_debit, referral, bonus, chargeback, adjustment, payment_refund`.

Producer contract (`LeadgerEntry`):

```ts
interface LedgerEntry {
  userId?: string;
  type: WalletTransactionType;
  amount: number;
  referenceType: string;
  referenceId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  currency?: string;
}
```

Convenience methods:

- `debit(userId, amount, entry)` — default `type: "order_debit"`.
- `credit(userId, amount, entry)` — default `type: "manual_credit"`.
- `refund(order: {userId, amount, referenceId?}, description = "Order refund")` — ledger `type: "refund"`, `referenceType: "order"`, amount positive (inverts as a credit).
- `getBalance(userId)`, `getBalances(userIds) → Map<userId, number>`, `getSystemPendingBalance()` (aggregate of all wallets).
- `getTransactions(userId, page, pageSize)` — paginated ledger for `GET /wallet/transactions`.

## References used by callers

| Caller                           | Type                         | referenceType      |
| -------------------------------- | ---------------------------- | ------------------ |
| OrdersService.create             | order_debit                  | `order`            |
| OrdersService cancel/refund      | refund                       | `order`            |
| PaymentsService.approvePayment   | deposit                      | `payment`          |
| Webhook credit                   | deposit                      | `payment`          |
| AdminService.adjustBalance       | manual_credit / manual_debit | `admin_adjustment` |
| ReferralsService.awardCommission | referral                     | `referral`         |

## Rules

- **Never** read-modify-write `wallet.balance` from application code — use the atomic helpers.
- Debit requires the amount to be ≤ balance at update time; there is no overdraft.
- Ledger rows are immutable by design; corrections are new rows (e.g. `manual_credit`, `adjustment`), never edits.
- `pendingBalance` is reserved for future escrow (e.g. drips where the next-run cost is pre-reserved); `getSystemPendingBalance` aggregates it for dashboards.
