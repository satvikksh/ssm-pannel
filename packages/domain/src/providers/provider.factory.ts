import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { decryptSecret } from "@smm/security";
import { ProviderAdapter } from "./provider.interface";
import { GenericProviderAdapter, GenericProviderConfig } from "./adapters/generic.adapter";
import { FakeProviderAdapter } from "./adapters/fake.adapter";

/**
 * Registry that resolves a provider document to its adapter instance.
 * The rest of the system consumes ONLY ProviderAdapter.
 */
@Injectable()
export class ProviderFactory {
  constructor(
    @InjectModel("Provider") private readonly providerModel: Model<any>,
  ) {}

  getAdapterFor(adapterName: string, provider: any): ProviderAdapter {
    switch (adapterName) {
      case "fake":
        return new FakeProviderAdapter();
      case "generic": {
        const encKey = process.env.ENCRYPTION_KEY ?? "";
        const apiKey = provider.config?.apiKeyEncrypted ? decryptSecret(provider.config.apiKeyEncrypted, encKey) : provider.config?.apiKey;
        const config: GenericProviderConfig = {
          apiUrl: provider.baseUrl,
          apiKey: apiKey ?? "",
          authStyle: provider.config?.authStyle ?? "query",
          authKeyParam: provider.config?.authKeyParam ?? "key",
          responseMapping: provider.config?.responseMapping ?? {
            serviceId: "service", name: "name", rate: "rate", min: "min", max: "max", orderId: "order", status: "status", balance: "balance", refillId: "refill",
          },
        };
        return new GenericProviderAdapter(config);
      }
      default:
        throw new BadRequestException(`Unsupported provider adapter: ${adapterName}`);
    }
  }

  async getAdapter(providerId: string): Promise<{ provider: any; adapter: ProviderAdapter }> {
    const provider = await this.providerModel.findById(providerId);
    if (!provider) throw new NotFoundException("Provider not found");
    if (provider.status === "inactive" || provider.status === "suspended") {
      throw new BadRequestException("Provider is not active");
    }
    return { provider, adapter: this.getAdapterFor(provider.adapter, provider) };
  }
}