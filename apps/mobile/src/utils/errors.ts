export type AppErrorCode =
  | "OFFLINE"
  | "RATE_LIMIT"
  | "NOT_FOUND"
  | "OCR_FAILURE"
  | "MALFORMED_DATA"
  | "CAMERA_DENIED"
  | "UNSUPPORTED_BARCODE"
  | "DB_FAILURE"
  | "INVALID_INPUT"
  | "TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "NOT_CONFIGURED"
  | "UNAUTHORIZED"
  | "STORAGE_LIMIT";

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message?: string,
    public readonly retryable = false,
  ) {
    super(message ?? code);
    this.name = "AppError";
  }
}

const messages: Record<AppErrorCode, string> = {
  OFFLINE: "You appear to be offline. Your saved data is still available.",
  RATE_LIMIT: "The service is busy. Please wait a moment and try again.",
  NOT_FOUND: "We couldn't find this product yet.",
  OCR_FAILURE: "We couldn't read this label clearly. Try a brighter, flatter photo.",
  MALFORMED_DATA: "This product's information could not be read safely.",
  CAMERA_DENIED: "Camera access is off. You can enter a barcode manually.",
  UNSUPPORTED_BARCODE: "This barcode format isn't supported.",
  DB_FAILURE: "Your saved data is temporarily unavailable.",
  INVALID_INPUT: "Please check the highlighted information.",
  TIMEOUT: "The request took too long. Please try again.",
  PROVIDER_UNAVAILABLE: "The service is temporarily unavailable.",
  NOT_CONFIGURED: "This feature needs a connected server, which isn't set up yet.",
  UNAUTHORIZED: "Your session expired. Please sign in again.",
  STORAGE_LIMIT: "Your cloud storage is full. Delete old data to keep syncing.",
};

export function friendlyError(error: unknown): string {
  return error instanceof AppError ? messages[error.code] : "Something went wrong. Please try again.";
}
