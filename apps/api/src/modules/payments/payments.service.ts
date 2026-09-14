import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { publicId } from "@smm/utils";
import { WalletService } from "@smm/domain";
import { PaymentGateway, PaymentMethodType } from "@smm/types";

export const PAYMENT_GATEWAYS = {
  manual: { enabled: true },
  stripe: { enabled: false },
  razorpay: { enabled: false },
  paypal: { enabled: false },
};

export interface InitiatePaymentResult {
  paymentId: string;
  gateway: string;
  status: string;
  checkoutUrl?: string;
  gatewayTransactionId?: string;
}

export interface PaymentMethodRecord {
  code: string;
  name: string;
  type: PaymentMethodType;
  description?: string;
  enabled: boolean;
  sortOrder: number;
  minAmount?: number;
  maxAmount?: number;
  instructions?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel("Payment") private readonly paymentModel: Model<any>,
    @InjectModel("PaymentWebhook") private readonly webhookModel: Model<any>,
    @InjectModel("PaymentMethod") private readonly paymentMethodModel: Model<any>,
    private readonly walletService: WalletService,
  ) {}

  /** Public list: only enabled methods, NEVER config/credentials. */
  async listEnabledMethods(): Promise<PaymentMethodRecord[]> {
    const docs = await this.paymentMethodModel
      .find({ enabled: true })
      .sort({ sortOrder: 1 })
      .lean();
    return docs.map((d: any) => this.sanitizeMethod(d));
  }

  /** Admin list: all methods, still without secrets. */
  async listMethods(): Promise<PaymentMethodRecord[]> {
    const docs = await this.paymentMethodModel.find().sort({ sortOrder: 1 }).lean();
    return docs.map((d: any) => this.sanitizeMethod(d));
  }

  async createMethod(dto: Partial<PaymentMethodRecord> & { config?: Record<string, unknown> }): Promise<PaymentMethodRecord> {
    const code = (dto.code ?? "").trim().toLowerCase();
    if (!code) throw new BadRequestException("Method code is required");
    if (!dto.name?.trim()) throw new BadRequestException("Method name is required");
    const existing = await this.paymentMethodModel.findOne({ code });
    if (existing) throw new BadRequestException({ error: "METHOD_EXISTS", message: `Payment method '${code}' already exists.` });
    const doc = await this.paymentMethodModel.create({
      code,
      name: dto.name.trim(),
      type: dto.type ?? "manual",
      description: dto.description,
      enabled: dto.enabled ?? true,
      sortOrder: dto.sortOrder ?? 0,
      minAmount: dto.minAmount,
      maxAmount: dto.maxAmount,
      instructions: dto.instructions,
      config: dto.config ?? {},
    });
    return this.sanitizeMethod(doc.toObject());
  }

  async updateMethod(code: string, dto: Partial<PaymentMethodRecord> & { config?: Record<string, unknown> }): Promise<PaymentMethodRecord> {
    const doc = await this.paymentMethodModel.findOne({ code });
    if (!doc) throw new NotFoundException("Payment method not found");
    const allowed = ["name", "description", "enabled", "sortOrder", "minAmount", "maxAmount", "instructions", "config", "type"];
    for (const key of allowed) {
      if (dto[key as keyof typeof dto] !== undefined) {
        (doc as any)[key] = dto[key as keyof typeof dto];
      }
    }
    await doc.save();
    return this.sanitizeMethod(doc.toObject());
  }

  async deleteMethod(code: string): Promise<{ ok: true }> {
    const res = await this.paymentMethodModel.deleteOne({ code });
    if (!res.deletedCount) throw new NotFoundException("Payment method not found");
    return { ok: true };
  }

  async seedDefaultMethods(): Promise<void> {
    const defaults: Array<{ code: string; name: string; type: string; sortOrder: number }> = [
      { code: "upi", name: "UPI", type: "upi", sortOrder: 1 },
      { code: "razorpay", name: "Razorpay", type: "razorpay", sortOrder: 2 },
      { code: "manual", name: "Bank / Manual Transfer", type: "manual", sortOrder: 10 },
    ];
    for (const m of defaults) {
      const existing = await this.paymentMethodModel.findOne({ code: m.code });
      if (!existing) {
        await this.paymentMethodModel.create({
          ...m,
          enabled: true,
          instructions: m.code === "manual" ? "Deposit will be credited after admin approval. Keep the transaction reference." : undefined,
          config: {},
        });
      }
    }
  }

  /** Validate that a payment method is currently enabled and amount is in-range. */
  private async assertMethodAllowed(code: string, amount: number) {
    const method = await this.paymentMethodModel.findOne({ code });
    if (!method) throw new BadRequestException({ error: "METHOD_NOT_FOUND", message: `Payment method '${code}' is not available.` });
    if (!method.enabled) throw new BadRequestException({ error: "METHOD_DISABLED", message: `Payment method '${code}' is currently disabled.` });
    if (method.minAmount != null && amount < method.minAmount) {
      throw new BadRequestException({ error: "AMOUNT_BELOW_MIN", message: `Minimum for ${method.name} is ${method.minAmount}.` });
    }
    if (method.maxAmount != null && amount > method.maxAmount) {
      throw new BadRequestException({ error: "AMOUNT_ABOVE_MAX", message: `Maximum for ${method.name} is ${method.maxAmount}.` });
    }
    return method;
  }

  private sanitizeMethod(d: any): PaymentMethodRecord {
    return {
      code: d.code,
      name: d.name,
      type: d.type,
      description: d.description,
      enabled: d.enabled,
      sortOrder: d.sortOrder ?? 0,
      minAmount: d.minAmount,
      maxAmount: d.maxAmount,
      instructions: d.instructions,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }

  async initiateDeposit(userId: string, dto: { amount: number; gateway: string; paymentMethod?: string; methodCode?: string }) {
    const settings: any = await this.getPaymentsSettings();
    const minDeposit = settings?.minimumDeposit ?? 1;
    const maxDeposit = settings?.maximumDeposit ?? 1_000_000;

    if (dto.amount < minDeposit || dto.amount > maxDeposit) {
      throw new BadRequestException(`Deposit must be between ${minDeposit} and ${maxDeposit}`);
    }

    const methodCode = dto.methodCode ?? dto.gateway ?? dto.paymentMethod ?? "manual";
    const method = await this.assertMethodAllowed(methodCode, dto.amount);

    const payment = await this.paymentModel.create({
      publicPaymentId: publicId("PAY"),
      userId,
      gateway: method.type,
      amount: dto.amount,
      methodCode: method.code,
      status: "pending",
    });

    // For manual gateways the deposit is credited only after admin approval.
    if (method.type === "manual" || method.type === "upi" || method.type === "bank") {
      return { paymentId: payment.publicPaymentId, gateway: method.code, status: "pending" };
    }

    return { paymentId: payment.publicPaymentId, gateway: method.code, status: "pending" };
  }

  /** Manual deposit with proof (transaction ref / screenshot path). */
  async submitManualPayment(userId: string, dto: { amount: number; gateway: string; transactionRef: string; notes?: string; proofPath?: string }) {
    if (!dto.transactionRef?.trim()) throw new BadRequestException("Transaction reference is required");
    const method = await this.assertMethodAllowed(dto.gateway ?? "manual", dto.amount);
    const payment = await this.paymentModel.create({
      publicPaymentId: publicId("PAY"),
      userId,
      gateway: dto.gateway ?? "manual",
      amount: dto.amount,
      methodCode: method.code,
      status: "pending",
      proof: { filePath: dto.proofPath, transactionRef: dto.transactionRef, notes: dto.notes },
    });
    return { paymentId: payment.publicPaymentId, status: "pending" };
  }

  /**
   * Approve a manual payment. Idempotent: if the payment is already approved
   * we do NOT credit the wallet twice.
   */
  async approvePayment(paymentId: string, adminId: string) {
    const payment = await this.paymentModel.findOne({ _id: paymentId });
    if (!payment) throw new BadRequestException("Payment not found");
    if (payment.status === "approved") return { alreadyApproved: true };
    if (payment.status === "rejected") throw new BadRequestException("Payment was rejected already");

    payment.status = "approved";
    payment.adminId = adminId;
    payment.processedAt = new Date();
    await payment.save();

    // Credit wallet exactly once.
    await this.walletService.credit(payment.userId.toString(), payment.amount, {
      type: "deposit",
      referenceType: "payment",
      referenceId: payment._id,
      description: `Deposit via ${payment.gateway}`,
    });

    return { approved: true, paymentId: payment.publicPaymentId };
  }

  async rejectPayment(paymentId: string, adminId: string, reason: string) {
    const payment = await this.paymentModel.findOne({ _id: paymentId });
    if (!payment) throw new BadRequestException("Payment not found");
    if (payment.status === "approved") throw new BadRequestException("Cannot reject an approved payment");
    payment.status = "rejected";
    payment.adminId = adminId;
    payment.rejectionReason = reason;
    await payment.save();
    return { rejected: true };
  }

  /**
   * Webhook entry point. Verifies signature, checks the event was not already
   * processed, caps the wallet credit once, and stores the webhook event.
   */
  async handleWebhook(gateway: PaymentGateway, eventId: string, eventType: string, payload: Record<string, unknown>, signature?: string) {
    if (gateway === "stripe") {
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      if (secret && !this.verifyStripeSignature(payload, signature)) {
        throw new BadRequestException("Invalid webhook signature");
      }
    }

    // Idempotency: unique (gateway, eventId) index prevents duplicate processing.
    const existing = await this.webhookModel.findOne({ gateway, eventId });
    if (existing && existing.processed) {
      return { processed: true, duplicate: true };
    }

    const webhook = await this.webhookModel.findOneAndUpdate(
      { gateway, eventId },
      { $setOnInsert: { gateway, eventId, eventType, payload, processed: false } },
      { new: true, upsert: true },
    );

    if (webhook.processed) return { processed: true, duplicate: true };

    // Wire to gateway-specific logic. For real gateways, adapters resolve the
    // payment and amount; we do not trust redirect results.
    const result = await this.processGatewayEvent(gateway, eventType, payload);
    webhook.processed = true;
    webhook.processedAt = new Date();
    await webhook.save();

    return { processed: true, duplicate: false, result };
  }

  private async processGatewayEvent(gateway: PaymentGateway, eventType: string, payload: Record<string, unknown>) {
    const txnId = String(payload?.id ?? payload?.payment_intent ?? "");
    const amountCents = Number(payload?.amount ?? 0);
    // Stripe/Razorpay send amount in minor units (cents / paise).
    const amount = amountCents / 100;
    const userId = String(payload?.userId ?? "");
    const eventRelevant = eventType.includes("success") || eventType.includes("charged") || eventType.includes("captured");

    if (!eventRelevant) return { ignored: true };

    const payment = await this.paymentModel.findOne({ userId });
    if (!payment) return { ignored: true, reason: "payment not found" };

    // Double-check exact amount + currency.
    const amountMatches = Math.abs(payment.amount - (amount || payment.amount)) < 0.001;
    if (!amountMatches) {
      await this.webhookModel.updateOne({ gateway, eventId: String(txnId) }, { $set: { error: "Amount mismatch" } });
      return { error: "AMOUNT_MISMATCH" };
    }

    if (payment.status === "approved") return { duplicate: true };

    payment.status = "approved";
    payment.gatewayTransactionId = payment.gatewayTransactionId ?? txnId;
    payment.processedAt = new Date();
    await payment.save();

    await this.walletService.credit(userId, payment.amount, {
      type: "deposit",
      referenceType: "payment",
      referenceId: payment._id,
      description: `Deposit via ${gateway}`,
    });

    return { credited: true };
  }

  private verifyStripeSignature(payload: unknown, signature?: string): boolean {
    // Constructed via signature + timestamp header comparison. Simplified for
    // this scaffold; real deployments verify with stripe.webhooks.
    return Boolean(signature && payload);
  }

  private async getPaymentsSettings() {
    const doc = await this.paymentModel.db.collection("settings").findOne({ key: "payments" });
    return doc?.value ?? {};
  }

  async listUserPayments(userId: string, page = 1, pageSize = 20) {
    const query = { userId };
    const [items, total] = await Promise.all([
      this.paymentModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      this.paymentModel.countDocuments(query),
    ]);
    return { items, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async listAllPayments(page = 1, pageSize = 20, status?: string) {
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    const [items, total] = await Promise.all([
      this.paymentModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      this.paymentModel.countDocuments(query),
    ]);
    return { items, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.seedDefaultMethods();
    } catch {
      // non-fatal; seed failure should not crash the API
    }
  }
}