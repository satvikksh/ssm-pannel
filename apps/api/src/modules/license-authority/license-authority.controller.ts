import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminPermission } from "@smm/types";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RequirePermissions, Public, CurrentUser } from "../../common/decorators";
import { LicenseAuthorityService } from "./license-authority.service";

@ApiTags("license-authority")
@Controller("admin/licenses")
@UseGuards(JwtAuthGuard)
export class LicenseAuthorityController {
  constructor(private readonly licenseAuthority: LicenseAuthorityService) {}

  @Get()
  @RequirePermissions(AdminPermission.LICENSE_MANAGE)
  list() {
    return this.licenseAuthority.list();
  }

  @Get("admin/:adminId")
  @RequirePermissions(AdminPermission.LICENSE_MANAGE)
  byAdmin(@Param("adminId") adminId: string) {
    return this.licenseAuthority.getLicenseByAdminEmail(adminId.includes("@") ? adminId : "");
  }

  @Post()
  @RequirePermissions(AdminPermission.LICENSE_MANAGE)
  create(@Body() dto: any, @CurrentUser("id") operatorUserId: string) {
    return this.licenseAuthority.createLicense(dto, operatorUserId ?? "system");
  }

  @Get(":id")
  @RequirePermissions(AdminPermission.LICENSE_MANAGE)
  detail(@Param("id") id: string) {
    return this.licenseAuthority.getDetail(id);
  }

  @Post(":id/approve")
  @RequirePermissions(AdminPermission.LICENSE_MANAGE)
  approve(@Param("id") id: string, @CurrentUser("id") operatorUserId: string) {
    return this.licenseAuthority.approve(id, operatorUserId ?? "system");
  }

  @Post(":id/suspend")
  @RequirePermissions(AdminPermission.LICENSE_MANAGE)
  suspend(@Param("id") id: string, @CurrentUser("id") operatorUserId: string, @Body("reason") reason?: string) {
    return this.licenseAuthority.suspend(id, operatorUserId ?? "system", reason);
  }

  @Post(":id/revoke")
  @RequirePermissions(AdminPermission.LICENSE_MANAGE)
  revoke(@Param("id") id: string, @CurrentUser("id") operatorUserId: string, @Body("reason") reason?: string) {
    return this.licenseAuthority.revoke(id, operatorUserId ?? "system", reason);
  }

  @Post(":id/renew")
  @RequirePermissions(AdminPermission.LICENSE_MANAGE)
  renew(@Param("id") id: string, @CurrentUser("id") operatorUserId: string, @Body("durationDays") durationDays: number) {
    return this.licenseAuthority.renew(id, Number(durationDays), operatorUserId ?? "system");
  }
}

@ApiTags("license-authority-client")
@Controller("licenses")
export class LicenseAuthorityClientController {
  constructor(private readonly licenseAuthority: LicenseAuthorityService) {}

  /** Client-side activation (called by an installation, HMAC-signed). */
  @Public()
  @Post("activate")
  activate(
    @Body() dto: { licenseKey: string; installationId: string; domain: string; adminUserId?: string },
  ) {
    return this.licenseAuthority.activate(dto);
  }

  /** Client-side validation (periodic heartbeat). */
  @Public()
  @Post("validate")
  validate(@Body() dto: { installationId: string; domain?: string }) {
    return this.licenseAuthority.validate(dto);
  }
}