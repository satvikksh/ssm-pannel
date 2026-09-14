import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { randomUUID } from "node:crypto";
import { ApiError } from "@smm/types";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const requestId =
      request?.headers?.["x-request-id"] ?? (request?.requestId as string) ?? randomUUID();

    let status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_ERROR";
    let message = "Internal server error";
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
      } else if (typeof body === "object" && body !== null) {
        const b = body as Record<string, unknown>;
        message = typeof b.message === "string" ? b.message : Array.isArray(b.message) ? b.message.join(", ") : String(b.message ?? message);
        code = status === HttpStatus.NOT_FOUND ? "NOT_FOUND" : status === HttpStatus.UNAUTHORIZED ? "UNAUTHORIZED" : status === HttpStatus.FORBIDDEN ? "FORBIDDEN" : typeof b.error === "string" ? b.error.replace(/\s+/g, "_").toUpperCase() : code;
        if (Array.isArray(b.message)) details = { fields: b.message };
      }
    } else if (exception instanceof Error) {
      message = exception.message ?? message;
      this.logger.error(exception.message, { requestId, stack: exception.stack });
    }

    const body: ApiError = { success: false, error: { code, message, details }, requestId };

    // Attach request id to the request for downstream code
    request.requestId = requestId;

    httpAdapter.reply(response, body, status);
  }
}