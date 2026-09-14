import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RequirePermissions } from "../../common/decorators";
import { UserRole } from "@smm/types";

const ASSIGNABLE_ADMIN_ROLES = new Set<string>([
  UserRole.ADMIN,
]);

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @RequirePermissions("users.view")
  list(@Query("page") page = 1, @Query("pageSize") pageSize = 20, @Query("search") search?: string, @Query("status") status?: string) {
    return this.usersService.list(Number(page), Number(pageSize), search, status);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @RequirePermissions("admin.manage")
  async createAdm(@Body() dto: any) {
    const role = dto.role ?? UserRole.ADMIN;
    if (role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException("Cannot create Super Admin accounts through this endpoint.");
    }
    if (!ASSIGNABLE_ADMIN_ROLES.has(role as string)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${[...ASSIGNABLE_ADMIN_ROLES].join(", ")}`);
    }
    return this.usersService.createAdmin({ ...dto, role });
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  @RequirePermissions("users.view")
  get(@Param("id") id: string) {
    return this.usersService.getById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id/status")
  @RequirePermissions("users.edit")
  status(@Param("id") id: string, @Body() dto: { status: "active" | "suspended" | "banned" }) {
    return this.usersService.setStatus(id, dto.status);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id/reset-password")
  @RequirePermissions("users.edit")
  resetPw(@Param("id") id: string, @Body() dto: { password: string }) {
    return this.usersService.resetPassword(id, dto.password);
  }
}