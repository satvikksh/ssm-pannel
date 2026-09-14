import { Body, Controller, Get, Post, Request } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { LicenseService } from "@smm/domain";
import { Public, RequirePermissions, LicenseExempt } from "../../common/decorators";
import { AdminPermission } from "@smm/types";
import { LicenseAuthorityService } from "../license-authority/license-authority.service";

@ApiTags("license")
@Controller("license")
export class LicenseController {
  constructor(
    private readonly licenseService: LicenseService,
    private readonly licenseAuthority: LicenseAuthorityService,
  ) {}

  @Public()
  @Get("status")
  status() {
    return this.licenseService.getState();
  }

  @LicenseExempt()
  @RequirePermissions(AdminPermission.LICENSE_MANAGE)
  @Post("activate")
  async activate(
    @Body() dto: { licenseKey: string; domain: string },
    @Request() req: { user: { id: string; email: string } },
  ) {
    const installationId = process.env.INSTALLATION_ID ?? req.user.email;
    const result = await this.licenseAuthority.activateForAdmin({
      licenseKey: dto.licenseKey,
      adminUserId: req.user.id,
      installationId,
      domain: dto.domain,
    });
    await this.licenseService.mirrorActivation({
      licenseKey: dto.licenseKey,
      domain: dto.domain,
      licenseId: result.licenseId,
    });
    return { success: true, data: result };
  }

  @Public()
  @Post("validate")
  validate() {
    return this.licenseService.validate();
  }
}