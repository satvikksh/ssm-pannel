import mongoose from "mongoose";
import type { WalletTransactionType, WalletTransactionStatus } from "@smm/types";
import { CURRENCY } from "@smm/types";

export interface Wallet {
  userId: mongoose.Types.ObjectId;
  balance: number; // main spendable balance
  pendingBalance: number; // pending (deposits under review)
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export const walletSchema = new mongoose.Schema<Wallet>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    balance: { type: Number, default: 0 },
    pendingBalance: { type: Number, default: 0 },
    currency: { type: String, default: CURRENCY },
  },
  { timestamps: true, collection: "wallets" },
);

export interface WalletTransaction {
  userId: mongoose.Types.ObjectId;
  type: WalletTransactionType;
  status: WalletTransactionStatus;
  amount: number; // signed: positive credit, negative debit
  balanceBefore: number;
  balanceAfter: number;
  currency: string;
  referenceType: string; // order | payment | referral | payout
  referenceId?: mongoose.Types.ObjectId;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export const walletTransactionSchema = new mongoose.Schema<WalletTransaction>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: [
        "deposit",
        "order_debit",
        "refund",
        "manual_credit",
        "manual_debit",
        "referral",
        "bonus",
        "chargeback",
        "adjustment",
        "payment_refund",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed", "canceled"],
      default: "success",
    },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    currency: { type: String, default: CURRENCY },
    referenceType: { type: String, required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    description: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "wallet_transactions" },
);

walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ userId: 1, type: 1 });
walletTransactionSchema.index({ referenceType: 1, referenceId: 1 });