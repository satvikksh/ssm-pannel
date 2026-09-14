import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Decimal } from "decimal.js";
import { WalletTransactionType } from "@smm/types";

export interface LedgerEntry {
  userId?: string;
  type: WalletTransactionType;
  amount: number;
  referenceType: string;
  referenceId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  currency?: string;
}

@Injectable()
export class WalletService {
  constructor(
    @InjectModel("Wallet") private readonly walletModel: Model<any>,
    @InjectModel("WalletTransaction") private readonly walletTxModel: Model<any>,
  ) {}

  async ensureWallet(userId: string, currency = "INR") {
    const existing = await this.walletModel.findOne({ userId });
    if (existing) return existing;
    return this.walletModel.create({ userId, balance: 0, pendingBalance: 0, currency });
  }

  /**
   * Debit the user's balance. Uses an atomic findOneAndUpdate with a balance
   * guard so concurrent order placements can never overdraft the wallet.
   */
  async debit(userId: string, amount: number, entry: Omit<LedgerEntry, "type" | "amount"> & { type?: WalletTransactionType }): Promise<any> {
    if (amount <= 0) throw new BadRequestException("Amount must be positive");
    const wallet = await this.walletModel.findOne({ userId }).session(null);
    if (!wallet) throw new NotFoundException("Wallet not found");

    // Convert to Decimal-based precise math
    const amountDec = new Decimal(amount);
    const balanceDec = new Decimal(wallet.balance);

    if (balanceDec.lessThan(amountDec)) {
      throw new BadRequestException("INSUFFICIENT_BALANCE");
    }

    const newBalance = balanceDec.minus(amountDec);
    const updated = await this.walletModel.findOneAndUpdate(
      { userId, balance: wallet.balance }, // optimistic concurrency
      { $set: { balance: newBalance.toNumber() } },
      { new: true },
    );

    if (!updated) {
      // retry once
      return this.debit(userId, amount, entry);
    }

    // store ledger entry — every financial change requires a ledger record
    await this.record({
      userId,
      type: entry.type ?? WalletTransactionType.ORDER_DEBIT,
      amount: -amount,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      description: entry.description,
      metadata: { ...entry.metadata, balanceBefore: wallet.balance, balanceAfter: newBalance.toNumber() },
      currency: wallet.currency,
    });

    return updated;
  }

  /**
   * Credit the user's balance with a ledger entry. Used for deposits, refunds,
   * bonuses, referral commissions — all positive adjustments.
   */
  async credit(userId: string, amount: number, entry: Omit<LedgerEntry, "type" | "amount"> & { type?: WalletTransactionType }): Promise<any> {
    if (amount <= 0) throw new BadRequestException("Amount must be positive");
    const wallet = await this.walletModel.findOne({ userId }).session(null);
    if (!wallet) throw new NotFoundException("Wallet not found");

    const balanceDec = new Decimal(wallet.balance).plus(amount);
    const updated = await this.walletModel.findOneAndUpdate(
      { userId, balance: wallet.balance },
      { $set: { balance: balanceDec.toNumber() } },
      { new: true },
    );

    if (!updated) return this.credit(userId, amount, entry);

    await this.record({
      userId,
      type: entry.type ?? WalletTransactionType.MANUAL_CREDIT,
      amount,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      description: entry.description,
      metadata: { balanceBefore: wallet.balance, balanceAfter: balanceDec.toNumber(), ...entry.metadata },
      currency: wallet.currency,
    });

    return updated;
  }

  /** Refund credits an order amount back to the wallet. */
  async refund(order: { userId: string; amount: number; referenceId?: string }, description = "Order refund") {
    return this.credit(order.userId, order.amount, {
      type: WalletTransactionType.REFUND,
      referenceType: "order",
      referenceId: order.referenceId as any,
      description,
    });
  }

  async getBalance(userId: string) {
    const wallet = (await this.walletModel.findOne({ userId }).lean()) as any;
    if (!wallet) throw new NotFoundException("Wallet not found");
    return { balance: wallet.balance, pendingBalance: wallet.pendingBalance, currency: wallet.currency };
  }

  async getBalances(userIds: string[]): Promise<Map<string, number>> {
    const wallets = (await this.walletModel.find({ userId: { $in: userIds } }).lean()) as any[];
    const map = new Map<string, number>();
    for (const w of wallets) map.set(String(w.userId), w.balance);
    return map;
  }

  /** Pending (in-flight) balance across all wallets — used by admin dashboard. */
  async getSystemPendingBalance(): Promise<number> {
    const agg = await this.walletModel.aggregate([
      { $group: { _id: null, total: { $sum: "$pendingBalance" } } },
    ]);
    return agg[0]?.total ?? 0;
  }

  async getTransactions(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.walletTxModel.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
      this.walletTxModel.countDocuments({ userId }),
    ]);
    return {
      items,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  private async record(entry: LedgerEntry & { type: string }) {
    return this.walletTxModel.create({
      userId: entry.userId,
      type: entry.type,
      amount: entry.amount,
      currency: entry.currency ?? "INR",
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      description: entry.description,
      balanceBefore: entry.metadata?.balanceBefore ?? 0,
      balanceAfter: entry.metadata?.balanceAfter ?? 0,
      metadata: entry.metadata,
    });
  }
}