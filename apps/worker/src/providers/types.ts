import type { Env } from "../env";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export interface CompletionRequest {
  system: string;
  messages: ChatTurn[];
  maxTokens: number;
  signal: AbortSignal;
}

export type ProviderErrorKind = "rate_limited" | "timeout" | "unavailable" | "auth" | "blocked" | "bad_response";

export class ProviderError extends Error {
  constructor(public readonly kind: ProviderErrorKind, public readonly provider: string, public readonly status?: number) {
    super(`${provider}:${kind}${status ? `:${status}` : ""}`);
    this.name = "ProviderError";
  }
}

export interface ProviderStatus { configured: boolean; reason?: string }

/** Low-level text provider. Adapters never see user identity or full profiles. */
export interface TextProvider {
  readonly name: string;
  status(env: Env): ProviderStatus;
  complete(env: Env, request: CompletionRequest): Promise<string>;
}

export function classifyStatus(provider: string, status: number): ProviderError {
  if (status === 429) return new ProviderError("rate_limited", provider, status);
  if (status === 401 || status === 403) return new ProviderError("auth", provider, status);
  if (status >= 500) return new ProviderError("unavailable", provider, status);
  return new ProviderError("bad_response", provider, status);
}

export function wrapFetchError(provider: string, error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return new ProviderError("timeout", provider);
  }
  return new ProviderError("unavailable", provider);
}
