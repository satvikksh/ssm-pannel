import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { encryptSecret } from "@smm/security";
import { ProviderFactory } from "./provider.factory";
import { CreateProviderDto } from "./dto/provider.dto";

@Injectable()
export class ProvidersService {
  constructor(
    @InjectModel("Provider") private readonly providerModel: Model<any>,
    @InjectModel("ProviderService") private readonly providerServiceModel: Model<any>,
    private readonly factory: ProviderFactory,
  ) {}

  async create(dto: CreateProviderDto) {
    const encKey = process.env.ENCRYPTION_KEY ?? "";
    const config: Record<string, unknown> = { authStyle: dto.authStyle ?? "query", responseMapping: dto.responseMapping ?? {} };
    if (dto.apiKey) config.apiKeyEncrypted = encryptSecret(dto.apiKey, encKey);
    if (dto.apiSecret) config.apiSecretEncrypted = encryptSecret(dto.apiSecret, encKey);

    const provider = await this.providerModel.create({
      name: dto.name,
      slug: dto.slug,
      adapter: dto.adapter,
      baseUrl: dto.baseUrl,
      config,
      status: "active",
      health: { score: 100, consecutiveFailures: 0 },
      currency: dto.currency ?? "INR",
      timeoutMs: dto.timeoutMs ?? 30000,
      retries: dto.retries ?? 3,
    });
    return provider;
  }

  async findAll() {
    const providers = await this.providerModel.find().select("-config").lean();
    return providers.map((p) => this.sanitize(p));
  }

  private sanitize(p: any) {
    const doc = { ...p };
    delete doc.config;
    return doc;
  }

  async syncServices(providerId: string) {
    const { adapter } = await this.factory.getAdapter(providerId);
    const services = await adapter.getServices();
    let imported = 0;
    let updated = 0;

    for (const s of services) {
      const existing = await this.providerServiceModel.findOne({
        providerId,
        providerServiceId: String(s.service),
      });
      if (existing) {
        existing.name = s.name;
        existing.price = s.rate;
        existing.min = s.min;
        existing.max = s.max;
        existing.refill = s.refill;
        existing.cancel = s.cancel;
        existing.dripFeed = s.dripFeed;
        existing.subscription = s.subscription;
        existing.raw = s as unknown as Record<string, unknown>;
        await existing.save();
        updated++;
      } else {
        await this.providerServiceModel.create({
          providerId,
          providerServiceId: String(s.service),
          name: s.name,
          type: s.type,
          category: s.category,
          price: s.rate,
          min: s.min,
          max: s.max,
          refill: s.refill,
          cancel: s.cancel,
          dripFeed: s.dripFeed,
          subscription: s.subscription,
          raw: s as unknown as Record<string, unknown>,
        });
        imported++;
      }
    }

    await this.providerModel.updateOne({ _id: providerId }, {
      $set: { "health.lastOkAt": new Date(), "health.consecutiveFailures": 0 },
    });

    return { imported, updated, total: services.length };
  }

  async getBalance(providerId: string) {
    const { provider, adapter } = await this.factory.getAdapter(providerId);
    const balance = await adapter.getBalance();
    await this.providerModel.updateOne({ _id: providerId }, { $set: { balance } });
    return { providerId, balance, currency: provider.currency };
  }

  async testConnection(providerId: string) {
    const { adapter } = await this.factory.getAdapter(providerId);
    const balance = await adapter.getBalance();
    return { ok: true, balance };
  }

  async getProviderServices(providerId: string, search?: string) {
    const query: Record<string, unknown> = { providerId };
    if (search) query.name = { $regex: search, $options: "i" };
    return this.providerServiceModel.find(query).sort({ price: 1 }).limit(500).lean();
  }

  async markHealth(providerId: string, ok: boolean, error?: string) {
    const update: Record<string, unknown> = ok
      ? { $set: { "health.lastOkAt": new Date(), "health.consecutiveFailures": 0, status: "active" } }
      : { $inc: { "health.consecutiveFailures": 1 }, $set: { "health.lastErrorAt": new Date(), "health.lastError": error ?? "Unknown error" } };
    await this.providerModel.updateOne({ _id: providerId }, update);
  }
}