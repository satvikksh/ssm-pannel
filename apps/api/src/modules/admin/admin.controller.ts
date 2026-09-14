import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminService } from "./admin.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequirePermissions } from "../../common/decorators";
import { WalletTransactionType } from "@smm/types";

@ApiTags("admin")
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @UseGuards(JwtAuthGuard)
  @Get("dashboard")
  @RequirePermissions("admin.dashboard")
  dashboard() {
    return this.adminService.dashboard();
  }

  @UseGuards(JwtAuthGuard)
  @Get("revenue")
  @RequirePermissions("admin.dashboard")
  revenue(@Query("days") days = 30) {
    return this.adminService.revenueByDay(Number(days));
  }

  @UseGuards(JwtAuthGuard)
  @Get("orders-by-status")
  @RequirePermissions("admin.dashboard")
  ordersByStatus() {
    return this.adminService.ordersByStatus();
  }

  @UseGuards(JwtAuthGuard)
  @Post("users/:userId/balance")
  @RequirePermissions("admin.finance")
  adjustBalance(
    @CurrentUser() admin: { id: string },
    @Param("userId") userId: string,
    @Body() dto: { amount: number; type: WalletTransactionType; reason: string },
  ) {
    return this.adminService.adjustBalance(userId, {
      amount: dto.amount,
      type: dto.type,
      reason: dto.reason ?? "Admin adjustment",
      adminId: admin.id,
    });
  }
}