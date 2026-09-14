import type { AppEnv } from "@smm/config";
import { createLogger } from "@smm/logger";
import type { JobServiceGraph } from "@smm/domain";

export type WorkerLogger = ReturnType<typeof createLogger>;

export interface WorkerContext {
  config: AppEnv;
  logger: WorkerLogger;
  graph: JobServiceGraph;
}