import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../env";

export const securityHeaders: MiddlewareHandler<AppBindings> = async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Cache-Control", "no-store");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
};
