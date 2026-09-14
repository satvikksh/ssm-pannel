import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Decimal } from "decimal.js";
import { slugify } from "@smm/utils";

@Injectable()
export class ServicesService {
  constructor(
    @InjectModel("Category") private readonly categoryModel: Model<any>,
    @InjectModel("Service") private readonly serviceModel: Model<any>,
    @InjectModel("ServicePrice") private readonly priceModel: Model<any>,
  ) {}

  // ---- Categories ----
  async listCategories() {
    return this.categoryModel.find({ status: "active" }).sort({ sortOrder: 1 }).lean();
  }

  async createCategory(dto: { name: string; slug?: string; platform?: string }) {
    const slug = dto.slug ?? slugify(dto.name);
    const existing = await this.categoryModel.findOne({ $or: [{ name: dto.name }, { slug }] });
    if (existing) throw new ConflictException("Category already exists");
    return this.categoryModel.create({ name: dto.name, slug, platform: dto.platform, status: "active", sortOrder: 0 });
  }

  // ---- Services ----
  async listServices(filters: { categoryId?: string; search?: string; min?: number; max?: number }) {
    const query: Record<string, unknown> = { status: "active" };
    if (filters.categoryId) query.categoryId = filters.categoryId;
    if (filters.search) query.$or = [{ name: { $regex: filters.search, $options: "i" } }, { description: { $regex: filters.search, $options: "i" } }];
    return this.serviceModel.find(query).sort({ sortOrder: 1, customerPrice: 1 }).select("-__v").lean();
  }

  async getServiceById(id: string): Promise<any> {
    const service = (await this.serviceModel.findById(id).lean()) as any;
    if (!service || service.status === "disabled") throw new NotFoundException("Service not found");
    return service;
  }

  /**
   * Server-side pricing engine. The frontend NEVER sends a price; the backend
   * computes the final charge from provider cost + markup - discount.
   *
   *   finalCharge = (providerCost + fixedMarkup) * (1 + markupPercent/100)
   */
  async computePrice(params: {
    serviceId: string;
    user?: { id: string; userGroupId?: string };
    quantity: number;
    coupon?: any;
  }): Promise<{
    providerCost: number;
    baseRate: number;
    markup: number;
    discount: number;
    finalCharge: number;
    currency: string;
    unitPrice: number;
  }> {
    const service = await this.getServiceById(params.serviceId);
    const user = params.user;

    // 1. base per-unit rate (custom user price > group price > default)
    let baseRate = new Decimal(service.customerPrice ?? 0);
    if (user) {
      const customPrice = (await this.priceModel.findOne({ serviceId: service._id, userId: user.id }).lean()) as any;
      if (customPrice) {
        baseRate = new Decimal(customPrice.price);
      } else if (user.userGroupId) {
        const groupPrice = (await this.priceModel.findOne({ serviceId: service._id, userGroupId: user.userGroupId }).lean()) as any;
        if (groupPrice) baseRate = new Decimal(groupPrice.price);
      }
    }

    const quantity = new Decimal(params.quantity);
    let finalCharge = baseRate.mul(quantity);

    // 2. discount (coupon)
    let discount = new Decimal(0);
    if (params.coupon) {
      if (params.coupon.type === "fixed") {
        discount = Decimal.min(new Decimal(params.coupon.value), finalCharge);
      } else if (params.coupon.type === "percentage") {
        discount = finalCharge.mul(new Decimal(params.coupon.value).div(100));
        if (params.coupon.maximumDiscount) {
          discount = Decimal.min(discount, new Decimal(params.coupon.maximumDiscount));
        }
      }
      discount = Decimal.max(discount, 0);
    }
    finalCharge = finalCharge.minus(discount);

    return {
      providerCost: service.providerCost,
      baseRate: baseRate.toNumber(),
      markup: finalCharge
        .minus(new Decimal(service.providerCost).mul(quantity))
        .plus(discount)
        .toNumber(),
      discount: discount.toNumber(),
      finalCharge: finalCharge.toNumber(),
      currency: "INR",
      unitPrice: baseRate.toNumber(),
    };
  }

  async createService(dto: any) {
    const slug = slugify(`${dto.name}-${Date.now().toString(36)}`);
    const existing = await this.serviceModel.findOne({ providerId: dto.providerId, providerServiceId: dto.providerServiceId });
    if (existing) throw new ConflictException("Service already mapped for this provider");
    return this.serviceModel.create({ ...dto, slug, minimum: dto.minimum ?? 1, maximum: dto.maximum ?? 1_000_000 });
  }

  async updateService(id: string, dto: any) {
    const service = await this.serviceModel.findById(id);
    if (!service) throw new NotFoundException("Service not found");
    Object.assign(service, dto);
    await service.save();
    return service;
  }

  async listAdminServices() {
    return this.serviceModel.find().sort({ sortOrder: 1 }).lean();
  }

  async setServicePrice(dto: { serviceId: string; price: number; userId?: string; userGroupId?: string }) {
    return this.priceModel.findOneAndUpdate(
      { serviceId: dto.serviceId, userId: dto.userId, userGroupId: dto.userGroupId },
      { $set: { price: dto.price } },
      { new: true, upsert: true },
    );
  }
}