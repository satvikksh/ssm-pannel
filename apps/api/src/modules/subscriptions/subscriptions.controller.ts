import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SubscriptionsService } from "./subscriptions.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequirePermissions } from "../../common/decorators";

@ApiTags("subscriptions")
@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private readonly subsService: SubscriptionsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user: any, @Body() dto: any) {
    return { success: true, data: { ...(await this.subsService.create(user, dto)) } };
  }

  @UseGuards(JwtAuthGuard)
  @Get("my")
  async mine(@CurrentUser() user: { id: string }) {
    return { success: true, data: await this.subsService.listForUser(user.id) };
  }

  @UseGuards(JwtAuthGuard)
  @Get("admin/all")
  @RequirePermissions("orders.manage")
  async adminAll(@Query("page") page = 1, @Query("pageSize") pageSize = 20) {
    return { success: true, data: await this.subsService.listAll(Number(page), Number(pageSize)) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id/:status")
  async status(
    @CurrentUser() user: { id: string },
    @Param("id") id: string,
    @Param("status") status: "active" | "paused" | "canceled",
  ) {
    return { success: true, data: await this.subsService.setStatus(id, user.id, status) };
  }
}