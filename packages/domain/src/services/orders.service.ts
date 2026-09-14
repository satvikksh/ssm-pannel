import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Queue } from "bullmq";
import { publicId } from "@smm/utils";
import { OrderType } from "@smm/types";
import { QueueName, QueueTokens } from "@smm/queue";
import { WalletService } from "./wallet.service";
import { ServicesService } from "./services.service";
import { ProviderFactory } from "../providers/provider.factory";
import { ProvidersService } from "../providers/providers.service";
import { CouponsService } from "./coupons.service";

export interface CreateOrderInput {
  serviceId: string;
  link: string;
  quantity: number;
  couponCode?: string;
  idempotencyKey?: string;
  userId: string;
  userGroupId?: string;
  orderType?: OrderType;
  apiKeyId?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel("Order") private readonly orderModel: Model<any>,
    @InjectModel("OrderStatusHistory") private readonly historyModel: Model<any>,
    @Inject(QueueTokens[QueueName.ORDER_PROCESSING]) private readonly orderQueue: Queue,
    @Inject(QueueTokens[QueueName.ORDER_STATUS]) private readonly statusQueue: Queue,
    private readonly walletService: WalletService,
    private readonly servicesService: ServicesService,
    private readonly providerFactory: ProviderFactory,
    private readonly providersService: ProvidersService,
    private readonly couponsService: CouponsService,
  ) {}

  /**
   * Create an order:
   *  1. validate service/qty
   *  2. server-side pricing (never trust client amounts)
   *  3. atomic wallet debit + ledger
   *  4. persist order as pending
   *  5. enqueue provider submission
   */
  async create(input: CreateOrderInput) {
    if (input.idempotencyKey) {
      const dup = await this.orderModel.findOne({ idempotencyKey: input.idempotencyKey });
      if (dup) return { order: this.toDto(dup), duplicate: true };
    }

    const service = await this.servicesService.getServiceById(input.serviceId);
    this.validateAgainstService(service, input.quantity);

    const coupon = input.couponCode
      ? await this.couponsService.validateForUser(input.couponCode, input.userId, input.serviceId, input.quantity)
      : undefined;

    const pricing = await this.servicesService.computePrice({
      serviceId: input.serviceId,
      quantity: input.quantity,
      user: { id: input.userId, userGroupId: input.userGroupId },
      coupon,
    });

    // Atomic debit BEFORE order creation; retry guard prevents double charge.
    await this.walletService.debit(input.userId, pricing.finalCharge, {
      referenceType: "order",
      description: `Order for ${service.name} (${input.quantity})`,
    });

    const order = await this.orderModel.create({
      publicOrderId: publicId("ORD"),
      userId: input.userId,
      serviceId: service._id,
      providerId: service.providerId,
      providerServiceId: service.providerServiceId,
      orderType: input.orderType ?? OrderType.STANDARD,
      link: input.link,
      quantity: input.quantity,
      pricingSnapshot: {
        providerCost: pricing.providerCost,
        baseRate: pricing.baseRate,
        markup: pricing.markup,
        discount: pricing.discount,
        finalCharge: pricing.finalCharge,
        currency: pricing.currency,
      },
      status: "pending",
      idempotencyKey: input.idempotencyKey,
      apiKeyId: input.apiKeyId,
    });

    if (coupon) {
      await this.couponsService.recordRedemption(coupon, input.userId, order._id, pricing.discount);
    }

    await this.appendHistory(order._id, null, "pending", "Order created");

    // enqueue provider submission — never inside a DB tx or HTTP request to provider
    await this.orderQueue.add(
      "submit-order",
      { orderId: order._id.toString() },
      { jobId: `order-submit-${order.publicOrderId}`, attempts: 3 },
    );

    return { order: this.toDto(order) };
  }

  private validateAgainstService(service: any, quantity: number) {
    if (service.status !== "active") throw new BadRequestException("Service is not available");
    if (!service.visibility) throw new BadRequestException("Service is not available");
    if (quantity < (service.minimum ?? 1)) throw new BadRequestException(`Minimum quantity is ${service.minimum}`);
    if (quantity > (service.maximum ?? 1_000_000)) throw new BadRequestException(`Maximum quantity is ${service.maximum}`);
  }

  /** Called by the order-processing worker: submit to provider, store provider id */
  async submitToProvider(orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException("Order not found");
    if (order.status !== "pending") return { skipped: true };

    const { adapter } = await this.providerFactory.getAdapter(order.providerId);

    try {
      const result = await adapter.createOrder({
        providerServiceId: order.providerServiceId,
        link: order.link,
        quantity: order.quantity,
        runs: order.orderType === "drip_feed" ? order.runs : undefined,
        interval: order.interval,
      });
      order.providerOrderId = result.providerOrderId;
      order.providerResponse = result.raw ?? {};
      order.status = "processing";
      await order.save();
      await this.appendHistory(order._id, "pending", "processing", "Submitted to provider");
      await this.providersService.markHealth(order.providerId, true);

      // schedule status sync
      await this.statusQueue.add(
        "check-status",
        { orderId: order._id.toString(), providerOrderId: result.providerOrderId },
        {
          jobId: `status-${order.publicOrderId}`,
          attempts: 5,
          backoff: { type: "exponential", delay: 10000 },
        },
      );
      return { submitted: true, providerOrderId: result.providerOrderId };
    } catch (error: any) {
      await this.providersService.markHealth(order.providerId, false, error?.message);
      order.status = "failed";
      order.providerResponse = { error: error?.message ?? "Provider error" };
      await order.save();
      await this.appendHistory(order._id, "pending", "failed", error?.message ?? "Provider submission failed");
      // refund the customer
      await this.refundOrder(order, "Provider submission failed");
      throw error;
    }
  }

  /** Called by order-status worker: fetch provider status and normalize it */
  async syncStatus(orderId: string, providerOrderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException("Order not found");

    const { adapter } = await this.providerFactory.getAdapter(order.providerId);
    const status = await adapter.getOrderStatus(providerOrderId);
    const normalized = this.normalizeStatus(status.status);

    if (normalized && normalized !== order.status) {
      const from = order.status;
      order.status = normalized;
      if (normalized === "completed") order.completedAt = new Date();
      if (status.startCount !== undefined) order.startCount = status.startCount;
      if (status.remains !== undefined) order.remains = status.remains;
      await order.save();
      await this.appendHistory(order._id, from, normalized, `Provider status: ${status.status}`);
    } else if (status.startCount !== undefined || status.remains !== undefined) {
      if (status.startCount !== undefined) order.startCount = status.startCount;
      if (status.remains !== undefined) order.remains = status.remains;
      await order.save();
    }

    return { orderId, normalized, rawStatus: status.status };
  }

  /** Map provider-specific statuses to internal enums */
  private normalizeStatus(providerStatus: string | undefined): string | undefined {
    const s = (providerStatus ?? "").toLowerCase();
    if (!s) return undefined;
    if (s.includes("complete")) return "completed";
    if (s.includes("cancel")) return "canceled";
    if (s.includes("refund")) return "refunded";
    if (s.includes("partial")) return "partial";
    if (s.includes("fail") || s.includes("error")) return "failed";
    if (s.includes("processing")) return "processing";
    if (s.includes("progress")) return "in_progress";
    if (s.includes("pending")) return "pending";
    return undefined;
  }

  async getUserOrders(userId: string, page = 1, pageSize = 20, status?: string) {
    const query: Record<string, unknown> = { userId };
    if (status) query.status = status;
    const [items, total] = await Promise.all([
      this.orderModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      this.orderModel.countDocuments(query),
    ]);
    return { items: items.map((o) => this.toDto(o)), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async getOrder(userId: string, orderId: string, isAdmin = false) {
    const query: Record<string, unknown> = { _id: orderId };
    if (!isAdmin) query.userId = userId;
    const order = await this.orderModel.findOne(query).lean();
    if (!order) throw new NotFoundException("Order not found");
    return this.toDto(order);
  }

  async getAllOrders(page = 1, pageSize = 20, filters?: { status?: string; userId?: string }) {
    const query: Record<string, unknown> = {};
    if (filters?.status) query.status = filters.status;
    if (filters?.userId) query.userId = filters.userId;
    const [items, total] = await Promise.all([
      this.orderModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      this.orderModel.countDocuments(query),
    ]);
    return { items: items.map((o) => this.toDto(o)), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async cancelOrder(userId: string, orderId: string) {
    const order = await this.orderModel.findOne({ _id: orderId, userId });
    if (!order) throw new NotFoundException("Order not found");
    if (!["processing", "in_progress", "pending"].includes(order.status)) {
      throw new BadRequestException("Order cannot be canceled in its current state");
    }
    const service = await this.servicesService.getServiceById(order.serviceId.toString());
    if (!service.cancelSupported) throw new BadRequestException("Service does not support cancellation");

    const { adapter } = await this.providerFactory.getAdapter(order.providerId);
    if (!order.providerOrderId) {
      order.status = "canceled";
      await order.save();
      await this.appendHistory(order._id, "pending", "canceled", "Canceled before provider submission");
      await this.refundOrder(order, "Order canceled before submission");
      return { canceled: true };
    }

    try {
      await adapter.cancelOrder(order.providerOrderId);
      order.status = "canceled";
      await order.save();
      await this.appendHistory(order._id, order.status, "canceled", "Canceled via provider");
      await this.refundOrder(order, "Order canceled");
      return { canceled: true };
    } catch {
      throw new BadRequestException("Provider refused cancellation");
    }
  }

  async refundOrder(order: any, reason: string) {
    const amount = order.pricingSnapshot?.finalCharge ?? 0;
    if (amount <= 0) return;
    order.status = "refunded";
    await order.save();
    await this.appendHistory(order._id, order.status === "refunded" ? order.status : "refunded", "refunded", reason);
    await this.walletService.refund(
      { userId: order.userId.toString(), amount, referenceId: order._id.toString() },
      reason,
    );
  }

  async estimatePrice(serviceId: string, quantity: number) {
    return this.servicesService.computePrice({ serviceId, quantity });
  }

  private appendHistory(orderId: string, from: string | null, to: string, note?: string) {
    return this.historyModel.create({
      orderId,
      from: from ?? "none",
      to,
      note,
      metadata: {},
    });
  }

  private toDto(order: any) {
    return {
      id: order._id.toString(),
      publicOrderId: order.publicOrderId,
      serviceId: order.serviceId?.toString(),
      providerId: order.providerId?.toString(),
      providerOrderId: order.providerOrderId,
      link: order.link,
      quantity: order.quantity,
      status: order.status,
      orderType: order.orderType,
      pricingSnapshot: order.pricingSnapshot,
      startCount: order.startCount,
      remains: order.remains,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      completedAt: order.completedAt,
    };
  }
}