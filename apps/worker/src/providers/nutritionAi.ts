import type { Env } from "../env";
import { completeWithFallback, describeProviders } from "./chain";
import {
  alternativesMessages, chatMessages, explainScoreMessages, recipeMessages, SYSTEM_PROMPT,
  type BreakdownItem, type ProductContext, type ProfileContext,
} from "./prompts";
import type { ChatTurn } from "./types";

export type AiAnswer = { text: string; provider: string };

/** The application-level AI interface; provider adapters sit underneath it. */
export interface NutritionAIProvider {
  generateAnswer(a: { message: string; history?: ChatTurn[]; product?: ProductContext; profile?: ProfileContext; breakdown?: BreakdownItem[] }): Promise<AiAnswer>;
  generateRecipe(a: { prompt: string; profile?: ProfileContext }): Promise<AiAnswer>;
  explainScore(a: { breakdown: BreakdownItem[]; product?: ProductContext }): Promise<AiAnswer>;
  suggestAlternatives(a: { product: ProductContext; profile?: ProfileContext }): Promise<AiAnswer>;
  healthCheck(): { providers: ReturnType<typeof describeProviders> };
}

export function createNutritionAI(env: Env): NutritionAIProvider {
  const run = (messages: ChatTurn[], maxTokens = 700) =>
    completeWithFallback(env, { system: SYSTEM_PROMPT, messages, maxTokens });
  return {
    generateAnswer: (a) => run(chatMessages(a)),
    generateRecipe: (a) => run(recipeMessages(a.prompt, a.profile), 900),
    explainScore: (a) => run(explainScoreMessages(a.breakdown, a.product)),
    suggestAlternatives: (a) => run(alternativesMessages(a.product, a.profile)),
    healthCheck: () => ({ providers: describeProviders(env) }),
  };
}
