import { Module, Global } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { walletSchema, walletTransactionSchema } from "@smm/database";
import { WalletService } from "@smm/domain";
import { WalletController } from "./wallet.controller";

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Wallet", schema: walletSchema },
      { name: "WalletTransaction", schema: walletTransactionSchema },
    ]),
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}