import { Module, Global } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { REDIS_CLIENT } from "./health.constants";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const Redis = require("ioredis").default;
        return new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
          maxRetriesPerRequest: null,
          enableOfflineQueue: false,
        });
      },
    },
  ],
  controllers: [HealthController],
  exports: [REDIS_CLIENT],
})
export class HealthModule {}