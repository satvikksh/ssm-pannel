import { Controller, Get } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";
import { Inject } from "@nestjs/common";
import { Public } from "../../common/decorators";
import { REDIS_CLIENT } from "./health.constants";

@Controller()
export class HealthController {
  constructor(
    @InjectConnection() private readonly mongo: Connection,
    @Inject(REDIS_CLIENT) private readonly redis: any,
  ) {}

  @Public()
  @Get("health")
  async health() {
    const mongoOk = this.mongo.readyState === 1;
    let redisOk = false;
    try {
      const pong = await this.redis.ping();
      redisOk = pong === "PONG";
    } catch {
      redisOk = false;
    }
    return {
      success: true,
      data: {
        status: mongoOk && redisOk ? "ok" : "degraded",
        checks: { mongo: mongoOk ? "ok" : "error", redis: redisOk ? "ok" : "error" },
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Public()
  @Get("ready")
  async ready() {
    const mongoOk = this.mongo.readyState === 1;
    if (!mongoOk) {
      return { success: false, error: { code: "NOT_READY", message: "Database not ready" }, requestId: "health" };
    }
    return { success: true, data: { ready: true } };
  }
}