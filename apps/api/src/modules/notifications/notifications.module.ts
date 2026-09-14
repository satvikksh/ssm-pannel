import { Module, Global } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { notificationSchema } from "@smm/database";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: "Notification", schema: notificationSchema }])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}