import type { Job } from "bullmq";
import { QueueName } from "@smm/types";
import type { WorkerContext } from "../context";
import { chargeAndPlaceOrder } from "./shared";

export async function runDripJob(job: Job<any>, ctx: WorkerContext) {
  const dripId = job.data.dripId as string;
  const drip = await ctx.graph.models.DripFeedOrder.findById(dripId);
  if (!drip) throw new Error(`Drip feed not found: ${dripId}`);
  if (drip.status === "completed" || drip.status === "canceled" || drip.status === "paused") {
    return { skipped: true, status: drip.status };
  }

  if (drip.nextRunAt && new Date(drip.nextRunAt).getTime() > Date.now()) {
    await scheduleNextDripRun(ctx, drip._id.toString(), drip.publicDripId, new Date(drip.nextRunAt));
    return { skipped: true, reason: "not due yet" };
  }

  const service = await ctx.graph.servicesService.getServiceById(drip.serviceId.toString());
  await chargeAndPlaceOrder(ctx, {
    userId: drip.userId.toString(),
    service,
    link: drip.link,
    quantity: drip.quantityPerRun,
    orderType: "drip_feed",
    description: `Drip feed run for ${service.name}`,
    note: `Drip feed run for ${drip.publicDripId}`,
    runs: Math.max(1, drip.remainingRuns),
    interval: drip.intervalMinutes,
  });

  const remaining = Math.max(0, drip.remainingRuns - 1);
  if (remaining <= 0) {
    await ctx.graph.models.DripFeedOrder.updateOne({ _id: drip._id }, { $set: { status: "completed" } });
    return { ran: true, completed: true, runsLeft: 0 };
  }

  const nextRunAt = new Date(Date.now() + drip.intervalMinutes * 60_000);
  await ctx.graph.models.DripFeedOrder.updateOne(
    { _id: drip._id },
    { $set: { status: "active", nextRunAt, remainingRuns: remaining } },
  );
  await scheduleNextDripRun(ctx, drip._id.toString(), drip.publicDripId, nextRunAt);

  return { ran: true, completed: false, runsLeft: remaining };
}

function scheduleNextDripRun(ctx: WorkerContext, dripId: string, publicDripId: string, nextRunAt: Date) {
  const delay = Math.max(0, new Date(nextRunAt).getTime() - Date.now());
  return ctx.graph.queues[QueueName.DRIP_FEED].add(
    "run-drip",
    { dripId },
    { jobId: `drip-${publicDripId}`, delay, attempts: 3 },
  );
}