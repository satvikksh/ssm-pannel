import { ApiSuccess } from "@smm/types";
import { randomUUID } from "node:crypto";

export function ok<T>(data: T, requestId?: string): ApiSuccess<T> {
  return { success: true, data, requestId: requestId ?? randomUUID() };
}