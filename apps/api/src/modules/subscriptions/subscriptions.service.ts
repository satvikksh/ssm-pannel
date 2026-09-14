import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { publicId } from "@smm/utils";
import { ServicesService } from "@smm/domain";

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel("Subscription") private readonly subModel: Model<any>,
    private readonly servicesService: ServicesService,
  ) {}

  async create(user: { id: string; userGroupId?: string }, dto: { serviceId: string; link: string; quantity: number; intervalDays: number; runs: number }) {
    const service = await this.servicesService.getServiceById(dto.serviceId);
    if (!service.subscriptionSupported) throw new BadRequestException("Service does not support subscriptions");

    const sub = await this.subModel.create({
      publicSubscriptionId: publicId("SUB"),
      userId: user.id,
      serviceId: service._id,
      providerId: service.providerId,
      link: dto.link,
      quantity: dto.quantity,
      runs: dto.runs,
      intervalDays: dto.intervalDays,
      nextRunAt: new Date(Date.now() + dto.intervalDays * 86_400_000),
      completedRuns: 0,
      status: "active",
    });
    return { subscriptionId: sub.publicSubscriptionId };
  }

  async listForUser(userId: string) {
    return this.subModel.find({ userId }).sort({ createdAt: -1 }).lean();
  }

  async listAll(page = 1, pageSize = 50) {
    return this.subModel
      .find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate("userId", "username email")
      .populate("serviceId", "name")
      .lean();
  }

  async setStatus(id: string, userId: string, status: "active" | "paused" | "canceled") {
    const sub = await this.subModel.findOne({ _id: id, userId });
    if (!sub) throw new NotFoundException("Subscription not found");
    sub.status = status;
    await sub.save();
    return sub;
  }
}