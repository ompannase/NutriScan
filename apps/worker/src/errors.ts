export type ErrorCode =
  | "VALIDATION_FAILED"
  | "INVALID_JSON"
  | "PAYLOAD_TOO_LARGE"
  | "UNAUTHORIZED"
  | "INVALID_ACCOUNT_KEY"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "AI_NOT_CONFIGURED"
  | "AI_RATE_LIMITED"
  | "AI_UNAVAILABLE"
  | "AI_TIMEOUT"
  | "AI_BLOCKED"
  | "QUOTA_EXCEEDED"
  | "STORAGE_LIMIT"
  | "INTERNAL";

export class ApiError extends Error {
  constructor(
    public readonly status: 400 | 401 | 404 | 413 | 429 | 500 | 502 | 503 | 504,
    public readonly code: ErrorCode,
    message: string,
    public readonly retryAfterSec?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
