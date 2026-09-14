import type { Job } from "bullmq";
import { QueueName } from "@smm/types";
import type { WorkerContext } from "../context";
import { chargeAndPlaceOrder } from "./shared";

export async function runSubscriptionJob(job: Job<any>, ctx: WorkerContext) {
  const subscriptionId = job.data.subscriptionId as string;
  const sub = await ctx.graph.models.Subscription.findById(subscriptionId);
  if (!sub) throw new Error(`Subscription not found: ${subscriptionId}`);
  if (sub.status !== "active") return { skipped: true, status: sub.status };

  if (sub.nextRunAt && new Date(sub.nextRunAt).getTime() > Date.now()) {
    await scheduleNextSubscriptionRun(ctx, sub._id.toString(), sub.publicSubscriptionId, new Date(sub.nextRunAt));
    return { skipped: true, reason: "not due yet" };
  }

  const service = await ctx.graph.servicesService.getServiceById(sub.serviceId.toString());
  await chargeAndPlaceOrder(ctx, {
    userId: sub.userId.toString(),
    service,
    link: sub.link,
    quantity: sub.quantity,
    orderType: "subscription",
    description: `Subscription run for ${service.name}`,
    note: `Subscription run for ${sub.publicSubscriptionId}`,
    runs: Math.max(1, sub.runs - sub.completedRuns),
    interval: sub.intervalDays * 24 * 60,
  });

  if (sub.completedRuns + 1 >= sub.runs) {
    await ctx.graph.models.Subscription.updateOne({ _id: sub._id }, { $set: { status: "completed" } });
    return { ran: true, completed: true };
  }

  const nextRunAt = new Date(Date.now() + sub.intervalDays * 86_400_000);
  await ctx.graph.models.Subscription.updateOne(
    { _id: sub._id },
    { $set: { nextRunAt } },
  );
  await scheduleNextSubscriptionRun(ctx, sub._id.toString(), sub.publicSubscriptionId, nextRunAt);

  return { ran: true, completed: false };
}

function scheduleNextSubscriptionRun(ctx: WorkerContext, subscriptionId: string, publicSubscriptionId: string, nextRunAt: Date) {
  const delay = Math.max(0, new Date(nextRunAt).getTime() - Date.now());
  return ctx.graph.queues[QueueName.SUBSCRIPTION_PROCESSING].add(
    "run-subscription",
    { subscriptionId },
    { jobId: `subscription-${publicSubscriptionId}`, delay, attempts: 3 },
  );
}