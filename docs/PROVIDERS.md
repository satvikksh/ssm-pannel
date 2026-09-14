# Provider adapters

The provider layer abstracts the many differing SMM-provider HTTP APIs behind a single adapter contract, so orders/refills/status behave identically regardless of upstream.

## Adapter contract (`apps/api/src/modules/providers/provider.interface.ts`)

```ts
interface ProviderServiceDefinition {
  providerServiceId: string;
  name: string;
  type?: string;
  category?: string;
  price?: number;
  min?: number;
  max?: number;
  refill?: boolean;
  cancel?: boolean;
  dripFeed?: boolean;
  subscription?: boolean;
  raw?: unknown;
}
interface CreateOrderParams {
  providerServiceId: string;
  link: string;
  quantity: number;
  runs?: number;
  interval?: number;
}
interface CreateOrderResult {
  providerOrderId: string;
  raw?: unknown;
}
interface OrderStatusResult {
  status: string;
  startCount?: number;
  remains?: number;
  raw?: unknown;
}
interface RefillResult {}
interface RefillStatusResult {}
interface CancelResult {
  canceled: boolean;
  raw?: unknown;
}

abstract class ProviderAdapter {
  abstract readonly adapterName: string;
  abstract getServices(): Promise<ProviderServiceDefinition[]>;
  abstract createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;
  abstract getOrderStatus(orderId: string): Promise<OrderStatusResult>;
  abstract getBalance(): Promise<number>;
  abstract createRefill(params): Promise<RefillResult>;
  abstract getRefillStatus(refillId: string): Promise<RefillStatusResult>;
  abstract cancelOrder(orderId: string): Promise<CancelResult>;
}
```

- `ProviderError extends Error { code, retryable }` transports transport errors.
- `ProviderErrorCode`: `PROVIDER_TIMEOUT`, `HTTP_4XX`, `HTTP_5XX`, `INVALID_JSON`, `AUTH_FAILURE`, `INSUFFICIENT_BALANCE`, `RATE_LIMITED`, `DOWN`, `INVALID_RESPONSE`.
- `CreateProviderDto` (class-validator): `name`, `slug`, `adapter`, `baseUrl`, optional `apiKey`/`apiSecret`, `authStyle` (`query|body|header`), `currency`, `timeoutMs`, `retries`, `responseMapping`.

## Built-in adapters

### Generic adapter (`generic.adapter.ts`)

For standards-compliant SMM provider APIs (the common `action`-based protocol). Configured from `Provider.config`:

- Action-based POSTs to `{baseUrl}/api/v2` style endpoints with `action` = `add` / `status` / `balance` / `refill` / `refill_status` / `cancel`.
- Credentials sent per `authStyle`: query param `key`, header `X-Api-Key`, or in the JSON body.
- 30s request timeout; maps non-2xx/network/parse failures to the corresponding `ProviderErrorCode`.
- `getServices`: reads the response array from `data`, `data.services`, or `data.data` (robust to response-shape variance).

### Fake adapter (`fake.adapter.ts`)

In-memory simulator for development/tests:

- 3 fake services; `getBalance() → 9999`.
- Order statuses advance `Pending → In progress → Completed` over time.
- All other operations return predictable values.

## Factory & credential handling

`ProviderFactory` (`provider.factory.ts`, injects the `Provider` model):

- `getAdapterFor(adapterName, provider)` → switch on `"fake"`/`"generic"`; unknown adapters → `BadRequestException`.
- `getAdapter(providerId)` → loads provider, **rejects inactive/suspended providers**, decrypts credentials (`decryptSecret(config.apiKeyEncrypted, ENCRYPTION_KEY)`), returns `{ provider, adapter }`.

Provider creation (`ProvidersService.create`) encrypts `apiKey`/`apiSecret` into `config.apiKeyEncrypted`/`config.apiSecretEncrypted` with `AES-256-GCM` before storing. `findAll()` strips `config` from responses so stored secrets and key material never leak to the client.

## Service sync & health

- `syncServices(providerId)` pulls `getServices()`, upserts `ProviderService` docs (unique `{providerId, providerServiceId}`), marks health ok; a failed sync marks the provider degraded (records `lastError`, increments `consecutiveFailures`, updates `health.score`).
- `getBalance(providerId)` / `testConnection(providerId)` validate connectivity and staffing.
- `markHealth(providerId, ok, error?)` is called from the order pipeline on every submit/status op so health reflects live traffic.

## Catalog mapping

A panel `Service` references `{providerId, providerServiceId, providerCost, customerPrice...}`. Admin creates panel services (`POST /services`) referencing synced provider services, then prices them with markup. `ServicesService.computePrice` applies the price hierarchy:

1. Custom user price (`ServicePrice` where `userId` set)
2. Group price (`ServicePrice` where `userGroupId` set)
3. Base `customerPrice`

`finalCharge = baseRate × quantity − discount`, where `discount` comes from an applied coupon (fixed or percentage, capped by `maximumDiscount`).

## Adding a new provider protocol

1. Implement `ProviderAdapter` in `apps/api/src/modules/providers/adapters/`.
2. Add a case in `ProviderFactory.getAdapterFor`.
3. Add the adapter name to the provider DTO.
4. Add integration fixtures for the worker's provider tests.

Note: the generic adapter already covers most action-based providers; bespoke adapters are only needed for non-standard protocols (Stripe-like webhook multi-signature, OAuth refresh, etc.).
