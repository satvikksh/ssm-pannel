import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { UserApiService } from "./user-api.service";
import { ApiKeyAuthGuard } from "./guards/api-key-auth.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Public, CurrentUser } from "../../common/decorators";
import { Request } from "express";

/**
 * Third-party (user) public API — documented in /api/docs and docs/API.
 * Authenticated with `X-API-Key`. These endpoints are also reachable via the
 * main controllers; they exist to satisfy the exact public-API path contract.
 */
@ApiTags("user-api")
@Controller()
export class UserApiController {
  constructor(private readonly userApiService: UserApiService) {}

  private async logCall(req: Request, key: any, endpoint: string, statusCode: number) {
    await this.userApiService.log({
      apiKeyId: key?._id?.toString(),
      userId: key?.userId?.toString(),
      endpoint,
      method: req.method,
      statusCode,
      ip: req.ip,
    });
  }

  @Public()
  @UseGuards(ApiKeyAuthGuard)
  @Post("order")
  async createOrder(@Req() req: Request, @Body() dto: any) {
    const key = (req as any).apiKey;
    try {
      const data = await this.userApiService.apiCreateOrder(
        key.userId.toString(),
        { serviceId: dto.service, link: dto.link, quantity: dto.quantity },
        dto.idempotencyKey,
      );
      await this.logCall(req, key, "POST /api/v1/order", 200);
      return { success: true, order: data };
    } catch (e: any) {
      await this.logCall(req, key, "POST /api/v1/order", e?.status ?? 400);
      throw e;
    }
  }

  @Public()
  @UseGuards(ApiKeyAuthGuard)
  @Get("order/:orderId")
  async getOrder(@Req() req: Request, @Param("orderId") orderId: string) {
    const key = (req as any).apiKey;
    const data = await this.userApiService.apiGetOrder(key.userId.toString(), orderId);
    await this.logCall(req, key, "GET /api/v1/order/:id", 200);
    return { success: true, data };
  }

  @Public()
  @UseGuards(ApiKeyAuthGuard)
  @Post("cancel")
  async cancelOrder(@Req() req: Request, @Body() dto: { orderId: string }) {
    const key = (req as any).apiKey;
    const data = await this.userApiService.apiCancelOrder(key.userId.toString(), dto.orderId);
    await this.logCall(req, key, "POST /api/v1/cancel", 200);
    return { success: true, data };
  }

  @Public()
  @UseGuards(ApiKeyAuthGuard)
  @Post("refill")
  async refill(@Req() req: Request, @Body() dto: { orderId: string }) {
    const key = (req as any).apiKey;
    const data = await this.userApiService.apiCreateRefill(key.userId.toString(), dto.orderId);
    await this.logCall(req, key, "POST /api/v1/refill", 200);
    return { success: true, data };
  }

  @Public()
  @UseGuards(ApiKeyAuthGuard)
  @Get("balance")
  async balance(@Req() req: Request) {
    const key = (req as any).apiKey;
    const data = await this.userApiService.apiGetBalance(key.userId.toString());
    await this.logCall(req, key, "GET /api/v1/balance", 200);
    return { success: true, data };
  }

  // ---- API key management (session authenticated) ----

  @UseGuards(JwtAuthGuard)
  @Post("api-keys")
  createKey(@CurrentUser() user: { id: string }, @Body() dto: { name: string; permissions?: string[]; ipRestrictions?: string[] }) {
    return this.userApiService.createKey(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("api-keys")
  listKeys(@CurrentUser() user: { id: string }) {
    return this.userApiService.listKeys(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("api-keys/:keyId/revoke")
  revokeKey(@CurrentUser() user: { id: string }, @Param("keyId") keyId: string) {
    return this.userApiService.revokeKey(user.id, keyId);
  }
}