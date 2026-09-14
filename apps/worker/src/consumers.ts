import type { Job } from "bullmq";
import { Worker, type WorkerOptions } from "bullmq";
import { QueueName } from "@smm/types";
import { queueConnection } from "@smm/queue";
import type { WorkerContext } from "./context";
import { runDripJob } from "./jobs/drip";
import { runSubscriptionJob } from "./jobs/subscription";
import { runNotificationJob } from "./jobs/notification";
import { runCleanupJob } from "./jobs/cleanup";

export type JobHandler = (job: Job<any>, ctx: WorkerContext) => Promise<unknown>;

export function registerWorkers(ctx: WorkerContext): Worker[] {
  const workers: Worker[] = [];

  const register = (queue: QueueName, handler: JobHandler, options: Partial<WorkerOptions> = {}): Worker => {
    const worker = new Worker(
      queue,
      async (job) => {
        ctx.logger.info(`${queue}:${job.name} started`, { requestId: job.id?.toString() });
        await handler(job, ctx);
      },
      { connection: queueConnection(ctx.config.REDIS_URL), concurrency: 5, ...options },
    );
    worker.on("failed", (job, err) => {
      ctx.logger.error(`${queue} job failed`, { requestId: job?.id?.toString(), error: err.message });
    });
    worker.on("error", (err) => {
      ctx.logger.error(`${queue} worker error`, { error: err.message });
    });
    workers.push(worker);
    return worker;
  };

  register(QueueName.ORDER_PROCESSING, async (job) => {
    if (job.name === "submit-order") return ctx.graph.ordersService.submitToProvider(job.data.orderId);
    ctx.logger.warn(`unhandled job type ${QueueName.ORDER_PROCESSING}:${job.name}`);
  });

  register(QueueName.ORDER_STATUS, async (job) => {
    if (job.name !== "check-status") {
      ctx.logger.warn(`unhandled job type ${QueueName.ORDER_STATUS}:${job.name}`);
      return;
    }
    const result = await ctx.graph.ordersService.syncStatus(job.data.orderId, job.data.providerOrderId);
    const poll = (job.data.poll ?? 0) + 1;
    ctx.logger.debug(`order-status poll#${poll}: normalized=${result.normalized ?? "none"} raw=${result.rawStatus ?? "none"} pollIdx=${job.data.poll ?? 0}`);
    if (result.normalized && ["pending", "processing", "in_progress"].includes(result.normalized) && poll < 60) {
      const delayMs = Number(process.env.WORKER_STATUS_POLL_DELAY_MS || 30_000);
      await ctx.graph.queues[QueueName.ORDER_STATUS].add(
        "check-status",
        { orderId: job.data.orderId, providerOrderId: job.data.providerOrderId, poll },
        {
          jobId: `status-poll-${job.data.orderId}-${poll}`,
          delay: delayMs,
          attempts: 5,
          backoff: { type: "exponential", delay: 10_000 },
        },
      );
      ctx.logger.debug(`order-status rescheduled poll#${poll} in ${delayMs}ms`);
    }
    return result;
  });

  register(QueueName.REFILL_PROCESSING, async (job) => {
    if (job.name === "process-refill" || job.name === "refill-order") return ctx.graph.refillsService.process(job.data.refillId);
    ctx.logger.warn(`unhandled job type ${QueueName.REFILL_PROCESSING}:${job.name}`);
  });

  register(QueueName.PROVIDER_SYNC, async (job) => {
    if (job.name === "sync-services") return ctx.graph.providersService.syncServices(job.data.providerId);
    ctx.logger.warn(`unhandled job type ${QueueName.PROVIDER_SYNC}:${job.name}`);
  });

  register(QueueName.DRIP_FEED, runDripJob);
  register(QueueName.SUBSCRIPTION_PROCESSING, runSubscriptionJob);
  register(QueueName.NOTIFICATIONS, runNotificationJob);
  register(QueueName.CLEANUP, runCleanupJob);

  register(QueueName.LICENSE, async (job) => {
    if (job.name !== "license-heartbeat") {
      ctx.logger.warn(`unhandled job type ${QueueName.LICENSE}:${job.name}`);
      return;
    }
    const result = await ctx.graph.licenseService.validate();
    const state = (await ctx.graph.models.LicenseState.findOne({
      installationId: process.env.INSTALLATION_ID ?? "dev-installation",
    }).lean()) as any;
    const nextAt = new Date(state?.nextValidationAt ?? Date.now() + 6 * 60 * 60 * 1000);
    await ctx.graph.queues[QueueName.LICENSE].add(
      "license-heartbeat",
      { installationId: process.env.INSTALLATION_ID ?? "dev-installation", at: new Date() },
      {
        jobId: `license-heartbeat-${Date.now()}`,
        delay: Math.max(0, nextAt.getTime() - Date.now()),
        attempts: 5,
        backoff: { type: "exponential", delay: 60_000 },
      },
    );
    return result;
  });

  register(QueueName.EMAIL, async (job) => {
    ctx.logger.info(`email:${job.name} received; SMTP transport not wired yet`, { requestId: job.id?.toString() });
    return { deferred: true };
  });

  register(QueueName.PAYMENTS, async (job) => {
    ctx.logger.info(`payments:${job.name} received; gateway intent not wired yet`, { requestId: job.id?.toString() });
    return { deferred: true };
  });

  register(QueueName.REPORTS, async (job) => {
    ctx.logger.info(`reports:${job.name} received; report generator not wired yet`, { requestId: job.id?.toString() });
    return { deferred: true };
  });

  return workers;
}