/**
 * Job payload shapes shared between the API (producer) and the worker
 * (consumer). Keep payloads small and serializable — only ids/timestamps.
 */

/** `OrderProcessing` queue: submit a fresh order to the provider. */
export interface SubmitOrderData {
  orderId: string;
}

/** `OrderStatus` queue: poll a provider order until it reaches a terminal state. */
export interface CheckStatusData {
  orderId: string;
  providerOrderId: string;
  poll?: number;
}

/** `RefillProcessing` queue: run a refill against the provider. */
export interface ProcessRefillData {
  refillId: string;
}

/** `DripFeed` queue: execute the next drip-feed run. */
export interface RunDripData {
  dripId: string;
}

/** `SubscriptionProcessing` queue: execute a subscription run. */
export interface RunSubscriptionData {
  subscriptionId: string;
}

/** `ProviderSync` queue: pull the provider's service catalog. */
export interface SyncServicesData {
  providerId: string;
}

/** `License` queue: heartbeat / revalidation cycle. */
export interface LicenseHeartbeatData {
  installationId: string;
  at?: number | Date;
}

/** `Notifications` queue: push a notification to a user. */
export interface NotificationData {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}