import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { publicId } from "@smm/utils";

@Injectable()
export class TicketsService {
  constructor(
    @InjectModel("Ticket") private readonly ticketModel: Model<any>,
    @InjectModel("TicketMessage") private readonly messageModel: Model<any>,
  ) {}

  async create(userId: string, dto: { subject: string; category: string; priority: string; message: string }) {
    const ticket = await this.ticketModel.create({
      publicTicketId: publicId("TCK"),
      userId,
      subject: dto.subject,
      category: dto.category,
      priority: dto.priority,
      status: "open",
    });
    await this.messageModel.create({
      ticketId: ticket._id,
      senderId: userId,
      senderRole: "user",
      body: dto.message,
    });
    return { ticketId: ticket.publicTicketId };
  }

  async listForUser(userId: string, page = 1, pageSize = 20) {
    const query = { userId };
    const [items, total] = await Promise.all([
      this.ticketModel.find(query).sort({ updatedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      this.ticketModel.countDocuments(query),
    ]);
    return { items, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async messages(ticketId: string, userId?: string, isAdmin = false) {
    const query: Record<string, unknown> = { _id: ticketId };
    if (!isAdmin) query.userId = userId;
    const ticket = (await this.ticketModel.findOne(query).lean()) as any;
    if (!ticket) throw new NotFoundException("Ticket not found");
    const messages = await this.messageModel.find({ ticketId: ticket._id, isInternal: isAdmin ? undefined : false }).sort({ createdAt: 1 }).lean();
    return { ticket, messages };
  }

  async reply(ticketId: string, sender: { id: string; role: "user" | "admin" }, body: string, isInternal = false) {
    const ticket = await this.ticketModel.findById(ticketId);
    if (!ticket) throw new NotFoundException("Ticket not found");
    await this.messageModel.create({ ticketId: ticket._id, senderId: sender.id, senderRole: sender.role, body, isInternal });
    ticket.status = sender.role === "admin" ? "answered" : "open";
    ticket.lastReplyAt = new Date();
    await ticket.save();
    return { ok: true };
  }

  async close(ticketId: string, userId: string) {
    const ticket = await this.ticketModel.findOneAndUpdate({ _id: ticketId, userId }, { $set: { status: "closed" } }, { new: true });
    if (!ticket) throw new NotFoundException("Ticket not found");
    return ticket;
  }

  // admin
  async listAll(status?: string, page = 1, pageSize = 20) {
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    const [items, total] = await Promise.all([
      this.ticketModel.find(query).sort({ updatedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      this.ticketModel.countDocuments(query),
    ]);
    return { items, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }
}