import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { WalletService } from "@smm/domain";
import { WalletTransactionType } from "@smm/types";

@Injectable()
export class AdminService {
  constructor(
    @InjectModel("Order") private readonly orderModel: Model<any>,
    @InjectModel("User") private readonly userModel: Model<any>,
    @InjectModel("Refill") private readonly refillModel: Model<any>,
    private readonly walletService: WalletService,
  ) {}

  async dashboard() {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [totalUsers, activeUsers, totalOrders, todayOrders, todayRevenue, pendingRefills, totalServices] =
      await Promise.all([
        this.userModel.countDocuments(),
        this.userModel.countDocuments({ status: "active" }),
        this.orderModel.countDocuments(),
        this.orderModel.countDocuments({ createdAt: { $gte: todayStart } }),
        this.orderModel.aggregate([
          { $match: { createdAt: { $gte: todayStart } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        this.refillModel.countDocuments({ status: { $in: ["pending", "processing"] } }),
        this.orderModel.db.model("Service").countDocuments({ status: "active" }),
      ]);

    const revenue = todayRevenue[0]?.total ?? 0;
    const pendingBalance = await this.walletService.getSystemPendingBalance();

    return {
      metrics: {
        totalUsers,
        activeUsers,
        totalOrders,
        todayOrders,
        todayRevenue: revenue,
        pendingRefills,
        totalServices,
        pendingBalance,
      },
      generatedAt: new Date(),
    };
  }

  async adjustBalance(userId: string, dto: { amount: number; type: WalletTransactionType; reason: string; adminId: string }) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException("User not found");
    if (!dto.amount || isNaN(dto.amount)) throw new ForbiddenException("Invalid amount");

    if (dto.type === WalletTransactionType.MANUAL_CREDIT) {
      await this.walletService.credit(userId, dto.amount, {
        type: dto.type,
        referenceType: "admin_adjustment",
        description: `Admin credit: ${dto.reason}`,
        metadata: { adminId: dto.adminId },
      });
    } else if (dto.type === WalletTransactionType.MANUAL_DEBIT) {
      await this.walletService.debit(userId, dto.amount, {
        type: dto.type,
        referenceType: "admin_adjustment",
        description: `Admin debit: ${dto.reason}`,
        metadata: { adminId: dto.adminId },
      });
    } else {
      throw new ForbiddenException("Unsupported adjustment transaction type");
    }

    const balance = await this.walletService.getBalance(userId);
    return { userId, balance: balance.balance, adjustedAmount: dto.amount };
  }

  async revenueByDay(days = 30) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    return this.orderModel.aggregate([
      { $match: { createdAt: { $gte: start }, status: { $nin: ["canceled", "failed"] } } },
      { $project: { day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, amount: 1, serviceCost: "$providerCost" } },
      { $group: { _id: "$day", revenue: { $sum: "$amount" }, cost: { $sum: { $ifNull: ["$serviceCost", 0] } } } },
      { $sort: { _id: 1 } },
    ]);
  }

  async ordersByStatus() {
    return this.orderModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  }
}