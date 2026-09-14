import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PaymentsService, PaymentMethodRecord } from "./payments.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RequirePermissions, Public, CurrentUser } from "../../common/decorators";
import { AdminPermission } from "@smm/types";

@ApiTags("payments")
@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /** Public: enabled deposit methods (no config/secrets). */
  @Public()
  @Get("methods")
  async methods() {
    const data = await this.paymentsService.listEnabledMethods();
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Post("deposit")
  async deposit(
    @CurrentUser() user: { id: string },
    @Body() dto: { amount: number; gateway?: string; paymentMethod?: string; methodCode?: string },
  ) {
    const data = await this.paymentsService.initiateDeposit(user.id, {
      amount: dto.amount,
      gateway: dto.gateway ?? dto.methodCode ?? dto.paymentMethod ?? "manual",
      paymentMethod: dto.paymentMethod,
      methodCode: dto.methodCode ?? dto.paymentMethod ?? dto.gateway,
    });
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Post("manual")
  async manual(
    @CurrentUser() user: { id: string },
    @Body() dto: { amount: number; gateway?: string; methodCode?: string; transactionRef: string; notes?: string },
  ) {
    const data = await this.paymentsService.submitManualPayment(user.id, {
      amount: dto.amount,
      gateway: dto.gateway ?? dto.methodCode ?? "manual",
      transactionRef: dto.transactionRef,
      notes: dto.notes,
    });
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get("admin/methods")
  @RequirePermissions(AdminPermission.PAYMENTS_MANAGE)
  async adminMethods() {
    const data = await this.paymentsService.listMethods();
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Post("admin/methods")
  @RequirePermissions(AdminPermission.PAYMENTS_MANAGE)
  async createMethod(@Body() dto: Partial<PaymentMethodRecord> & { config?: Record<string, unknown> }) {
    const data = await this.paymentsService.createMethod(dto);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Patch("admin/methods/:code")
  @RequirePermissions(AdminPermission.PAYMENTS_MANAGE)
  async updateMethod(
    @Param("code") code: string,
    @Body() dto: Partial<PaymentMethodRecord> & { config?: Record<string, unknown> },
  ) {
    const data = await this.paymentsService.updateMethod(code, dto);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Delete("admin/methods/:code")
  @RequirePermissions(AdminPermission.PAYMENTS_MANAGE)
  async deleteMethod(@Param("code") code: string) {
    const data = await this.paymentsService.deleteMethod(code);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Post("admin/:id/approve")
  @RequirePermissions("payments.approve")
  async approve(@CurrentUser() admin: { id: string }, @Param("id") id: string) {
    const data = await this.paymentsService.approvePayment(id, admin.id);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Post("admin/:id/reject")
  @RequirePermissions("payments.approve")
  async reject(
    @CurrentUser() admin: { id: string },
    @Param("id") id: string,
    @Body() dto: { reason: string },
  ) {
    const data = await this.paymentsService.rejectPayment(id, admin.id, dto.reason);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Post("webhook/:gateway")
  @Public()
  async webhook(@Param("gateway") gateway: string, @Body() body: any) {
    void gateway;
    const eventId = String(body?.id ?? body?.eventId ?? `evt-${Date.now()}`);
    const eventType = String(body?.type ?? body?.event ?? "payment.success");
    const result = await this.paymentsService.handleWebhook(eventType.split(".")[0] as any, eventId, eventType, body, body?.signature);
    return { success: true, data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Get("my")
  async mine(@CurrentUser() user: { id: string }, @Query("page") page = 1, @Query("pageSize") pageSize = 20) {
    const data = await this.paymentsService.listUserPayments(user.id, Number(page), Number(pageSize));
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get("admin/all")
  @RequirePermissions("payments.view")
  async all(@Query("page") page = 1, @Query("pageSize") pageSize = 20, @Query("status") status?: string) {
    const data = await this.paymentsService.listAllPayments(Number(page), Number(pageSize), status);
    return { success: true, data };
  }
}