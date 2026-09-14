import type { Job } from "bullmq";
import type { WorkerContext } from "../context";

export async function runNotificationJob(job: Job<any>, ctx: WorkerContext) {
  const { userId, type, title, body, link } = job.data;
  await ctx.graph.models.Notification.create({ userId, type, title, body, link, read: false });
  return { delivered: true };
}