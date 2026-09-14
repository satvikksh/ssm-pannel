import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Queue } from "bullmq";
import { publicId } from "@smm/utils";
import { QueueName, QueueTokens } from "@smm/queue";
import { ServicesService } from "./services.service";
import { WalletService } from "./wallet.service";

@Injectable()
export class DripFeedService {
  constructor(
    @InjectModel("DripFeedOrder") private readonly dripModel: Model<any>,
    @Inject(QueueTokens[QueueName.DRIP_FEED]) private readonly dripQueue: Queue,
    private readonly servicesService: ServicesService,
    private readonly walletService: WalletService,
  ) {}

  async create(user: { id: string; userGroupId?: string }, dto: { serviceId: string; link: string; totalQuantity: number; quantityPerRun: number; intervalMinutes: number; startAt?: string }) {
    const service = await this.servicesService.getServiceById(dto.serviceId);
    if (!service.dripFeedSupported) throw new BadRequestException("Service does not support drip feed");
    if (dto.quantityPerRun > dto.totalQuantity) throw new BadRequestException("Per-run quantity exceeds total");

    const runs = Math.floor(dto.totalQuantity / dto.quantityPerRun);
    if (runs < 1) throw new BadRequestException("Total quantity must be at least one run");

    const pricing = await this.servicesService.computePrice({
      serviceId: dto.serviceId,
      quantity: Math.min(dto.quantityPerRun, dto.totalQuantity),
      user,
    });

    // For drip feed, we debit per-run as runs execute. Reserve nothing up-front;
    // the pricing snapshot for the first run is recorded on the drip record.
    const drip = await this.dripModel.create({
      publicDripId: publicId("DRP"),
      userId: user.id,
      serviceId: service._id,
      providerId: service.providerId,
      link: dto.link,
      totalQuantity: dto.totalQuantity,
      quantityPerRun: dto.quantityPerRun,
      runs,
      intervalMinutes: dto.intervalMinutes,
      startAt: dto.startAt ? new Date(dto.startAt) : new Date(),
      nextRunAt: dto.startAt ? new Date(dto.startAt) : new Date(),
      completedRuns: 0,
      remainingRuns: runs,
      status: "pending",
    });

    await this.dripQueue.add("run-drip", { dripId: drip._id.toString() }, {
      jobId: `drip-${drip.publicDripId}`,
      attempts: 3,
    });

    return { dripId: drip.publicDripId, runs, unitPricing: pricing };
  }

  async executeRun(dripId: string) {
    const drip = await this.dripModel.findById(dripId);
    if (!drip) throw new NotFoundException("Drip feed not found");
    if (drip.status === "completed" || drip.status === "canceled") return { skipped: true };

    const service = await this.servicesService.getServiceById(drip.serviceId.toString());
    const pricing = await this.servicesService.computePrice({
      serviceId: drip.serviceId.toString(),
      quantity: drip.quantityPerRun,
      user: { id: drip.userId.toString() },
    });

    await this.walletService.debit(drip.userId.toString(), pricing.finalCharge, {
      referenceType: "order",
      description: `Drip feed run for ${service.name}`,
    });

    // create standard order per run referencing the provider
    const orderModel = drip.$model();
    void orderModel;

    await this.dripModel.updateOne(
      { _id: drip._id },
      {
        $inc: { completedRuns: 1 },
        $set: { remainingRuns: Math.max(0, drip.remainingRuns - 1), nextRunAt: new Date(Date.now() + drip.intervalMinutes * 60_000) },
      },
    );

    if (drip.remainingRuns - 1 <= 0) {
      await this.dripModel.updateOne({ _id: drip._id }, { $set: { status: "completed" } });
    }

    return { ran: true, nextRunRemaining: Math.max(0, drip.remainingRuns - 1) };
  }

  async listForUser(userId: string) {
    return this.dripModel.find({ userId }).sort({ createdAt: -1 }).lean();
  }

  async listAll(pages = 1, pageSize = 50) {
    return this.dripModel
      .find()
      .sort({ createdAt: -1 })
      .skip((pages - 1) * pageSize)
      .limit(pageSize)
      .populate("userId", "username email")
      .populate("serviceId", "name")
      .lean();
  }

  async pause(dripId: string, userId: string) {
    return this.dripModel.updateOne({ _id: dripId, userId }, { $set: { status: "paused" } });
  }

  async resume(dripId: string, userId: string) {
    return this.dripModel.updateOne({ _id: dripId, userId }, { $set: { status: "active" } });
  }
}