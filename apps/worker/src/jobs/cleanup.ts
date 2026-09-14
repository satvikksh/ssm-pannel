import type { Job } from "bullmq";
import type { WorkerContext } from "../context";

export async function runCleanupJob(_job: Job<any>, ctx: WorkerContext) {
  const sweptDrips = await ctx.graph.models.DripFeedOrder.updateMany(
    { status: { $in: ["active", "pending"] }, remainingRuns: { $lte: 0 } },
    { $set: { status: "completed" } },
  );
  const sweptSubscriptions = await ctx.graph.models.Subscription.updateMany(
    { status: "active", $expr: { $gte: ["$completedRuns", "$runs"] } },
    { $set: { status: "completed" } },
  );
  const pausedDrips = await ctx.graph.models.DripFeedOrder.countDocuments({ status: "paused" });
  const pausedSubscriptions = await ctx.graph.models.Subscription.countDocuments({ status: "paused" });
  return { sweptDrips: sweptDrips.modifiedCount, sweptSubscriptions: sweptSubscriptions.modifiedCount, pausedDrips, pausedSubscriptions };
}