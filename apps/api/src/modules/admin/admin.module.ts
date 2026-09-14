import { Module, Global } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { orderSchema, userSchema, refillSchema, walletSchema } from "@smm/database";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { SuperAdminBootstrapService } from "./super-admin-bootstrap.service";
import { AdminManagementController } from "./admin-management.controller";
import { AdminManagementService } from "./admin-management.service";

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Order", schema: orderSchema },
      { name: "User", schema: userSchema },
      { name: "Refill", schema: refillSchema },
      { name: "Wallet", schema: walletSchema },
    ]),
  ],
  controllers: [AdminController, AdminManagementController],
  providers: [AdminService, AdminManagementService, SuperAdminBootstrapService],
  exports: [AdminService],
})
export class AdminModule {}