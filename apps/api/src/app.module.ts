import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { loadConfig } from "@smm/config";
import { loadDotEnvIfPresent } from "./env";
import { CUSTOMER_DB_NAME } from "@smm/database";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { WalletModule } from "./modules/wallet/wallet.module";
import { ServicesModule } from "./modules/services/services.module";
import { ProvidersModule } from "./modules/providers/providers.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { RefillsModule } from "./modules/refills/refills.module";
import { DripFeedModule } from "./modules/drip-feed/drip-feed.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { CouponsModule } from "./modules/coupons/coupons.module";
import { TicketsModule } from "./modules/tickets/tickets.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ReferralsModule } from "./modules/referrals/referrals.module";
import { UserApiModule } from "./modules/user-api/user-api.module";
import { LicenseModule } from "./modules/license/license.module";
import { LicenseAuthorityModule } from "./modules/license-authority/license-authority.module";
import { QueueModule } from "./modules/queue/queue.module";
import { AdminModule } from "./modules/admin/admin.module";

loadDotEnvIfPresent();
const config = loadConfig();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [() => config] }),
    MongooseModule.forRoot(config.MONGODB_URI, {
      dbName: CUSTOMER_DB_NAME,
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
    }),
    EventEmitterModule.forRoot(),
    HealthModule,
    QueueModule.configure({ connectionUrl: config.REDIS_URL }),
    AuthModule,
    UsersModule,
    SettingsModule,
    WalletModule,
    ServicesModule,
    ProvidersModule,
    OrdersModule,
    PaymentsModule,
    RefillsModule,
    DripFeedModule,
    SubscriptionsModule,
    CouponsModule,
    TicketsModule,
    NotificationsModule,
    ReferralsModule,
    UserApiModule,
    LicenseModule,
    LicenseAuthorityModule,
    AdminModule,
  ],
})
export class AppModule {
  static dbName = CUSTOMER_DB_NAME;
}