import { Body, Controller, Get, Param, Post, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ServicesService } from "@smm/domain";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, Public, RequirePermissions } from "../../common/decorators";

@ApiTags("services")
@Controller("services")
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Public()
  @Get("categories")
  categories() {
    return this.servicesService.listCategories();
  }

  @Public()
  @Get()
  list(@Query() filters: { categoryId?: string; search?: string }) {
    return this.servicesService.listServices(filters ?? {});
  }

  @Get(":id/price")
  async price(
    @Param("id") id: string,
    @Query("quantity") quantity: string,
    @CurrentUser() user: { id: string; userGroupId?: string },
  ) {
    const qty = Number(quantity) || 1;
    const pricing = await this.servicesService.computePrice({ serviceId: id, quantity: qty, user });
    return { success: true, data: pricing };
  }

  @Post()
  @RequirePermissions("services.manage")
  create(@Body() dto: any) {
    return this.servicesService.createService(dto);
  }

  @Patch(":id")
  @RequirePermissions("services.manage")
  update(@Param("id") id: string, @Body() dto: any) {
    return this.servicesService.updateService(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("admin/all")
  @RequirePermissions("services.manage")
  adminList() {
    return this.servicesService.listAdminServices();
  }

  @Post("prices")
  @RequirePermissions("services.manage")
  setPrice(@Body() dto: any) {
    return this.servicesService.setServicePrice(dto);
  }
}