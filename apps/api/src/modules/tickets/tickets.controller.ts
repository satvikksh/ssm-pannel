import { Body, Controller, Get, Post, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { TicketsService } from "./tickets.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RequirePermissions, CurrentUser } from "../../common/decorators";

@ApiTags("tickets")
@Controller("tickets")
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: any) {
    return this.ticketsService.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("my")
  mine(@CurrentUser() user: { id: string }, @Query("page") page = 1, @Query("pageSize") pageSize = 20) {
    return this.ticketsService.listForUser(user.id, Number(page), Number(pageSize));
  }

  @UseGuards(JwtAuthGuard)
  @Post("my/:id/reply")
  reply(@CurrentUser() user: { id: string }, @Param("id") id: string, @Body() dto: { message: string }) {
    return this.ticketsService.reply(id, { id: user.id, role: "user" }, dto.message);
  }

  @UseGuards(JwtAuthGuard)
  @Post("my/:id/close")
  close(@CurrentUser() user: { id: string }, @Param("id") id: string) {
    return this.ticketsService.close(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get("my/:id")
  messages(@CurrentUser() user: { id: string }, @Param("id") id: string) {
    return this.ticketsService.messages(id, user.id, false);
  }

  @UseGuards(JwtAuthGuard)
  @Get("admin/all")
  @RequirePermissions("tickets.view")
  all(@Query("status") status?: string, @Query("page") page = 1, @Query("pageSize") pageSize = 20) {
    return this.ticketsService.listAll(status, Number(page), Number(pageSize));
  }

  @UseGuards(JwtAuthGuard)
  @Post("admin/:id/reply")
  @RequirePermissions("tickets.manage")
  adminReply(
    @CurrentUser() admin: { id: string },
    @Param("id") id: string,
    @Body() dto: { message: string; isInternal?: boolean },
  ) {
    return this.ticketsService.reply(id, { id: admin.id, role: "admin" }, dto.message, dto.isInternal);
  }
}