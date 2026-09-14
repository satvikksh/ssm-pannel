# SMM Panel Architecture Documentation

Production-grade, licensed & resellable SMM (Social Media Marketing) panel with a central license-management platform.

## Repository layout

```
smm-pannel/
├── apps/
│   ├── api/             # NestJS customer panel API (IMPLEMENTED)
│   ├── worker/          # BullMQ job workers (PLANNED — empty)
│   ├── web/             # Customer panel web UI (PLANNED — empty)
│   ├── license-api/     # Central license server (PLANNED — empty)
│   └── license-admin/   # License platform admin UI (PLANNED — empty)
├── packages/
│   ├── config/          # Env config (zod) + ConfigError
│   ├── database/        # Mongoose schemas, connection, model registry
│   ├── logger/          # pino wrapper + Nest logger adapter
│   ├── security/        # hashing, JWT, HMAC, encryption, API keys
│   ├── types/           # Shared enums + type aliases
│   ├── ui/              # Shared React UI kit (PLANNED — empty)
│   ├── utils/           # decimal money math, ids, domain/validation helpers
│   └── validation/      # zod schemas for every domain DTO
├── deploy/              # Deployment artifacts (PLANNED — empty)
├── docs/                # You are here
└── scripts/             # Operational scripts (PLANNED — empty)
```

## Documentation index

| #   | Document                               | Covers                                                      |
| --- | -------------------------------------- | ----------------------------------------------------------- |
| 1   | [README.md](README.md)                 | This index                                                  |
| 2   | [ARCHITECTURE.md](ARCHITECTURE.md)     | System overview, request lifecycle, module graph            |
| 3   | [MONOREPO.md](MONOREPO.md)             | Workspaces, turbo pipeline, TS config, build gotchas        |
| 4   | [PACKAGES.md](PACKAGES.md)             | Internal packages (`@smm/*`) reference                      |
| 5   | [DATABASE.md](DATABASE.md)             | MongoDB schemas, collections, indexes, transactions         |
| 6   | [API.md](API.md)                       | Conventions, envelopes, error shapes, full route map        |
| 7   | [AUTH.md](AUTH.md)                     | JWT auth, guards, permissions, API keys                     |
| 8   | [PROVIDERS.md](PROVIDERS.md)           | Provider adapters, generic/fake adapters, error codes       |
| 9   | [ORDERS.md](ORDERS.md)                 | Order lifecycle, pricing, idempotency, refunds, status sync |
| 10  | [PAYMENTS.md](PAYMENTS.md)             | Deposits, manual approvals, webhooks, idempotency           |
| 11  | [WALLET.md](WALLET.md)                 | Ledger model, optimistic concurrency, transaction types     |
| 12  | [QUEUES.md](QUEUES.md)                 | BullMQ queues, job contracts, worker design                 |
| 13  | [LICENSE-SYSTEM.md](LICENSE-SYSTEM.md) | Panel license client + central license platform             |
| 14  | [SECURITY.md](SECURITY.md)             | Secrets, hashing, encryption, redaction, threat model       |
| 15  | [TESTING.md](TESTING.md)               | Testing strategy and highest-value test areas               |
| 16  | [DEPLOYMENT.md](DEPLOYMENT.md)         | Topology, env reference, docker/nginx, runbooks             |
| 17  | [ROADMAP.md](ROADMAP.md)               | Built vs. pending, known gaps, next milestones              |

## Status at a glance

- **Implemented & verified:** `apps/api` (all modules), all packages except empty `ui`.
- **Verified:** full monorepo `typecheck` + `build` green; API boots with DI resolved, all routes mapped, Swagger at `/api/docs`, `/ready` and `/health` operational.
- **Pending:** worker, web, license-api, license-admin, ui, seed script, deployment scaffolding. See [ROADMAP.md](ROADMAP.md).
