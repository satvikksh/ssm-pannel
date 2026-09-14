import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { WalletService } from "@smm/domain";
import { WalletTransactionType } from "@smm/types";

@Injectable()
export class ReferralsService {
  constructor(
    @InjectModel("Referral") private readonly referralModel: Model<any>,
    @InjectModel("ReferralCommission") private readonly commissionModel: Model<any>,
    private readonly walletService: WalletService,
  ) {}

  /** Called when an order with a referred user is paid. */
  async awardCommission(referredUserId: string, orderAmount: number) {
    const referral = await this.referralModel.findOne({ referredUserId });
    if (!referral) return;

    const settings: any = await this.settings();
    const percent = Number(settings.referralPercent ?? 0);
    if (percent <= 0) return;

    const commission = (orderAmount * percent) / 100;
    if (commission <= 0) return;

    await this.walletService.credit(referral.referrerId.toString(), commission, {
      type: WalletTransactionType.REFERRAL,
      referenceType: "referral",
      description: `Referral commission (${percent}%)`,
    });

    return this.commissionModel.create({
      referrerId: referral.referrerId,
      referredUserId,
      amount: commission,
      percent,
      status: "available",
    });
  }

  async myReferrals(userId: string, page = 1, pageSize = 20) {
    const [items, total] = await Promise.all([
      this.referralModel
        .find({ referrerId: new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .populate("referredUserId", "username email createdAt")
        .lean(),
      this.referralModel.countDocuments({ referrerId: new Types.ObjectId(userId) }),
    ]);
    return { items, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async myCommissions(userId: string) {
    const [pendingCount, aggregate] = await Promise.all([
      this.commissionModel.countDocuments({
        referrerId: new Types.ObjectId(userId),
        status: { $in: ["pending", "available"] },
      }),
      this.commissionModel.aggregate([
        { $match: { referrerId: new Types.ObjectId(userId) } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);
    return { pendingCount, totalCommissions: aggregate[0]?.total ?? 0 };
  }

  async allReferrals(page = 1, pageSize = 20) {
    const [items, total] = await Promise.all([
      this.referralModel
        .find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .populate("referredUserId", "username email createdAt")
        .populate("referrerId", "username email")
        .lean(),
      this.referralModel.countDocuments(),
    ]);
    return { items, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async allCommissions() {
    const aggregate = await this.commissionModel.aggregate([
      { $group: { _id: "$status", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);
    return aggregate;
  }

  private async settings(): Promise<Record<string, unknown>> {
    const doc = await this.referralModel.db.collection("settings").findOne({ key: "referrals" });
    return doc?.value ?? {};
  }
}