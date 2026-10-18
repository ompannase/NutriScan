import { API_BASE_URL } from "@/config";
import { useAccountStore } from "@/stores/account";
import { AppError } from "@/utils/errors";
import { apiRequest } from "./api";
import type { AIService, ChatContext, ChatReply, ChatTurn } from "./contracts";
import { clearSession, loadSession } from "./session";
import type { Product } from "@/types/models";
import type { ScoreBreakdown } from "@/features/scoring";

const glossary: Record<string, string> = {
  lecithin: "Lecithin is an emulsifier used to help ingredients blend.",
  maltodextrin: "Maltodextrin is a rapidly digested carbohydrate used for texture or bulk.",
  inulin: "Inulin is a fermentable fibre found naturally in several plants.",
};

export class LocalFallbackAIService implements AIService {
  async chat(message: string, context?: ChatContext): Promise<ChatReply> {
    const lower = message.toLowerCase();
    if (/(recipe|alternative|swap)/.test(lower)) {
      return { text: "Recipes and product alternatives need an AI connection. Connect the app to your NutriScan server to enable them.", aiGenerated: false, needsConnection: true };
    }
    const term = Object.keys(glossary).find((key) => lower.includes(key));
    if (term) return { text: `Offline guide: ${glossary[term]}`, aiGenerated: false };
    if (context?.scoreBreakdown?.length) return this.explainScore(context.scoreBreakdown);
    return { text: "Offline guide: I can explain common ingredients and an existing NutriScan score. This is general education, not medical advice.", aiGenerated: false };
  }
  async recipe(): Promise<ChatReply> {
    return { text: "Recipe generation needs an AI connection.", aiGenerated: false, needsConnection: true };
  }
  async explainScore(breakdown: ScoreBreakdown[]): Promise<ChatReply> {
    const summary = breakdown.map((item) => `${item.label}: ${item.points > 0 ? "+" : ""}${item.points}`).join("; ");
    return { text: `Offline guide: This score reflects ${summary || "the available nutrition fields"}.`, aiGenerated: false };
  }
  async suggestAlternatives(): Promise<ChatReply> {
    return { text: "Alternative suggestions need an AI connection.", aiGenerated: false, needsConnection: true };
  }
}

const clip = (text: string | undefined, max: number) => (text && text.length > max ? text.slice(0, max) : text);

function wireProduct(product: NonNullable<ChatContext["product"]>) {
  return {
    name: product.name,
    brand: product.brand,
    ingredients: clip(product.ingredients, 4000),
    allergens: product.allergens?.slice(0, 30),
    novaGroup: product.novaGroup,
    nutritionPer100: product.nutritionPer100,
  };
}

export class RemoteAIService implements AIService {
  private async post(path: string, body: unknown, signal?: AbortSignal): Promise<ChatReply> {
    const session = await loadSession();
    const send = (token?: string) => apiRequest<{ text: string }>(`/ai/${path}`, { body, token, signal, timeoutMs: 35_000 });
    try {
      return { text: (await send(session?.token)).text, aiGenerated: true };
    } catch (error) {
      // A revoked session must not break AI for a signed-out guest: drop it and retry anonymously.
      if (error instanceof AppError && error.code === "UNAUTHORIZED" && session) {
        await clearSession();
        useAccountStore.getState().setUser(undefined);
        return { text: (await send()).text, aiGenerated: true };
      }
      throw error;
    }
  }

  chat(message: string, context?: ChatContext, signal?: AbortSignal, history?: ChatTurn[]) {
    const lower = message.toLowerCase();
    const profile = context?.profile;
    if (/\brecipes?\b/.test(lower)) return this.post("recipe", { prompt: message, profile }, signal);
    if (context?.product && /(alternative|healthier|swap|substitute)/.test(lower)) {
      return this.post("alternatives", { product: wireProduct(context.product), profile }, signal);
    }
    if (context?.scoreBreakdown?.length && /(explain|why).*(score|rating)|score.*(explain|why)/.test(lower)) {
      return this.post("explain-score", { breakdown: context.scoreBreakdown, product: context.product && wireProduct(context.product) }, signal);
    }
    return this.post("chat", {
      message: clip(message, 2000),
      history: history?.slice(-6).map((turn) => ({ role: turn.role, text: clip(turn.text, 2000) })),
      context: {
        product: context?.product && wireProduct(context.product),
        profile,
        scoreBreakdown: context?.scoreBreakdown,
      },
    }, signal);
  }
  recipe(prompt: string, signal?: AbortSignal) { return this.post("recipe", { prompt }, signal); }
  explainScore(breakdown: ScoreBreakdown[], signal?: AbortSignal) { return this.post("explain-score", { breakdown }, signal); }
  suggestAlternatives(product: Product, signal?: AbortSignal) {
    return this.post("alternatives", { product: wireProduct(product) }, signal);
  }
}

const NOTICES: Record<string, string> = {
  NOT_CONFIGURED: "The AI service isn't set up yet, so this is the offline guide.",
  OFFLINE: "You're offline, so this is the offline guide.",
  RATE_LIMIT: "AI has reached its free limit for now, so this is the offline guide.",
};

/** Tries the server AI first; on operational failure answers from the local guide, clearly labelled. */
export class ResilientAIService implements AIService {
  constructor(private readonly remote: AIService, private readonly local: AIService) {}
  private async run(task: (service: AIService) => Promise<ChatReply>): Promise<ChatReply> {
    try {
      return await task(this.remote);
    } catch (error) {
      if (!(error instanceof AppError) || error.code === "INVALID_INPUT") throw error; // includes user cancellation
      const reply = await task(this.local);
      const notice = NOTICES[error.code] ?? "AI is unavailable right now, so this is the offline guide.";
      return { ...reply, aiGenerated: false, text: `${notice}\n\n${reply.text}` };
    }
  }
  chat(message: string, context?: ChatContext, signal?: AbortSignal, history?: ChatTurn[]) { return this.run((s) => s.chat(message, context, signal, history)); }
  recipe(prompt: string, signal?: AbortSignal) { return this.run((s) => s.recipe(prompt, signal)); }
  explainScore(breakdown: ScoreBreakdown[], signal?: AbortSignal) { return this.run((s) => s.explainScore(breakdown, signal)); }
  suggestAlternatives(product: Product, signal?: AbortSignal) { return this.run((s) => s.suggestAlternatives(product, signal)); }
}

export const aiService: AIService = API_BASE_URL
  ? new ResilientAIService(new RemoteAIService(), new LocalFallbackAIService())
  : new LocalFallbackAIService();
