import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { generateRequestId } from "@smm/logger";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const headerId = req.headers["x-request-id"];
    const requestId = (Array.isArray(headerId) ? headerId[0] : headerId) ?? generateRequestId();
    (req as any).requestId = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  }
}

export function newRequestId(): string {
  return randomUUID();
}