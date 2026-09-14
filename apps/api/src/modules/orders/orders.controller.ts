import { Controller, Get, Param, Post, Body, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { OrdersService } from "@smm/domain";
import { RequirePermissions } from "../../common/decorators";
import { CreateOrderDto } from "./dto/order.dto";
import { CurrentUser } from "../../common/decorators";

@ApiTags("orders")
@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: { id: string; userGroupId?: string },
  ) {
    const result = await this.ordersService.create({
      serviceId: dto.serviceId,
      link: dto.link,
      quantity: dto.quantity,
      couponCode: dto.couponCode,
      idempotencyKey: dto.idempotencyKey,
      userId: user.id,
      userGroupId: user.userGroupId,
    });
    return { success: true, data: result };
  }

  @Get("my")
  async my(
    @CurrentUser() user: { id: string },
    @Query("page") page = 1,
    @Query("pageSize") pageSize = 20,
    @Query("status") status?: string,
  ) {
    const data = await this.ordersService.getUserOrders(user.id, Number(page), Number(pageSize), status);
    return { success: true, data };
  }

  @Get("my/:id")
  async one(@CurrentUser() user: { id: string }, @Param("id") id: string) {
    const data = await this.ordersService.getOrder(user.id, id, false);
    return { success: true, data };
  }

  @Get("estimate")
  async estimate(@Query("serviceId") serviceId: string, @Query("quantity") quantity: string) {
    const data = await this.ordersService.estimatePrice(serviceId, Number(quantity) || 1);
    return { success: true, data };
  }

  @Post("my/:id/cancel")
  async cancel(@CurrentUser() user: { id: string }, @Param("id") id: string) {
    const data = await this.ordersService.cancelOrder(user.id, id);
    return { success: true, data };
  }

  @Get("admin/all")
  @RequirePermissions("orders.manage")
  async adminAll(
    @Query("page") page = 1,
    @Query("pageSize") pageSize = 20,
    @Query("status") status?: string,
    @Query("userId") userId?: string,
  ) {
    const data = await this.ordersService.getAllOrders(Number(page), Number(pageSize), { status, userId });
    return { success: true, data };
  }
}