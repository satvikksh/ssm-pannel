# Queues (BullMQ)

Jobs are the API's only asynchronous mechanism today; the worker app that consumes them is planned (see [ROADMAP.md](ROADMAP.md)). This document fixes the contract so the worker can be implemented against it.

## Declaration

`QueueModule.configure({ connectionUrl, defaultRetries? })` is a `@Global()` dynamic module that creates and exports one BullMQ `Queue` per `QueueName` (12 queues), injected by string token `"QUEUE_<UPPER>"`:

| QueueName                 | Token                           | Current producers                      |
| ------------------------- | ------------------------------- | -------------------------------------- |
| `order-processing`        | `QUEUE_ORDER_PROCESSING`        | OrdersService                          |
| `order-status`            | `QUEUE_ORDER_STATUS`            | OrdersService                          |
| `provider-sync`           | `QUEUE_PROVIDER_SYNC`           | (planned) ProvidersService             |
| `refill-processing`       | `QUEUE_REFILL_PROCESSING`       | RefillsService                         |
| `drip-feed`               | `QUEUE_DRIP_FEED`               | DripFeedService                        |
| `subscription-processing` | `QUEUE_SUBSCRIPTION_PROCESSING` | (planned) SubscriptionsService         |
| `email`                   | `QUEUE_EMAIL`                   | (planned) auth/password-reset emails   |
| `payments`                | `QUEUE_PAYMENTS`                | (planned) gateway intents/webhooks     |
| `notifications`           | `QUEUE_NOTIFICATIONS`           | (planned) NotificationsService fan-out |
| `reports`                 | `QUEUE_REPORTS`                 | (planned) admin reports/aggregations   |
| `license`                 | `QUEUE_LICENSE`                 | LicenseService (heartbeat)             |
| `cleanup`                 | `QUEUE_CLEANUP`                 | (planned) TTL/retention maintenance    |

Consumer naming: `QueueName.ORDER_PROCESSING` etc. (token map in `packages/types`).

## Default job options (set on every queue)

- `attempts: 3` (unless overridden)
- `backoff: { type: "exponential", delay: 2000 }`
- `removeOnComplete: { age: 86400 }` — 1 day retention
- `removeOnFail: { age: 7 * 86400 }` — 7 days retention

Connections: parsed from `REDIS_URL` (`rediss://` enables TLS); `maxRetriesPerRequest: null` so long-running workers don't get stuck in reconnection.

## Job contract (API → worker)

| Queue               | Job name            | Data                           | Producer behavior                                        |
| ------------------- | ------------------- | ------------------------------ | -------------------------------------------------------- |
| `order-processing`  | `submit-order`      | `{ orderId }`                  | `jobId: "order-submit-<publicOrderId>"`, `attempts: 3`   |
| `order-status`      | `check-status`      | `{ orderId, providerOrderId }` | `jobId: "order-status-<id>"`, `attempts: 5`, backoff 10s |
| `refill-processing` | `process-refill`    | `{ refillId, orderId }`        | `jobId: "refill-<publicRefillId>"`                       |
| `drip-feed`         | `run-drip`          | `{ dripId }`                   | `jobId: "drip-<publicDripId>"`                           |
| `license`           | `license-heartbeat` | `{ installationId, at }`       | `attempts: 5`, backoff 60s                               |

## Worker contract (to implement in `apps/worker`)

Rules the worker must honor:

1. **Idempotency**: every processor re-checks the object's status before mutating (e.g. an order already `completed`/`failed` is skipped; the payment webhook re-checks `PaymentWebhook.processed`).
2. **Retry semantics per job**: honor the `attempts` given at enqueue time; do not override downward. Terminal failures are recorded (provider health, error code) and the job is allowed to exhaust retries.
3. **Status polling**: `check-status` recurses by enqueuing the next `check-status` with a backoff rather than looping in memory, so the process can restart safely between polls.
4. **Provider connectivity**: all provider calls go through `ProviderAdapter`; `ProviderError` with `retryable: true` short-circuits into the queue's retry/backoff machinery.
5. **Logging**: worker jobs log with pino and include `requestId`/`orderId` where available; failures include the provider error code.

## Desired worker layout

```
apps/worker/
├── src/
│   ├── main.ts            # init logger + connect shared deps
│   ├── queues/            # one Worker per QueueName
│   │   ├── order-processing.processor.ts
│   │   ├── order-status.processor.ts
│   │   ├── provider-sync.processor.ts
│   │   ├── refill-processing.processor.ts
│   │   ├── drip-feed.processor.ts
│   │   ├── subscription-processing.processor.ts
│   │   ├── email.processor.ts
│   │   ├── payments.processor.ts
│   │   ├── notifications.processor.ts
│   │   ├── reports.processor.ts
│   │   ├── license.processor.ts
│   │   └── cleanup.processor.ts
│   └── jobs/              # shared job payload types
```

Reuse `@smm/database` schemas, `@smm/security`, `@smm/logger`, `@smm/utils`, `@smm/validation`; do not import NestJS modules from `apps/api`. The processor functions are plain functions receiving `(job, context)` and returning status metadata, keeping the worker testable without Nest DI.

## Operational notes

- Queue health is externally observable via Redis (`LLEN`, `bull:*` keys); the API `/health` endpoint only pings Redis.
- `removeOnComplete/removeOnFail` with ages prevent unbounded `completed`/`failed` accumulation.
- Graceful shutdown: connect with `maxRetriesPerRequest: null`, close workers on SIGTERM, and `Worker.close()` after current jobs.
