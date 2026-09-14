import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { orderSchema, orderStatusHistorySchema } from "@smm/database";
import { OrdersService } from "@smm/domain";
import { OrdersController } from "./orders.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Order", schema: orderSchema },
      { name: "OrderStatusHistory", schema: orderStatusHistorySchema },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}