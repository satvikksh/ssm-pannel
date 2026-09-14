# Deployment

Target topology for a licensed, on-premise or VPS deployment. The `deploy/` directory is currently empty — manifests below are the planned scaffolding.

## Topology

```
                   ┌────────────┐
   http/https ──▶  │  nginx     │   TLS term + static assets + rate-limit
                   └─────┬──────┘
                         │
                   ┌─────▼──────┐        ┌─────────────┐
                   │ apps/api   │───▶    │ MongoDB     │  smm_panel
                   │ (x2, scale)│───▶    │ (replica)   │
                   └─────┬──────┘        └─────────────┘
                         │ Redis         ┌─────────────┐
                   ┌─────▼──────┐        │ Redis       │  BullMQ state
                   │ apps/worker│───▶    │ (replica/SO)│
                   └────────────┘        └─────────────┘

   Separate tenant: central license platform
   apps/license-api + apps/license-admin + MongoDB smm_license
```

The customer panel API and the license platform are **separate deployments** — the panel only ever talks to the platform over HTTPS/HMAC, never to its database.

## Environment reference

All vars are consumed by `@smm/config` (see [PACKAGES.md](PACKAGES.md)). Minimum viable production set:

```
NODE_ENV=production
PORT=4000
APP_URL=https://panel.example.com
MONGODB_URI=mongodb://mongo:27017/smm_panel       # auth/replicaSet in prod
REDIS_URL=rediss://user:pass@redis:6379           # TLS recommended
JWT_SECRET=<64+ random chars>                     # required in production
JWT_ACCESS_TTL=1d
JWT_REFRESH_TTL=30d
ENCRYPTION_KEY=<64 hex chars>                     # AES-256 provider secrets
LICENSE_SERVER_URL=https://license.example.com
INSTALLATION_ID=<panel cluster installation id>
LICENSE_SHARED_SECRET=<per-panel random>
LICENSE_GRACE_SECONDS=86400
# SMTP_*                    # email worker
# STRIPE_* / RAZORPAY_* / PAYPAL_*   # gateway integration
```

Never commit `.env`; provide `.env.example` per app. All secrets differ between environments; rotating `ENCRYPTION_KEY` requires re-encrypting provider secrets.

## Containers (planned `deploy/`)

- **apps/api/Dockerfile** (multi-stage: `turbo build` → `node dist/main.js`; non-root user; `npm ci --omit=dev`).
- **deploy/docker-compose.yml** — services: `api` (replicas), `worker`, `mongo` (volume + init replica set), `redis` (appendonly), `nginx`, and optional `license-api`/`license-admin` for self-hosting the platform.
- Health checks: `/ready` (mongo-only) for `api`; `redis-cli ping` for `redis`; `mongo --eval "db.runCommand({ping:1})"` for mongo.

## Nginx (planned `deploy/nginx/smm.conf`)

- TLS 1.2/1.3; HSTS; redirect HTTP→HTTPS; `proxy_pass http://api:4000` with `proxy_set_header X-Real-IP/X-Forwarded-For/Proto` (server tokens off).
- Request ID handling: pass through `x-request-id` or generate upstream.
- Static serving for `/assets` (web app build output) when self-hosting the panel UI.
- Rate limiting at the edge mirrors the app's future `ThrottlerGuard` (see ROADMAP).

## Runbook

### First boot of a new panel

1. Provision Mongo + Redis + secrets; set env.
2. `npm ci && npm run build` (or pull images).
3. `npm run seed` — creates the initial super-admin, default categories/providers (FakeProviderAdapter for trials), and required settings. (Seed script does not exist yet — ROADMAP.)
4. Start `api`; verify `GET /ready` → `true`, `/health` → mongo ok.
5. Activate the license (`POST /api/v1/license/activate`) with the key from the platform, or leave `LICENSE_SERVER_URL` unset for dev-only mode.

### Upgrade

- Build new image → roll `api` replicas one at a time (stateless); `/ready` gates each pod.
- Rolling upgrade of `worker`; BullMQ resumes delayed jobs (attempts/backoff persist in Redis).
- Mongo schema changes: additive `updateMany`/index migrations in app bootstrap; TTL indexes auto-created.

### Backup

- Mongo: `mongodump` daily + oplog/PITR for `smm_panel`; `smm_license` is the authoritative entitlements store — back it up additionally and encrypt at rest.
- Redis: not a source of truth; losing it just redelivers/restarts jobs (idempotent processors required).

### Monitoring & logs

- pino JSON → stdout; ship to Loki/ELK. Alert on: `readyState != 1` for mongo, Redis ping failure, license `status != active` for >1h, provider `consecutiveFailures > 5`, order `failed` rate spike.
- Dashboard endpoints (`/api/v1/admin/dashboard`) already expose aggregates for business metrics.

## Scaling notes

- **API**: stateless → scale horizontally behind nginx; the only shared state is Mongo/Redis.
- **Worker**: one process per queue (or a concurrency-tuned shared worker); drip/subscription/status jobs are delay-sensitive — co-locate on a dedicated instance.
- **Redis**: AOF for job durability; enable `maxmemory-policy noeviction` on BullMQ keys.
- **Mongo**: enable the replica set (needed for real transactions and oplog backups); shard only if collections outgrow a node.
- **cdn**: provider catalogs/pricing are read-heavy → optional nginx caching of `GET /services` with short TTLs behind the license gate is acceptable but verify invalidation semantics.

## Post-incident

Refunds: `POST /api/v1/orders/my/:id/cancel` (user) or admin refund path; balances traceable via `WalletTransaction` (`balanceBefore/After`) per order/payment referenceType. Provider outage: keep orders `processing` — status polls resume; orders created during outage either succeed on retry or auto-refund on terminal failure (idempotent).
