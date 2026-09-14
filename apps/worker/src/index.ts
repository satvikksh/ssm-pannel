import "reflect-metadata";
import { loadConfig } from "@smm/config";
import { createLogger } from "@smm/logger";
import { mongoose } from "@smm/database";
import { connectCustomerDb, createJobServiceGraph } from "@smm/domain";
import { loadDotEnvIfPresent } from "./env";
import { registerWorkers } from "./consumers";
import type { WorkerContext } from "./context";

process.on("unhandledRejection", (reason: unknown) => {
  console.error("worker unhandledRejection", reason);
});

async function start(): Promise<void> {
  loadDotEnvIfPresent();
  const config = loadConfig();
  const logger = createLogger({ name: "worker" });

  await connectCustomerDb(config.MONGODB_URI);
  logger.info("connected to mongodb", { uri: config.MONGODB_URI });

  const graph = createJobServiceGraph(config.REDIS_URL);
  const ctx: WorkerContext = { config, logger, graph };
  const workers = registerWorkers(ctx);

  logger.info("worker ready", { queues: workers.length, redisUrl: config.REDIS_URL });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`shutting down on ${signal}`);
    await Promise.all(workers.map((w) => w.close()));
    await Promise.all(Object.values(graph.queues).map((q) => q.close()));
    await mongoose.disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

start().catch((err) => {
  console.error("worker failed to start", err);
  process.exit(1);
});