import { Controller, Get, Patch, Post, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators";

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifService: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get("my")
  mine(@CurrentUser() user: { id: string }, @Query("page") page = 1, @Query("pageSize") pageSize = 20) {
    return this.notifService.listForUser(user.id, Number(page), Number(pageSize));
  }

  @UseGuards(JwtAuthGuard)
  @Patch("read/:id")
  read(@CurrentUser() user: { id: string }, @Param("id") id: string) {
    return this.notifService.markRead(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("read-all")
  readAll(@CurrentUser() user: { id: string }) {
    return this.notifService.markAllRead(user.id);
  }
}