import { Module, Global } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { refillSchema } from "@smm/database";
import { RefillsService } from "@smm/domain";
import { RefillsController } from "./refills.controller";

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: "Refill", schema: refillSchema }])],
  controllers: [RefillsController],
  providers: [RefillsService],
  exports: [RefillsService],
})
export class RefillsModule {}