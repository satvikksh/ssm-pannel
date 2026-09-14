import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

@Injectable()
export class NotificationsService {
  constructor(@InjectModel("Notification") private readonly notifModel: Model<any>) {}

  async create(userId: string, type: string, title: string, body: string, link?: string) {
    return this.notifModel.create({ userId, type, title, body, link, read: false });
  }

  async listForUser(userId: string, page = 1, pageSize = 20) {
    const [items, total, unread] = await Promise.all([
      this.notifModel.find({ userId }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      this.notifModel.countDocuments({ userId }),
      this.notifModel.countDocuments({ userId, read: false }),
    ]);
    return { items, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }, unread };
  }

  async markRead(userId: string, notifId: string) {
    return this.notifModel.updateOne({ _id: notifId, userId }, { $set: { read: true, readAt: new Date() } });
  }

  async markAllRead(userId: string) {
    return this.notifModel.updateMany({ userId, read: false }, { $set: { read: true, readAt: new Date() } });
  }
}