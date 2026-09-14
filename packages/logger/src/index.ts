import { randomUUID } from "node:crypto";
import { pino, type Logger as PinoLogger, type LoggerOptions } from "pino";

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

export interface LogContext {
  requestId?: string;
  userId?: string;
  orderId?: string;
  installationId?: string;
  licenseId?: string;
  [key: string]: unknown;
}

export interface Logger {
  child(bindings: LogContext): Logger;
  fatal(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  trace(message: string, context?: LogContext): void;
}

export function createLogger(options?: {
  level?: LogLevel;
  name?: string;
  redact?: string[];
}): Logger {
  const pinoOptions: LoggerOptions = {
    name: options?.name ?? "smm-panel",
    level: options?.level ?? (process.env.LOG_LEVEL as LogLevel) ?? "info",
    redact: {
      paths: [
        "password",
        "passwordHash",
        "apiKey",
        "apiSecret",
        "*.apiKey",
        "*.apiSecret",
        "*.secret",
        "accessToken",
        "refreshToken",
        "authorization",
        "paymentSecret",
        "privateKey",
        "*.privateKey",
        ...(options?.redact ?? []),
      ],
      censor: "[REDACTED]",
    },
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  const pinoLogger: PinoLogger = pino(pinoOptions);
  return wrap(pinoLogger);
}

export interface NestLoggerAdapter extends Logger {
  log(message: string | unknown, context?: LogContext): void;
  verbose(message: string | unknown, context?: LogContext): void;
  setLogLevels(): void;
}

export function createNestLogger(options?: {
  level?: LogLevel;
  name?: string;
  redact?: string[];
}): NestLoggerAdapter {
  const logger = createLogger(options);
  return {
    ...logger,
    log: (message, context) => logger.info(String(message), context),
    verbose: (message, context) => logger.debug(String(message), context),
    setLogLevels: () => undefined,
  };
}

function wrap(logger: PinoLogger): Logger {
  return {
    child: (bindings: LogContext) => wrap(logger.child(bindings as Record<string, unknown>)),
    fatal: (message, context) => logger.fatal(toBindings(context), message),
    error: (message, context) => logger.error(toBindings(context), message),
    warn: (message, context) => logger.warn(toBindings(context), message),
    info: (message, context) => logger.info(toBindings(context), message),
    debug: (message, context) => logger.debug(toBindings(context), message),
    trace: (message, context) => logger.trace(toBindings(context), message),
  };
}

function toBindings(context?: LogContext | string | string[] | unknown[] | unknown): Record<string, unknown> | undefined {
  if (context == null) return undefined;
  if (typeof context === "string") return { context };
  if (Array.isArray(context)) return { context: context.map(String).join(" ") };
  if (typeof context === "object") return context as Record<string, unknown>;
  return { context: String(context) };
}

export function generateRequestId(): string {
  return randomUUID();
}