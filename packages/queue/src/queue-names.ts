import { QueueName } from "@smm/types";

export { QueueName } from "@smm/types";

/**
 * NestJS DI tokens for each BullMQ queue instance. The API registers `Queue`
 * objects under these tokens; services use them as `@Inject(...)` targets and
 * the worker uses the same names to create its consumers.
 */
export const QueueTokens: Record<QueueName, string> = {
  [QueueName.ORDER_PROCESSING]: "QUEUE_ORDER_PROCESSING",
  [QueueName.ORDER_STATUS]: "QUEUE_ORDER_STATUS",
  [QueueName.PROVIDER_SYNC]: "QUEUE_PROVIDER_SYNC",
  [QueueName.REFILL_PROCESSING]: "QUEUE_REFILL_PROCESSING",
  [QueueName.DRIP_FEED]: "QUEUE_DRIP_FEED",
  [QueueName.SUBSCRIPTION_PROCESSING]: "QUEUE_SUBSCRIPTION_PROCESSING",
  [QueueName.EMAIL]: "QUEUE_EMAIL",
  [QueueName.PAYMENTS]: "QUEUE_PAYMENTS",
  [QueueName.NOTIFICATIONS]: "QUEUE_NOTIFICATIONS",
  [QueueName.REPORTS]: "QUEUE_REPORTS",
  [QueueName.LICENSE]: "QUEUE_LICENSE",
  [QueueName.CLEANUP]: "QUEUE_CLEANUP",
};

/** Backwards-compatible alias. */
export const QUEUE_INJECTION_TOKENS: Record<QueueName, string> = QueueTokens;