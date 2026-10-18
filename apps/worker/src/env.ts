export interface Env {
  DB: D1Database;
  /** Optional Workers AI binding (declare `[ai]` in wrangler.toml to enable). */
  AI?: { run(model: string, input: unknown): Promise<unknown> };

  AI_PROVIDER?: string;
  AI_FALLBACK_PROVIDERS?: string;
  AI_REQUIRE_AUTH?: string;
  AI_TIMEOUT_MS?: string;
  AI_DAILY_GLOBAL_LIMIT?: string;

  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  POLLINATIONS_API_KEY?: string;
  POLLINATIONS_BASE_URL?: string;
  POLLINATIONS_MODEL?: string;
  WORKERS_AI_MODEL?: string;
}

export type Variables = { userId?: string };
export type AppBindings = { Bindings: Env; Variables: Variables };

export const VERSION = "1.0.0";

export function intVar(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
