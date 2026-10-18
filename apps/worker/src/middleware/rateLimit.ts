import type { Context } from "hono";
import type { AppBindings } from "../env";
import { ApiError } from "../errors";
import { sha256Hex } from "../lib/crypto";

/**
 * Fixed-window counter in D1. Keys are hashed so no raw IP address is stored.
 * Throws RATE_LIMITED when `limit` is exceeded inside the window.
 */
export async function enforceRateLimit(
  db: D1Database,
  bucket: string,
  subject: string,
  limit: number,
  windowSec: number,
  code: "RATE_LIMITED" | "AI_RATE_LIMITED" = "RATE_LIMITED",
  message = "Too many requests. Please wait a moment and try again.",
): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = nowSec - (nowSec % windowSec);
  const key = `${bucket}:${await sha256Hex(subject)}`;
  const row = await db
    .prepare(
      `INSERT INTO rate_limits(key, window_start, count) VALUES(?, ?, 1)
       ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
    .bind(key, windowStart)
    .first<{ count: number }>();
  if ((row?.count ?? 1) > limit) {
    throw new ApiError(429, code, message, windowStart + windowSec - nowSec);
  }
  // Opportunistic cleanup (~1% of calls) keeps the table small on the free D1 tier.
  if (Math.random() < 0.01) {
    await db.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(nowSec - 2 * 86400).run();
  }
}

export function clientSubject(c: Context<AppBindings>): string {
  return `ip:${c.req.header("CF-Connecting-IP") ?? "unknown"}`;
}
