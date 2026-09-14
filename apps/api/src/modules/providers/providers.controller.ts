import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ProvidersService, CreateProviderDto } from "@smm/domain";
import { RequirePermissions, Public } from "../../common/decorators";

@ApiTags("providers")
@Controller("providers")
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post()
  @RequirePermissions("providers.manage")
  create(@Body() dto: CreateProviderDto) {
    return this.providersService.create(dto);
  }

  @Public()
  @Get()
  list() {
    return this.providersService.findAll();
  }

  @Post(":id/sync")
  @RequirePermissions("providers.manage")
  sync(@Param("id") id: string) {
    return this.providersService.syncServices(id);
  }

  @Post(":id/balance")
  @RequirePermissions("providers.manage")
  balance(@Param("id") id: string) {
    return this.providersService.getBalance(id);
  }

  @Post(":id/test")
  @RequirePermissions("providers.manage")
  test(@Param("id") id: string) {
    return this.providersService.testConnection(id);
  }

  @Get(":id/services")
  @RequirePermissions("providers.manage")
  services(@Param("id") id: string, @Query("search") search?: string) {
    return this.providersService.getProviderServices(id, search);
  }
}