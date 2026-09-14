import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { hashKey } from "@smm/security";

/**
 * Authenticates third-party (user) API requests via `X-API-Key`.
 * Looks up the key by hashed secret, rejects disabled keys and keys whose
 * IP restrictions do not include the caller, then injects the key owner as
 * `request.user` with role "user".
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(@InjectModel("ApiKey") private readonly apiKeyModel: Model<any>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request?.headers?.["x-api-key"] as string | undefined;
    if (!apiKey) throw new UnauthorizedException("X-API-Key header is required");

    const keyHash = hashKey(apiKey);
    const key = await this.apiKeyModel.findOne({ keyHash, enabled: true });
    if (!key) throw new UnauthorizedException("Invalid API key");

    const ip = (request.ip as string) ?? "";
    if (Array.isArray(key.ipRestrictions) && key.ipRestrictions.length > 0 && !key.ipRestrictions.includes(ip)) {
      throw new UnauthorizedException("IP not allowed for this API key");
    }

    request.user = {
      id: String(key.userId),
      role: "user",
      permissions: key.permissions ?? [],
      apiKeyId: String(key._id),
    };
    request.apiKey = key;
    return true;
  }
}