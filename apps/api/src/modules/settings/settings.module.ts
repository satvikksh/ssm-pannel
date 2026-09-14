import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { settingsSchema } from "@smm/database";
import { SettingsService } from "./settings.service";
import { SettingsController } from "./settings.controller";
import { RequestIdMiddleware } from "../../common/middleware/request-id.middleware";

@Module({
  imports: [MongooseModule.forFeature([{ name: "Settings", schema: settingsSchema }])],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}