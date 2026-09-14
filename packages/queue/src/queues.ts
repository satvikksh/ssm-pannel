import { Queue, type QueueOptions } from "bullmq";
import type { QueueName } from "./queue-names";
import { queueConnection } from "./connection";

/**
 * Standard job options used across the platform: exponential retry backoff and
 * conservative retention so failed jobs are retriable but memory stays bounded.
 */
export function queueDefaultJobOptions(defaultRetries = 3): NonNullable<QueueOptions["defaultJobOptions"]> {
  return {
    attempts: defaultRetries,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 7 * 86400 },
  };
}

/**
 * Creates a BullMQ `Queue` (producer handle) for the given queue name. The
 * worker builds matching `Worker` instances from `queueConnection`.
 */
export function buildQueue(redisUrl: string, queueName: QueueName, defaultRetries = 3): Queue {
  const options: QueueOptions = {
    connection: queueConnection(redisUrl),
    defaultJobOptions: queueDefaultJobOptions(defaultRetries),
  };
  return new Queue(queueName, options);
}