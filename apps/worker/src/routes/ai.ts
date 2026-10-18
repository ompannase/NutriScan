import { Hono } from "hono";
import { z } from "zod";
import { intVar, type AppBindings } from "../env";
import { ApiError } from "../errors";
import { parse, readJson } from "../lib/http";
import { optionalAuth } from "../middleware/auth";
import { clientSubject, enforceRateLimit } from "../middleware/rateLimit";
import { assertAiConfigured } from "../providers/chain";
import { createNutritionAI } from "../providers/nutritionAi";

const short = z.string().trim().max(200);
const nutrition = z.record(z.string().max(32), z.number().finite()).refine((o) => Object.keys(o).length <= 20);
const productSchema = z.object({
  name: short.min(1),
  brand: short.optional(),
  ingredients: z.string().max(4000).optional(),
  allergens: z.array(short).max(30).optional(),
  novaGroup: z.number().int().min(1).max(4).optional(),
  nutritionPer100: nutrition.optional(),
});
const profileSchema = z.object({
  dietaryPreference: z.enum(["general", "vegetarian", "vegan"]).optional(),
  allergies: z.array(z.string().trim().max(40)).max(20).optional(),
  conditions: z.array(z.enum(["type2-diabetes", "hypertension", "celiac"])).max(3).optional(),
  goals: z.record(z.string().max(32), z.number().finite()).optional(),
});
const breakdownSchema = z.array(z.object({
  key: z.string().max(40), label: z.string().max(80), points: z.number().finite(), reason: z.string().max(300),
})).max(20);

const chatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) })).max(8).optional(),
  context: z.object({
    product: productSchema.optional(),
    profile: profileSchema.optional(),
    scoreBreakdown: breakdownSchema.optional(),
  }).optional(),
});
const recipeSchema = z.object({ prompt: z.string().trim().min(1).max(1000), profile: profileSchema.optional() });
const explainSchema = z.object({ breakdown: breakdownSchema.min(1), product: productSchema.optional() });
const alternativesSchema = z.object({ product: productSchema, profile: profileSchema.optional() });

export const aiRoutes = new Hono<AppBindings>();
aiRoutes.use("*", optionalAuth);

/** Applies config check, optional auth requirement, per-caller and global free-quota limits. */
aiRoutes.use("*", async (c, next) => {
  assertAiConfigured(c.env);
  const userId = c.get("userId");
  if (c.env.AI_REQUIRE_AUTH === "true" && !userId) {
    throw new ApiError(401, "UNAUTHORIZED", "Sign in to use the AI assistant.");
  }
  await enforceRateLimit(
    c.env.DB, userId ? "ai-user" : "ai-ip", userId ?? clientSubject(c), userId ? 60 : 20, 3600, "AI_RATE_LIMITED",
    "You've reached the hourly AI limit. The offline guide still works.",
  );
  await enforceRateLimit(
    c.env.DB, "ai-global", "all", intVar(c.env.AI_DAILY_GLOBAL_LIMIT, 500), 86400, "AI_RATE_LIMITED",
    "The shared daily AI allowance has been used. The offline guide still works.",
  );
  await next();
});

aiRoutes.post("/chat", async (c) => {
  const body = parse(chatSchema, await readJson(c.req.raw, 64 * 1024));
  const history = body.history?.map((h) => ({ role: h.role, content: h.text }));
  const answer = await createNutritionAI(c.env).generateAnswer({
    message: body.message, history, product: body.context?.product,
    profile: body.context?.profile, breakdown: body.context?.scoreBreakdown,
  });
  return c.json({ ok: true, data: answer });
});

aiRoutes.post("/recipe", async (c) => {
  const body = parse(recipeSchema, await readJson(c.req.raw, 16 * 1024));
  return c.json({ ok: true, data: await createNutritionAI(c.env).generateRecipe(body) });
});

aiRoutes.post("/explain-score", async (c) => {
  const body = parse(explainSchema, await readJson(c.req.raw, 32 * 1024));
  return c.json({ ok: true, data: await createNutritionAI(c.env).explainScore(body) });
});

aiRoutes.post("/alternatives", async (c) => {
  const body = parse(alternativesSchema, await readJson(c.req.raw, 32 * 1024));
  return c.json({ ok: true, data: await createNutritionAI(c.env).suggestAlternatives(body) });
});
