import { Hono } from "hono";
import { VERSION, type AppBindings } from "../env";
import { createNutritionAI } from "../providers/nutritionAi";

export const healthRoutes = new Hono<AppBindings>();

/** Reports setup state (which provider is missing what) but never any secret value. */
healthRoutes.get("/", async (c) => {
  let database = "ok";
  try {
    await c.env.DB.prepare("SELECT 1").first();
  } catch {
    database = "unavailable";
  }
  const providers = createNutritionAI(c.env).healthCheck().providers;
  return c.json({
    ok: true,
    data: {
      status: database === "ok" ? "ok" : "degraded",
      version: VERSION,
      database,
      auth: "account-key",
      ai: { configured: providers.some((p) => p.configured), providers },
      time: new Date().toISOString(),
    },
  });
});
