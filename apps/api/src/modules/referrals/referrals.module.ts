import { Module, Global } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { referralSchema, referralCommissionSchema } from "@smm/database";
import { ReferralsService } from "./referrals.service";
import { ReferralsController } from "./referrals.controller";

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Referral", schema: referralSchema },
      { name: "ReferralCommission", schema: referralCommissionSchema },
    ]),
  ],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}