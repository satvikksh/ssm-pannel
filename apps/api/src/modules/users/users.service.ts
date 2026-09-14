import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { hashPassword } from "@smm/security";
import { WalletService } from "@smm/domain";

@Injectable()
export class UsersService {
  constructor(
    @InjectModel("User") private readonly userModel: Model<any>,
    private readonly walletService: WalletService,
  ) {}

  async list(page = 1, pageSize = 20, search?: string, status?: string) {
    const query: Record<string, unknown> = {};
    if (search) query.$or = [{ email: { $regex: search, $options: "i" } }, { username: { $regex: search, $options: "i" } }];
    if (status) query.status = status;
    const [itemsRaw, total] = await Promise.all([
      this.userModel.find(query).select("-passwordHash").sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      this.userModel.countDocuments(query),
    ]);
    const items: any[] = itemsRaw as any;
    // attach wallet balances
    const balances = await this.walletService.getBalances(items.map((u) => u._id.toString()));
    return {
      items: items.map((u) => ({ ...u, _id: u._id.toString(), walletBalance: balances.get(u._id.toString()) ?? 0 })),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async createAdmin(dto: {
    email: string;
    password: string;
    name: string;
    role?: string;
    permissions?: string[];
    status?: string;
  }) {
    const passwordHash = await hashPassword(dto.password);
    const email = dto.email.toLowerCase();
    const existing = await this.userModel.findOne({ email });
    if (existing) throw new BadRequestException("User already exists");
    return this.userModel.create({
      email,
      username: email.split("@")[0],
      passwordHash,
      name: dto.name,
      status: dto.status ?? "active",
      role: dto.role ?? "admin",
      permissions: dto.permissions ?? [],
      tokenVersion: 0,
      referralCode: `ADM${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      flags: { emailVerified: true, twoFactorEnabled: false, apiAccess: false },
      failedLoginAttempts: 0,
    });
  }

  async setStatus(userId: string, status: "active" | "suspended" | "banned") {
    const user = await this.userModel.findByIdAndUpdate(userId, { $set: { status } }, { new: true }).select("-passwordHash");
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async resetPassword(userId: string, newPassword: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException("User not found");
    user.passwordHash = await hashPassword(newPassword);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    user.passwordChangedAt = new Date();
    await user.save();
    return { ok: true };
  }

  async getById(userId: string) {
    const userRaw = await this.userModel.findById(userId).select("-passwordHash").lean();
    const user: any = userRaw as any;
    if (!user) throw new NotFoundException("User not found");
    const wallet = await this.walletService.getBalance(user._id.toString());
    return { ...user, _id: user._id.toString(), walletBalance: wallet.balance };
  }
}