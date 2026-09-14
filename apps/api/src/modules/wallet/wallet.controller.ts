import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { WalletService } from "@smm/domain";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators";

@Controller("wallet")
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async balance(@CurrentUser() user: { id: string }) {
    const balance = await this.walletService.getBalance(user.id);
    return { success: true, data: balance };
  }

  @UseGuards(JwtAuthGuard)
  @Get("transactions")
  async transactions(
    @CurrentUser() user: { id: string },
    @Query("page") page = 1,
    @Query("pageSize") pageSize = 20,
  ) {
    const data = await this.walletService.getTransactions(user.id, page, pageSize);
    return { success: true, data };
  }
}