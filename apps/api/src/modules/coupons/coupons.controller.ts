import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CouponsService } from "@smm/domain";
import { RequirePermissions } from "../../common/decorators";

@ApiTags("coupons")
@Controller("coupons")
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @RequirePermissions("coupons.manage")
  create(@Body() dto: any) {
    return this.couponsService.create(dto);
  }

  @Get()
  @RequirePermissions("coupons.manage")
  list(@Query("page") page = 1, @Query("pageSize") pageSize = 20) {
    return this.couponsService.list(Number(page), Number(pageSize));
  }

  @Patch(":id/status")
  @RequirePermissions("coupons.manage")
  status(@Param("id") id: string, @Body() dto: { status: "active" | "inactive" }) {
    return this.couponsService.toggleStatus(id, dto.status);
  }
}