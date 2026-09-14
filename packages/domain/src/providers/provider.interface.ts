/**
 * Common contract every provider adapter must implement. The order engine and
 * sync workers depend ONLY on this interface, never on provider-specific code.
 */

export interface ProviderServiceDefinition {
  service: string;
  name: string;
  type?: string;
  category?: string;
  rate: number;
  min?: number;
  max?: number;
  refill?: boolean;
  cancel?: boolean;
  dripFeed?: boolean;
  subscription?: boolean;
}

export interface CreateOrderParams {
  providerServiceId: string;
  link: string;
  quantity: number;
  /** For drip-feed / subscription runs */
  runs?: number;
  interval?: number;
}

export interface CreateOrderResult {
  providerOrderId: string;
  /** Response metadata from the provider for logging / debugging */
  raw?: Record<string, unknown>;
}

export interface OrderStatusResult {
  status: string;
  startCount?: number;
  remains?: number;
  raw?: Record<string, unknown>;
}

export interface RefillResult {
  providerRefillId: string;
  raw?: Record<string, unknown>;
}

export interface RefillStatusResult {
  status: string;
  raw?: Record<string, unknown>;
}

export interface CancelResult {
  canceled: boolean;
  raw?: Record<string, unknown>;
}

export abstract class ProviderAdapter {
  abstract readonly adapterName: string;

  abstract getServices(): Promise<ProviderServiceDefinition[]>;
  abstract createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;
  abstract getOrderStatus(providerOrderId: string): Promise<OrderStatusResult>;
  abstract getBalance(): Promise<number>;
  abstract createRefill(providerOrderId: string): Promise<RefillResult>;
  abstract getRefillStatus(providerRefillId: string): Promise<RefillStatusResult>;
  abstract cancelOrder(providerOrderId: string): Promise<CancelResult>;
}

export class ProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}

export const ProviderErrorCode = {
  TIMEOUT: "PROVIDER_TIMEOUT",
  HTTP_4XX: "PROVIDER_HTTP_4XX",
  HTTP_5XX: "PROVIDER_HTTP_5XX",
  INVALID_JSON: "PROVIDER_INVALID_JSON",
  AUTH_FAILURE: "PROVIDER_AUTH_FAILURE",
  INSUFFICIENT_BALANCE: "PROVIDER_INSUFFICIENT_BALANCE",
  RATE_LIMITED: "PROVIDER_RATE_LIMITED",
  DOWN: "PROVIDER_DOWN",
  INVALID_RESPONSE: "PROVIDER_INVALID_RESPONSE",
} as const;

export type ProviderErrorCodeValue = (typeof ProviderErrorCode)[keyof typeof ProviderErrorCode];