import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Queue } from "bullmq";
import { publicId } from "@smm/utils";
import { QueueName, QueueTokens } from "@smm/queue";
import { ProviderFactory } from "../providers/provider.factory";

@Injectable()
export class RefillsService {
  constructor(
    @InjectModel("Refill") private readonly refillModel: Model<any>,
    @Inject(QueueTokens[QueueName.REFILL_PROCESSING]) private readonly refillQueue: Queue,
    private readonly providerFactory: ProviderFactory,
  ) {}

  async create(userId: string, orderId: string) {
    const orderModel: Model<any> = this.refillModel.db.model("Order");
    const order = await orderModel.findOne({ _id: orderId, userId });
    if (!order) throw new NotFoundException("Order not found");
    if (order.status !== "completed" && order.status !== "partial") {
      throw new BadRequestException("Only completed orders can be refilled");
    }
    const service = await orderModel.db.model("Service").findById(order.serviceId);
    if (!service?.refillSupported) throw new BadRequestException("Service does not support refill");

    const refill = await this.refillModel.create({
      publicRefillId: publicId("RFL"),
      orderId: order._id,
      userId,
      providerId: order.providerId,
      status: "pending",
    });

    await this.refillQueue.add(
      "process-refill",
      { refillId: refill._id.toString(), orderId: order._id.toString() },
      { jobId: `refill-${refill.publicRefillId}`, attempts: 3 },
    );

    return { refillId: refill.publicRefillId };
  }

  async process(refillId: string) {
    const refill = await this.refillModel.findById(refillId);
    if (!refill) throw new NotFoundException("Refill not found");
    if (refill.status !== "pending") return { skipped: true };

    const order = await this.refillModel.db.model("Order").findById(refill.orderId);
    if (!order?.providerOrderId) throw new BadRequestException("Order has no provider reference");

    const { adapter } = await this.providerFactory.getAdapter(refill.providerId);
    const result = await adapter.createRefill(order.providerOrderId);
    refill.providerRefillId = result.providerRefillId;
    refill.status = "processing";
    refill.providerResponse = result.raw ?? {};
    await refill.save();
    return { submitted: true };
  }

  async listForUser(userId: string, page = 1, pageSize = 20) {
    const [items, total] = await Promise.all([
      this.refillModel.find({ userId }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      this.refillModel.countDocuments({ userId }),
    ]);
    return { items, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async listAll(page = 1, pageSize = 20) {
    const [items, total] = await Promise.all([
      this.refillModel
        .find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .populate("orderId", "publicOrderId")
        .populate("userId", "username email")
        .lean(),
      this.refillModel.countDocuments(),
    ]);
    return { items, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }
}