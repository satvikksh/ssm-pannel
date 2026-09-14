import { Module, Global } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { couponSchema, couponRedemptionSchema } from "@smm/database";
import { CouponsService } from "@smm/domain";
import { CouponsController } from "./coupons.controller";

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Coupon", schema: couponSchema },
      { name: "CouponRedemption", schema: couponRedemptionSchema },
    ]),
  ],
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}