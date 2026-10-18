import { AppError } from "@/utils/errors";
import type { ServiceErrorCode, ServiceResult } from "./contracts";
import { friendlyError } from "@/utils/errors";

export function failure(error: unknown): ServiceResult<never> {
  const code: ServiceErrorCode =
    error instanceof AppError
      ? ({ NOT_CONFIGURED: "NOT_CONFIGURED", UNAUTHORIZED: "UNAUTHORIZED", RATE_LIMIT: "RATE_LIMIT", OFFLINE: "OFFLINE", STORAGE_LIMIT: "STORAGE_LIMIT" } as Record<string, ServiceErrorCode>)[error.code] ?? "UNAVAILABLE"
      : "UNAVAILABLE";
  return { ok: false, code, message: friendlyError(error) };
}
