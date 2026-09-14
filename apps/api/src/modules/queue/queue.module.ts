import { Global, Module } from "@nestjs/common";
import { QueueTokens, buildQueue } from "@smm/queue";
import type { QueueName } from "@smm/queue";

export { QUEUE_INJECTION_TOKENS } from "@smm/queue";

export interface QueueModuleOptions {
  connectionUrl: string;
  defaultRetries?: number;
}

@Global()
@Module({})
export class QueueModule {
  static configure(options: QueueModuleOptions) {
    const providers = (Object.entries(QueueTokens) as [QueueName, string][]).map(
      ([queueName, token]) => ({
        provide: token,
        useFactory: () => buildQueue(options.connectionUrl, queueName, options.defaultRetries),
      }),
    );

    return {
      module: QueueModule,
      providers,
      exports: providers.map((p) => p.provide),
    };
  }
}