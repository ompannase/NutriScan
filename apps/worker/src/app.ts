import { Hono } from "hono";
import type { AppBindings } from "./env";
import { ApiError } from "./errors";
import { securityHeaders } from "./middleware/security";
import { accountRoutes } from "./routes/account";
import { aiRoutes } from "./routes/ai";
import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";
import { syncRoutes } from "./routes/sync";

export function createApp() {
  const app = new Hono<AppBindings>();
  app.use("*", securityHeaders);

  app.onError((error, c) => {
    if (error instanceof ApiError) {
      if (error.retryAfterSec) c.header("Retry-After", String(error.retryAfterSec));
      return c.json(
        { ok: false, error: { code: error.code, message: error.message, retryAfterSec: error.retryAfterSec, details: error.details } },
        error.status,
      );
    }
    // Log only the error type: never request bodies, tokens, keys or stack traces.
    console.error(JSON.stringify({ evt: "unhandled", name: error.name }));
    return c.json({ ok: false, error: { code: "INTERNAL", message: "Something went wrong on our side. Please try again." } }, 500);
  });

  app.notFound((c) => c.json({ ok: false, error: { code: "NOT_FOUND", message: "Route not found." } }, 404));

  const v1 = new Hono<AppBindings>();
  v1.route("/health", healthRoutes);
  v1.route("/auth", authRoutes);
  v1.route("/ai", aiRoutes);
  v1.route("/sync", syncRoutes);
  v1.route("/account", accountRoutes);
  app.route("/api/v1", v1);
  return app;
}
