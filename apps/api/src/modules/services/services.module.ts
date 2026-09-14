import { Module, Global } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { categorySchema, serviceSchema, servicePriceSchema } from "@smm/database";
import { ServicesService } from "@smm/domain";
import { ServicesController } from "./services.controller";

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Category", schema: categorySchema },
      { name: "Service", schema: serviceSchema },
      { name: "ServicePrice", schema: servicePriceSchema },
    ]),
  ],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}