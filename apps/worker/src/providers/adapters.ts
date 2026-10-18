import type { Env } from "../env";
import {
  classifyStatus, ProviderError, wrapFetchError,
  type CompletionRequest, type ProviderStatus, type TextProvider,
} from "./types";

function need(env: Env, ...names: (keyof Env)[]): ProviderStatus {
  const missing = names.filter((name) => !String(env[name] ?? "").trim());
  return missing.length ? { configured: false, reason: `Set ${missing.join(" and ")}` } : { configured: true };
}

/** Google Gemini via the Developer API (key + model come from server config only). */
export const gemini: TextProvider = {
  name: "gemini",
  status: (env) => need(env, "GEMINI_API_KEY", "GEMINI_MODEL"),
  async complete(env, req: CompletionRequest) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL!)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY! },
          signal: req.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: req.system }] },
            contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
            generationConfig: { maxOutputTokens: req.maxTokens, temperature: 0.4 },
          }),
        },
      );
      if (!response.ok) throw classifyStatus("gemini", response.status);
      const json = (await response.json()) as {
        promptFeedback?: { blockReason?: string };
        candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
      };
      if (json.promptFeedback?.blockReason) throw new ProviderError("blocked", "gemini");
      const candidate = json.candidates?.[0];
      const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
      if (!text) throw new ProviderError(candidate?.finishReason === "SAFETY" ? "blocked" : "bad_response", "gemini");
      return text;
    } catch (error) {
      throw wrapFetchError("gemini", error);
    }
  },
};

async function openAiCompatible(name: string, url: string, key: string | undefined, model: string, req: CompletionRequest) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      signal: req.signal,
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens,
        temperature: 0.4,
        messages: [{ role: "system", content: req.system }, ...req.messages.map((m) => ({ role: m.role, content: m.content }))],
      }),
    });
    if (!response.ok) throw classifyStatus(name, response.status);
    const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new ProviderError("bad_response", name);
    return text;
  } catch (error) {
    throw wrapFetchError(name, error);
  }
}

/** Groq (OpenAI-compatible endpoint). */
export const groq: TextProvider = {
  name: "groq",
  status: (env) => need(env, "GROQ_API_KEY", "GROQ_MODEL"),
  complete: (env, req) => openAiCompatible("groq", "https://api.groq.com/openai/v1/chat/completions", env.GROQ_API_KEY, env.GROQ_MODEL!, req),
};

/**
 * Pollinations (or any OpenAI-compatible host). Access terms were NOT verified, so this
 * only activates when the operator sets an explicit base URL and model: nothing is
 * routed to a third party by default.
 */
export const pollinations: TextProvider = {
  name: "pollinations",
  status: (env) => need(env, "POLLINATIONS_BASE_URL", "POLLINATIONS_MODEL"),
  complete: (env, req) =>
    openAiCompatible("pollinations", env.POLLINATIONS_BASE_URL!, env.POLLINATIONS_API_KEY, env.POLLINATIONS_MODEL!, req),
};

/** Cloudflare Workers AI through the optional `AI` binding. */
export const workersai: TextProvider = {
  name: "workersai",
  status: (env) => {
    if (!env.AI) return { configured: false, reason: "Enable the [ai] binding in wrangler.toml" };
    return need(env, "WORKERS_AI_MODEL");
  },
  async complete(env, req) {
    try {
      const result = (await env.AI!.run(env.WORKERS_AI_MODEL!, {
        max_tokens: req.maxTokens,
        messages: [{ role: "system", content: req.system }, ...req.messages],
      })) as { response?: string; choices?: { message?: { content?: string } }[] } | string;
      const text = typeof result === "string" ? result : (result.response ?? result.choices?.[0]?.message?.content);
      if (!text?.trim()) throw new ProviderError("bad_response", "workersai");
      return text.trim();
    } catch (error) {
      throw wrapFetchError("workersai", error);
    }
  },
};

export const PROVIDERS: Record<string, TextProvider> = { gemini, groq, pollinations, workersai };
