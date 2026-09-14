import { Module, Global } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { dripFeedOrderSchema } from "@smm/database";
import { DripFeedService } from "@smm/domain";
import { DripFeedController } from "./drip-feed.controller";

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: "DripFeedOrder", schema: dripFeedOrderSchema }])],
  controllers: [DripFeedController],
  providers: [DripFeedService],
  exports: [DripFeedService],
})
export class DripFeedModule {}