import { ApiError } from "../errors";
import { intVar, type Env } from "../env";
import { PROVIDERS } from "./adapters";
import { ProviderError, type CompletionRequest, type TextProvider } from "./types";

export function providerOrder(env: Env): TextProvider[] {
  const names = [env.AI_PROVIDER, ...(env.AI_FALLBACK_PROVIDERS ?? "").split(",")]
    .map((n) => n?.trim().toLowerCase())
    .filter((n): n is string => Boolean(n));
  return [...new Set(names)].map((n) => PROVIDERS[n]).filter((p): p is TextProvider => Boolean(p));
}

export function describeProviders(env: Env) {
  return providerOrder(env).map((p) => ({ name: p.name, ...p.status(env) }));
}

export function configuredProviders(env: Env): TextProvider[] {
  return providerOrder(env).filter((p) => p.status(env).configured);
}

export function assertAiConfigured(env: Env): void {
  if (configuredProviders(env).length > 0) return;
  const hints = describeProviders(env).map((p) => `${p.name}: ${p.reason ?? "unavailable"}`);
  throw new ApiError(
    503,
    "AI_NOT_CONFIGURED",
    `No AI provider is configured on the server. ${hints.join("; ") || "Set AI_PROVIDER and its key and model."}`,
  );
}

/** Tries each configured provider in order; only operational failures advance the chain. */
export async function completeWithFallback(env: Env, base: Omit<CompletionRequest, "signal">) {
  const providers = configuredProviders(env);
  if (providers.length === 0) assertAiConfigured(env);
  const timeoutMs = intVar(env.AI_TIMEOUT_MS, 20_000);
  const failures: ProviderError[] = [];
  for (const provider of providers) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const text = await provider.complete(env, { ...base, signal: controller.signal });
      console.log(JSON.stringify({ evt: "ai_ok", provider: provider.name }));
      return { text: text.slice(0, 6000), provider: provider.name };
    } catch (error) {
      const failure = error instanceof ProviderError ? error : new ProviderError("unavailable", provider.name);
      console.warn(JSON.stringify({ evt: "ai_fail", provider: provider.name, kind: failure.kind, status: failure.status }));
      failures.push(failure);
    } finally {
      clearTimeout(timer);
    }
  }
  if (failures.every((f) => f.kind === "blocked")) {
    throw new ApiError(502, "AI_BLOCKED", "The AI provider declined to answer that request. Try rephrasing it.");
  }
  if (failures.some((f) => f.kind === "rate_limited")) {
    throw new ApiError(429, "AI_RATE_LIMITED", "The AI provider's free allowance is busy right now. Try again shortly.", 60);
  }
  if (failures.every((f) => f.kind === "timeout")) {
    throw new ApiError(504, "AI_TIMEOUT", "The AI provider took too long to respond.");
  }
  throw new ApiError(503, "AI_UNAVAILABLE", "No AI provider could answer right now.");
}
