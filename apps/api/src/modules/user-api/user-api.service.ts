import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { hashKey, generateApiKey } from "@smm/security";
import { OrdersService, RefillsService, WalletService } from "@smm/domain";

@Injectable()
export class UserApiService {
  constructor(
    @InjectModel("ApiKey") private readonly apiKeyModel: Model<any>,
    @InjectModel("ApiLog") private readonly apiLogModel: Model<any>,
    private readonly ordersService: OrdersService,
    private readonly refillsService: RefillsService,
    private readonly walletService: WalletService,
  ) {}

  async createKey(userId: string, dto: { name: string; permissions?: string[]; ipRestrictions?: string[] }) {
    const { keyId, secret, keyHash } = generateApiKey();
    await this.apiKeyModel.create({
      keyId,
      userId,
      name: dto.name,
      keyHash,
      permissions: dto.permissions ?? ["services.view", "orders.create", "orders.view", "balance.view"],
      ipRestrictions: dto.ipRestrictions ?? [],
      enabled: true,
    });
    return { keyId, secret, note: "Store the secret — it is shown only once." };
  }

  async listKeys(userId: string) {
    const keys = (await this.apiKeyModel.find({ userId }).select("keyId name permissions enabled lastUsedAt createdAt ipRestrictions").lean()) as any[];
    return keys.map((k) => ({ ...k, _id: String(k._id) }));
  }

  async revokeKey(userId: string, keyId: string) {
    const res = await this.apiKeyModel.updateOne({ keyId, userId }, { $set: { enabled: false } });
    if (res.matchedCount === 0) throw new NotFoundException("API key not found");
    return { ok: true };
  }

  /** Authenticate an API request via X-API-Key header. Returns key owner. */
  async authenticate(apiKey: string, ip: string): Promise<any> {
    const keyHash = hashKey(apiKey);
    const key = await this.apiKeyModel.findOne({ keyHash });
    if (!key || !key.enabled) throw new UnauthorizedException("Invalid API key");

    if (Array.isArray(key.ipRestrictions) && key.ipRestrictions.length > 0 && !key.ipRestrictions.includes(ip)) {
      throw new UnauthorizedException("IP not allowed for this API key");
    }

    await this.apiKeyModel.updateOne({ _id: key._id }, { $set: { lastUsedAt: new Date() } });
    return key;
  }

  async log(entry: { apiKeyId?: string; userId?: string; endpoint: string; method: string; statusCode: number; ip?: string; durationMs?: number }) {
    await this.apiLogModel.create(entry);
  }

  /** Public API entry points (v1 public API). */

  async apiGetServices() {
    const Service = this.apiKeyModel.db.model("Service");
    return Service.find({ status: "active", visibility: true })
      .select("name slug serviceType categoryId minimum maximum customerPrice refillSupported dripFeedSupported")
      .lean();
  }

  async apiCreateOrder(userId: string, dto: { serviceId: string; link: string; quantity: number }, idempotencyKey?: string) {
    if (!dto.serviceId || !dto.link || !dto.quantity) {
      throw new BadRequestException("serviceId, link and quantity are required");
    }
    const result = await this.ordersService.create({
      serviceId: dto.serviceId,
      link: dto.link,
      quantity: dto.quantity,
      userId,
      idempotencyKey,
      orderType: "api",
    });
    return result;
  }

  async apiGetOrder(userId: string, orderId: string) {
    return this.ordersService.getOrder(userId, orderId, false);
  }

  async apiCancelOrder(userId: string, orderId: string) {
    return this.ordersService.cancelOrder(userId, orderId);
  }

  async apiCreateRefill(userId: string, orderId: string) {
    return this.refillsService.create(userId, orderId);
  }

  async apiGetBalance(userId: string) {
    return this.walletService.getBalance(userId);
  }
}