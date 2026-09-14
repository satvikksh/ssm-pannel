import { Module, Global } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { paymentSchema, paymentWebhookSchema, paymentMethodSchema } from "@smm/database";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Payment", schema: paymentSchema },
      { name: "PaymentWebhook", schema: paymentWebhookSchema },
      { name: "PaymentMethod", schema: paymentMethodSchema },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}