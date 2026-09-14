import { Controller, Get, Post, Body, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RefillsService } from "@smm/domain";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequirePermissions } from "../../common/decorators";

@ApiTags("refills")
@Controller("refills")
export class RefillsController {
  constructor(private readonly refillsService: RefillsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user: { id: string }, @Body() dto: { orderId: string }) {
    const data = await this.refillsService.create(user.id, dto.orderId);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get("my")
  async mine(@CurrentUser() user: { id: string }, @Query("page") page = 1, @Query("pageSize") pageSize = 20) {
    const data = await this.refillsService.listForUser(user.id, Number(page), Number(pageSize));
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get("admin/all")
  @RequirePermissions("orders.manage")
  async adminAll(@Query("page") page = 1, @Query("pageSize") pageSize = 20) {
    const data = await this.refillsService.listAll(Number(page), Number(pageSize));
    return { success: true, data };
  }
}