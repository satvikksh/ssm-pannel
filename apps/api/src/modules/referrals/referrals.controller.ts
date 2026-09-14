import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ReferralsService } from "./referrals.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequirePermissions } from "../../common/decorators";

@ApiTags("referrals")
@Controller("referrals")
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @UseGuards(JwtAuthGuard)
  @Get("my")
  my(@CurrentUser() user: { id: string }, @Query("page") page = 1, @Query("pageSize") pageSize = 20) {
    return this.referralsService.myReferrals(user.id, Number(page), Number(pageSize));
  }

  @UseGuards(JwtAuthGuard)
  @Get("commission")
  commission(@CurrentUser() user: { id: string }) {
    return this.referralsService.myCommissions(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get("admin/all")
  @RequirePermissions("users.view")
  adminAll(@Query("page") page = 1, @Query("pageSize") pageSize = 20) {
    return { success: true, data: this.referralsService.allReferrals(Number(page), Number(pageSize)) };
  }

  @UseGuards(JwtAuthGuard)
  @Get("admin/commissions")
  @RequirePermissions("users.view")
  adminCommissions() {
    return { success: true, data: this.referralsService.allCommissions() };
  }
}