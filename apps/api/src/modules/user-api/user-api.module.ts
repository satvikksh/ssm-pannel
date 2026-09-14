import { Module, Global } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { apiKeySchema, apiLogSchema } from "@smm/database";
import { OrdersModule } from "../orders/orders.module";
import { UserApiService } from "./user-api.service";
import { UserApiController } from "./user-api.controller";
import { ApiKeyAuthGuard } from "./guards/api-key-auth.guard";

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "ApiKey", schema: apiKeySchema },
      { name: "ApiLog", schema: apiLogSchema },
    ]),
    OrdersModule,
  ],
  controllers: [UserApiController],
  providers: [UserApiService, ApiKeyAuthGuard],
  exports: [UserApiService, ApiKeyAuthGuard],
})
export class UserApiModule {}