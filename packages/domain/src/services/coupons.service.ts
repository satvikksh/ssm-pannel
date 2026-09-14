import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Decimal } from "decimal.js";

@Injectable()
export class CouponsService {
  constructor(
    @InjectModel("Coupon") private readonly couponModel: Model<any>,
    @InjectModel("CouponRedemption") private readonly redemptionModel: Model<any>,
  ) {}

  async create(dto: { code: string; type: "fixed" | "percentage"; value: number; minimumAmount?: number; maximumDiscount?: number; perUserLimit?: number; usageLimit?: number; expiresAt?: Date }) {
    const code = dto.code.toUpperCase();
    const existing = await this.couponModel.findOne({ code });
    if (existing) throw new BadRequestException("Coupon code already exists");
    return this.couponModel.create({
      ...dto,
      code,
      status: "active",
      perUserLimit: dto.perUserLimit ?? 1,
      usageLimit: dto.usageLimit ?? 1,
      usedCount: 0,
    });
  }

  async validateForUser(
    code: string,
    userId: string,
    _serviceId?: string,
    orderAmount?: number,
  ) {
    const coupon = await this.couponModel.findOne({ code: code.toUpperCase() });
    if (!coupon) throw new NotFoundException("Coupon not found or invalid");
    if (coupon.status !== "active") throw new BadRequestException("Coupon not active");
    if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new BadRequestException("Coupon expired");
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new BadRequestException("Coupon usage limit reached");

    const userRedemptions = await this.redemptionModel.countDocuments({
      couponId: coupon._id,
      userId,
    });
    if (userRedemptions >= coupon.perUserLimit) throw new BadRequestException("Coupon already used by this user");

    if (orderAmount !== undefined && coupon.minimumAmount && orderAmount < coupon.minimumAmount) {
      throw new BadRequestException(`Minimum order amount of ${coupon.minimumAmount} required`);
    }

    return coupon;
  }

  async recordRedemption(coupon: any, userId: string, orderId: any, discount: number) {
    await this.redemptionModel.create({ couponId: coupon._id, userId, orderId, discount });
    await this.couponModel.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });
  }

  /** Compute discount (server-side only). */
  computeDiscount(coupon: any, orderAmount: number): number {
    let discount = new Decimal(0);
    if (coupon.type === "fixed") {
      discount = Decimal.min(new Decimal(coupon.value), orderAmount);
    } else {
      discount = new Decimal(orderAmount).mul(new Decimal(coupon.value).div(100));
      if (coupon.maximumDiscount) {
        discount = Decimal.min(discount, new Decimal(coupon.maximumDiscount));
      }
    }
    return discount.gt(0) ? discount.toNumber() : 0;
  }

  async list(page = 1, pageSize = 20) {
    const [items, total] = await Promise.all([
      this.couponModel.find().sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      this.couponModel.countDocuments(),
    ]);
    return { items, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async toggleStatus(id: string, status: "active" | "inactive") {
    const coupon = await this.couponModel.findById(id);
    if (!coupon) throw new NotFoundException("Coupon not found");
    coupon.status = status;
    await coupon.save();
    return coupon;
  }
}