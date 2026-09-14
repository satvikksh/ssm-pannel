import {
  ProviderAdapter,
  ProviderServiceDefinition,
  CreateOrderParams,
  CreateOrderResult,
  OrderStatusResult,
  RefillResult,
  RefillStatusResult,
  CancelResult,
} from "../provider.interface";
import { publicId } from "@smm/utils";

/**
 * In-process fake provider used for development, tests, and demo mode.
 * Simulates stateful orders that progress through statuses over time.
 *
 * State lives at module scope (shared across adapter instances) so order
 * progression survives repeated ProviderFactory lookups within and across
 * processes (API + worker).
 */
const ORDERS = new Map<string, { status: string; startCount: number; remains: number }>();
const REFILLS = new Map<string, string>();

export class FakeProviderAdapter extends ProviderAdapter {
  readonly adapterName = "fake";

  constructor(private readonly delayMs = 2000) {
    super();
  }

  private async simulate(durationMs: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, Math.min(durationMs, 50)));
  }

  async getServices(): Promise<ProviderServiceDefinition[]> {
    await this.simulate(this.delayMs);
    return [
      { service: "1", name: "Instagram Followers", rate: 0.5, min: 10, max: 10000, refill: true, cancel: true },
      { service: "2", name: "YouTube Views", rate: 0.3, min: 100, max: 100000, refill: false },
      { service: "3", name: "TikTok Likes", rate: 0.2, min: 50, max: 10000, dripFeed: true },
    ];
  }

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    await this.simulate(this.delayMs);
    const id = publicId("FAKE").replace("FAKE-", "");
    ORDERS.set(id, { status: "Pending", startCount: 0, remains: params.quantity });
    return { providerOrderId: id };
  }

  async getOrderStatus(providerOrderId: string): Promise<OrderStatusResult> {
    await this.simulate(this.delayMs);
    const order = ORDERS.get(providerOrderId);
    if (!order) return { status: "Unknown" };
    order.startCount += Math.floor(Math.random() * 5);
    order.remains = Math.max(0, order.remains - order.startCount);
    if (order.remains === 0) order.status = "Completed";
    else if (order.startCount > 0) order.status = "In progress";
    return { status: order.status, startCount: order.startCount, remains: order.remains };
  }

  async getBalance(): Promise<number> {
    await this.simulate(this.delayMs);
    return 9999;
  }

  async createRefill(providerOrderId: string): Promise<RefillResult> {
    await this.simulate(this.delayMs);
    const refillId = publicId("R").replace("R-", "");
    REFILLS.set(refillId, providerOrderId);
    return { providerRefillId: refillId };
  }

  async getRefillStatus(_providerRefillId: string): Promise<RefillStatusResult> {
    await this.simulate(this.delayMs);
    return { status: "Completed" };
  }

  async cancelOrder(providerOrderId: string): Promise<CancelResult> {
    await this.simulate(this.delayMs);
    ORDERS.set(providerOrderId, { status: "Canceled", startCount: 0, remains: 0 });
    return { canceled: true };
  }
}