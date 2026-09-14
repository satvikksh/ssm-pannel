import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DripFeedService } from "@smm/domain";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequirePermissions } from "../../common/decorators";

@ApiTags("drip-feed")
@Controller("drip-feed")
export class DripFeedController {
  constructor(private readonly dripFeedService: DripFeedService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user: any, @Body() dto: any) {
    const data = await this.dripFeedService.create(user, dto);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get("my")
  async mine(@CurrentUser() user: { id: string }) {
    return { success: true, data: await this.dripFeedService.listForUser(user.id) };
  }

  @UseGuards(JwtAuthGuard)
  @Get("admin/all")
  @RequirePermissions("orders.manage")
  async adminAll(@Query("page") page = 1, @Query("pageSize") pageSize = 20) {
    const data = await this.dripFeedService.listAll(Number(page), Number(pageSize));
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id/pause")
  async pause(@CurrentUser() user: { id: string }, @Param("id") id: string) {
    return { success: true, data: await this.dripFeedService.pause(id, user.id) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id/resume")
  async resume(@CurrentUser() user: { id: string }, @Param("id") id: string) {
    return { success: true, data: await this.dripFeedService.resume(id, user.id) };
  }
}