/**
 * Parses a `redis://` / `rediss://` connection URL into BullMQ/`ioredis`
 * connection options. Shared by the API (producer side) and the worker
 * (consumer side) so both always target the same Redis without drift.
 */
export function queueConnection(url: string) {
  if (url.startsWith("redis://") || url.startsWith("rediss://")) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      tls: parsed.protocol === "rediss:" ? {} : undefined,
      maxRetriesPerRequest: null,
    };
  }
  return { url, maxRetriesPerRequest: null };
}