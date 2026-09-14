import {
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
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RequirePermissions } from "../../common/decorators";
import { AdminManagementService } from "./admin-management.service";
import {
  CreateAdminDto,
  UpdateAdminDto,
  ResetAdminPasswordDto,
} from "./dto/admin-management.dto";
import { AdminPermission } from "@smm/types";

@ApiTags("admin-management")
@Controller("admin/admins")
@UseGuards(JwtAuthGuard)
export class AdminManagementController {
  constructor(private readonly adminManagement: AdminManagementService) {}

  @Get()
  @RequirePermissions(AdminPermission.ADMIN_MANAGE)
  list(
    @Query("page") page = 1,
    @Query("pageSize") pageSize = 50,
    @Query("search") search?: string,
    @Query("status") status?: string,
  ) {
    return this.adminManagement.list(Number(page), Number(pageSize), search, status);
  }

  @Post()
  @RequirePermissions(AdminPermission.ADMIN_MANAGE)
  create(@Body() dto: CreateAdminDto) {
    return this.adminManagement.create(dto);
  }

  @Get(":id")
  @RequirePermissions(AdminPermission.ADMIN_MANAGE)
  get(@Param("id") id: string) {
    return this.adminManagement.getById(id);
  }

  @Patch(":id")
  @RequirePermissions(AdminPermission.ADMIN_MANAGE)
  update(@Param("id") id: string, @Body() dto: UpdateAdminDto) {
    return this.adminManagement.update(id, dto);
  }

  @Post(":id/reset-password")
  @RequirePermissions(AdminPermission.ADMIN_MANAGE)
  resetPassword(@Param("id") id: string, @Body() dto: ResetAdminPasswordDto) {
    return this.adminManagement.resetPassword(id, dto.password);
  }

  @Post(":id/revoke-sessions")
  @RequirePermissions(AdminPermission.ADMIN_MANAGE)
  revokeSessions(@Param("id") id: string) {
    return this.adminManagement.revokeSessions(id);
  }
}