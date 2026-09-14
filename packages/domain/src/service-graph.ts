import { Model } from "mongoose";
import { Queue } from "bullmq";
import {
  getModel,
  mongoose,
  categorySchema,
  serviceSchema,
  servicePriceSchema,
  providerSchema,
  providerServiceSchema,
  walletSchema,
  walletTransactionSchema,
  couponSchema,
  couponRedemptionSchema,
  orderSchema,
  orderStatusHistorySchema,
  refillSchema,
  dripFeedOrderSchema,
  subscriptionSchema,
  notificationSchema,
  licenseStateSchema,
} from "@smm/database";
import { QueueName, buildQueue } from "@smm/queue";
import { WalletService } from "./services/wallet.service";
import { ServicesService } from "./services/services.service";
import { ProviderFactory } from "./providers/provider.factory";
import { ProvidersService } from "./providers/providers.service";
import { CouponsService } from "./services/coupons.service";
import { OrdersService } from "./services/orders.service";
import { RefillsService } from "./services/refills.service";
import { DripFeedService } from "./services/drip-feed.service";
import { LicenseService } from "./services/license.service";

export interface JobServiceModels {
  Category: Model<any>;
  Service: Model<any>;
  ServicePrice: Model<any>;
  Provider: Model<any>;
  ProviderService: Model<any>;
  Wallet: Model<any>;
  WalletTransaction: Model<any>;
  Coupon: Model<any>;
  CouponRedemption: Model<any>;
  Order: Model<any>;
  OrderStatusHistory: Model<any>;
  Refill: Model<any>;
  DripFeedOrder: Model<any>;
  Subscription: Model<any>;
  Notification: Model<any>;
  LicenseState: Model<any>;
}

export interface JobServiceGraph {
  models: JobServiceModels;
  queues: Record<QueueName, Queue>;
  walletService: WalletService;
  servicesService: ServicesService;
  providerFactory: ProviderFactory;
  providersService: ProvidersService;
  couponsService: CouponsService;
  ordersService: OrdersService;
  refillsService: RefillsService;
  dripFeedService: DripFeedService;
  licenseService: LicenseService;
}

/**
 * Connects the shared mongoose instance to the customer database. Service
 * graph models are registered against this same instance via `getModel`.
 */
export async function connectCustomerDb(uri: string) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 20,
    minPoolSize: 2,
    socketTimeoutMS: 45000,
  });
  return mongoose;
}

/**
 * Wiring point for OUT-OF-Nest contexts (the worker). Builds the BullMQ queues
 * and manually constructs the domain services with their model dependencies —
 * mirroring what the API's Nest modules provide through DI.
 */
export function createJobServiceGraph(redisUrl: string): JobServiceGraph {
  const models: JobServiceModels = {
    Category: getModel("Category", categorySchema),
    Service: getModel("Service", serviceSchema),
    ServicePrice: getModel("ServicePrice", servicePriceSchema),
    Provider: getModel("Provider", providerSchema),
    ProviderService: getModel("ProviderService", providerServiceSchema),
    Wallet: getModel("Wallet", walletSchema),
    WalletTransaction: getModel("WalletTransaction", walletTransactionSchema),
    Coupon: getModel("Coupon", couponSchema),
    CouponRedemption: getModel("CouponRedemption", couponRedemptionSchema),
    Order: getModel("Order", orderSchema),
    OrderStatusHistory: getModel("OrderStatusHistory", orderStatusHistorySchema),
    Refill: getModel("Refill", refillSchema),
    DripFeedOrder: getModel("DripFeedOrder", dripFeedOrderSchema),
    Subscription: getModel("Subscription", subscriptionSchema),
    Notification: getModel("Notification", notificationSchema),
    LicenseState: getModel("LicenseState", licenseStateSchema),
  };

  const queues: Record<QueueName, Queue> = {
    [QueueName.ORDER_PROCESSING]: buildQueue(redisUrl, QueueName.ORDER_PROCESSING),
    [QueueName.ORDER_STATUS]: buildQueue(redisUrl, QueueName.ORDER_STATUS),
    [QueueName.PROVIDER_SYNC]: buildQueue(redisUrl, QueueName.PROVIDER_SYNC),
    [QueueName.REFILL_PROCESSING]: buildQueue(redisUrl, QueueName.REFILL_PROCESSING),
    [QueueName.DRIP_FEED]: buildQueue(redisUrl, QueueName.DRIP_FEED),
    [QueueName.SUBSCRIPTION_PROCESSING]: buildQueue(redisUrl, QueueName.SUBSCRIPTION_PROCESSING),
    [QueueName.EMAIL]: buildQueue(redisUrl, QueueName.EMAIL),
    [QueueName.PAYMENTS]: buildQueue(redisUrl, QueueName.PAYMENTS),
    [QueueName.NOTIFICATIONS]: buildQueue(redisUrl, QueueName.NOTIFICATIONS),
    [QueueName.REPORTS]: buildQueue(redisUrl, QueueName.REPORTS),
    [QueueName.LICENSE]: buildQueue(redisUrl, QueueName.LICENSE),
    [QueueName.CLEANUP]: buildQueue(redisUrl, QueueName.CLEANUP),
  };

  const walletService = new WalletService(models.Wallet, models.WalletTransaction);
  const servicesService = new ServicesService(models.Category, models.Service, models.ServicePrice);
  const providerFactory = new ProviderFactory(models.Provider);
  const providersService = new ProvidersService(models.Provider, models.ProviderService, providerFactory);
  const couponsService = new CouponsService(models.Coupon, models.CouponRedemption);
  const ordersService = new OrdersService(
    models.Order,
    models.OrderStatusHistory,
    queues[QueueName.ORDER_PROCESSING],
    queues[QueueName.ORDER_STATUS],
    walletService,
    servicesService,
    providerFactory,
    providersService,
    couponsService,
  );
  const refillsService = new RefillsService(models.Refill, queues[QueueName.REFILL_PROCESSING], providerFactory);
  const dripFeedService = new DripFeedService(models.DripFeedOrder, queues[QueueName.DRIP_FEED], servicesService, walletService);
  const licenseService = new LicenseService(models.LicenseState, queues[QueueName.LICENSE]);

  return {
    models,
    queues,
    walletService,
    servicesService,
    providerFactory,
    providersService,
    couponsService,
    ordersService,
    refillsService,
    dripFeedService,
    licenseService,
  };
}