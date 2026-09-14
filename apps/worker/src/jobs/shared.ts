import { publicId } from "@smm/utils";
import { OrderType, QueueName } from "@smm/types";
import type { WorkerContext } from "../context";

export interface PlaceOrderParams {
  userId: string;
  service: any;
  link: string;
  quantity: number;
  orderType: OrderType;
  description: string;
  note?: string;
  runs?: number;
  interval?: number;
}

export async function chargeAndPlaceOrder(ctx: WorkerContext, params: PlaceOrderParams) {
  const pricing = await ctx.graph.servicesService.computePrice({
    serviceId: params.service._id.toString(),
    quantity: params.quantity,
    user: { id: params.userId },
  });

  await ctx.graph.walletService.debit(params.userId, pricing.finalCharge, {
    referenceType: "order",
    description: params.description,
  });

  const order = await ctx.graph.models.Order.create({
    publicOrderId: publicId("ORD"),
    userId: params.userId,
    serviceId: params.service._id,
    providerId: params.service.providerId,
    providerServiceId: params.service.providerServiceId,
    orderType: params.orderType,
    link: params.link,
    quantity: params.quantity,
    runs: params.runs,
    interval: params.interval,
    pricingSnapshot: {
      providerCost: pricing.providerCost,
      baseRate: pricing.baseRate,
      markup: pricing.markup,
      discount: pricing.discount,
      finalCharge: pricing.finalCharge,
      currency: pricing.currency,
    },
    status: "pending",
  });

  await ctx.graph.models.OrderStatusHistory.create({
    orderId: order._id,
    from: null,
    to: "pending",
    note: params.note ?? "Order created",
  });

  await ctx.graph.queues[QueueName.ORDER_PROCESSING].add(
    "submit-order",
    { orderId: order._id.toString() },
    { jobId: `order-submit-${order.publicOrderId}`, attempts: 3 },
  );

  return { order, pricing };
}