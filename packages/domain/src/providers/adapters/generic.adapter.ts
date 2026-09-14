import {
  ProviderAdapter,
  ProviderServiceDefinition,
  CreateOrderParams,
  CreateOrderResult,
  OrderStatusResult,
  RefillResult,
  RefillStatusResult,
  CancelResult,
  ProviderError,
  ProviderErrorCode,
} from "../provider.interface";

/**
 * Generic REST provider adapter. Most SMM provider APIs follow the "api key on
 * every request" pattern. Auth style and response field names are configurable
 * per provider record so the codebase never needs provider-specific logic.
 */

export interface GenericProviderConfig {
  apiUrl: string;
  apiKey: string;
  authStyle: "query" | "body" | "header";
  authKeyParam?: string;
  responseMapping: {
    serviceId: string;
    name: string;
    rate: string;
    min?: string;
    max?: string;
    type?: string;
    category?: string;
    refill?: string;
    cancel?: string;
    dripFeed?: string;
    subscription?: string;
    orderId?: string;
    status?: string;
    startCount?: string;
    remains?: string;
    balance?: string;
    refillId?: string;
  };
}

export class GenericProviderAdapter extends ProviderAdapter {
  readonly adapterName = "generic";

  constructor(
    private readonly config: GenericProviderConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    super();
  }

  private async call(url: string, body?: Record<string, unknown>, method = "GET"): Promise<any> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "SMM-Panel/1.0",
    };

    const params = new URLSearchParams();
    if (this.config.authStyle === "query") {
      params.set("key", this.config.apiKey);
    }
    for (const [k, v] of Object.entries(body ?? {})) {
      if (v !== undefined) params.set(k, String(v));
    }
    if (this.config.authStyle === "header") {
      headers[this.config.authKeyParam ?? "X-Api-Key"] = this.config.apiKey;
    }

    const fullUrl = this.config.authStyle === "body" && body && "key" in body === false
      ? url
      : `${url}?${params.toString()}`;

    let res: Response;
    try {
      res = await this.fetchFn(fullUrl, {
        method,
        headers,
        body: method === "POST" ? JSON.stringify(this.config.authStyle === "body" ? { ...body, key: this.config.apiKey } : body ?? undefined) : undefined,
        signal: AbortSignal.timeout(30000),
      });
    } catch (e: any) {
      const isTimeout = e?.name === "TimeoutError" || e?.name === "AbortError";
      throw new ProviderError(
        isTimeout ? ProviderErrorCode.TIMEOUT : ProviderErrorCode.DOWN,
        isTimeout ? "Provider request timed out" : "Provider unreachable",
        true,
      );
    }

    if (res.status >= 500) {
      throw new ProviderError(ProviderErrorCode.HTTP_5XX, "Provider returned 5xx", true);
    }
    if (res.status === 401 || res.status === 403) {
      throw new ProviderError(ProviderErrorCode.AUTH_FAILURE, "Provider auth failure");
    }
    if (res.status >= 400) {
      throw new ProviderError(ProviderErrorCode.HTTP_4XX, `Provider returned ${res.status}`);
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new ProviderError(ProviderErrorCode.INVALID_JSON, "Invalid JSON from provider");
    }

    // Common error envelopes: SMM providers typically return {error: "..."}
    if (data?.error) {
      const msg = String(data.error).toLowerCase();
      if (msg.includes("balance")) {
        throw new ProviderError(ProviderErrorCode.INSUFFICIENT_BALANCE, "Insufficient provider balance");
      }
      if (msg.includes("rate")) {
        throw new ProviderError(ProviderErrorCode.RATE_LIMITED, "Provider rate limited", true);
      }
      throw new ProviderError(ProviderErrorCode.INVALID_RESPONSE, String(data.error));
    }

    return data;
  }

  private pick(obj: any, key: string | undefined): string | undefined {
    if (!key) return undefined;
    return obj?.[key];
  }

  async getServices(): Promise<ProviderServiceDefinition[]> {
    const data = await this.call(this.config.apiUrl, {}, "POST");
    const list = Array.isArray(data) ? data : Array.isArray(data?.services) ? data.services : data?.data;
    if (!Array.isArray(list)) {
      throw new ProviderError(ProviderErrorCode.INVALID_RESPONSE, "Services response is not a list");
    }
    return list.map((row): ProviderServiceDefinition => ({
      service: String(this.pick(row, this.config.responseMapping.serviceId) ?? row?.service ?? row?.id ?? ""),
      name: String(this.pick(row, this.config.responseMapping.name) ?? row?.name ?? "Unnamed service"),
      rate: Number(this.pick(row, this.config.responseMapping.rate) ?? 0),
      min: Number(this.pick(row, this.config.responseMapping.min)) || undefined,
      max: Number(this.pick(row, this.config.responseMapping.max)) || undefined,
      type: this.pick(row, this.config.responseMapping.type),
      category: this.pick(row, this.config.responseMapping.category),
      refill: Boolean(String(this.pick(row, this.config.responseMapping.refill) ?? row?.refill ?? "").toLowerCase().match(/^(1|true|yes)$/)),
      cancel: Boolean(String(this.pick(row, this.config.responseMapping.cancel) ?? row?.cancel ?? "").toLowerCase().match(/^(1|true|yes)$/)),
      dripFeed: Boolean(String(this.pick(row, this.config.responseMapping.dripFeed) ?? row?.dripfeed ?? "").toLowerCase().match(/^(1|true|yes)$/)),
      subscription: Boolean(String(this.pick(row, this.config.responseMapping.subscription) ?? row?.subscription ?? "").toLowerCase().match(/^(1|true|yes)$/)),
    }));
  }

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const data = await this.call(this.config.apiUrl, {
      action: "add",
      service: params.providerServiceId,
      link: params.link,
      quantity: params.quantity,
      runs: params.runs,
      interval: params.interval,
    }, "POST");
    const id = this.pick(data, this.config.responseMapping.orderId);
    if (!id) throw new ProviderError(ProviderErrorCode.INVALID_RESPONSE, "No order id in response");
    return { providerOrderId: String(id), raw: data };
  }

  async getOrderStatus(providerOrderId: string): Promise<OrderStatusResult> {
    const data = await this.call(this.config.apiUrl, {
      action: "status",
      order: providerOrderId,
    }, "POST");
    return {
      status: this.pick(data, this.config.responseMapping.status) ?? "Unknown",
      startCount: Number(this.pick(data, this.config.responseMapping.startCount)) || undefined,
      remains: Number(this.pick(data, this.config.responseMapping.remains)) || undefined,
      raw: data,
    };
  }

  async getBalance(): Promise<number> {
    const data = await this.call(this.config.apiUrl, { action: "balance" }, "POST");
    return Number(this.pick(data, this.config.responseMapping.balance)) || 0;
  }

  async createRefill(providerOrderId: string): Promise<RefillResult> {
    const data = await this.call(this.config.apiUrl, { action: "refill", order: providerOrderId }, "POST");
    const id = this.pick(data, this.config.responseMapping.refillId);
    return { providerRefillId: id ? String(id) : `refill-${providerOrderId}`, raw: data };
  }

  async getRefillStatus(providerRefillId: string): Promise<RefillStatusResult> {
    const data = await this.call(this.config.apiUrl, { action: "refill_status", refill: providerRefillId }, "POST");
    return { status: this.pick(data, this.config.responseMapping.status) ?? "In progress", raw: data };
  }

  async cancelOrder(providerOrderId: string): Promise<CancelResult> {
    const data = await this.call(this.config.apiUrl, { action: "cancel", order: providerOrderId }, "POST");
    return { canceled: data?.canceled ?? true, raw: data };
  }
}