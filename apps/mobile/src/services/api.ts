import { API_BASE_URL } from "@/config";
import { AppError, type AppErrorCode } from "@/utils/errors";

export class ApiRequestError extends AppError {
  constructor(code: AppErrorCode, public readonly serverCode?: string, public readonly status?: number, public readonly retryAfterSec?: number, retryable = false) {
    super(code, serverCode, retryable);
    this.name = "ApiRequestError";
  }
}

function mapStatus(status: number, serverCode?: string): AppErrorCode {
  if (serverCode === "AI_NOT_CONFIGURED") return "NOT_CONFIGURED";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 413 && serverCode === "STORAGE_LIMIT") return "STORAGE_LIMIT";
  if (status === 429) return "RATE_LIMIT";
  if (status === 504) return "TIMEOUT";
  if (status === 400 || status === 413) return "INVALID_INPUT";
  return "PROVIDER_UNAVAILABLE";
}

export type ApiOptions = { method?: "GET" | "POST" | "DELETE"; body?: unknown; token?: string; signal?: AbortSignal; timeoutMs?: number };

/** Calls the NutriScan backend. Throws AppError subclasses with friendly codes; a caller abort rethrows AbortError. */
export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (!API_BASE_URL) throw new ApiRequestError("NOT_CONFIGURED");
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeoutMs ?? 25_000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort);
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers: {
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    let payload: { ok?: boolean; data?: T; error?: { code?: string; retryAfterSec?: number } } | null = null;
    try { payload = await response.json(); } catch { /* non-JSON error page */ }
    if (!response.ok || payload?.ok === false) {
      const serverCode = payload?.error?.code;
      throw new ApiRequestError(mapStatus(response.status, serverCode), serverCode, response.status, payload?.error?.retryAfterSec, response.status >= 500);
    }
    if (payload?.data === undefined) throw new ApiRequestError("MALFORMED_DATA");
    return payload.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (options.signal?.aborted) throw error; // user cancelled: let callers handle AbortError
    if (timedOut) throw new ApiRequestError("TIMEOUT", undefined, undefined, undefined, true);
    throw new ApiRequestError("OFFLINE", undefined, undefined, undefined, true);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
