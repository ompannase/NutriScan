import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../env";
import { ApiError } from "../errors";
import { nowIso, sha256Hex } from "../lib/crypto";

export function bearerToken(header: string | undefined): string | null {
  const match = /^Bearer\s+([A-Za-z0-9_-]{20,128})$/.exec(header ?? "");
  return match?.[1] ?? null;
}

async function resolveUser(db: D1Database, token: string): Promise<string | null> {
  const tokenHash = await sha256Hex(`nutriscan:session:v1:${token}`);
  const row = await db
    .prepare("SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(tokenHash, nowIso())
    .first<{ user_id: string }>();
  return row?.user_id ?? null;
}

/** Requires a valid session. The user id always comes from the server-side session. */
export const requireAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const token = bearerToken(c.req.header("Authorization"));
  const userId = token ? await resolveUser(c.env.DB, token) : null;
  if (!userId) throw new ApiError(401, "UNAUTHORIZED", "Please sign in again.");
  c.set("userId", userId);
  await next();
};

/** Attaches the user when a valid token is present; invalid tokens are rejected. */
export const optionalAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const header = c.req.header("Authorization");
  if (header) {
    const token = bearerToken(header);
    const userId = token ? await resolveUser(c.env.DB, token) : null;
    if (!userId) throw new ApiError(401, "UNAUTHORIZED", "Please sign in again.");
    c.set("userId", userId);
  }
  await next();
};

export async function sessionTokenHash(token: string): Promise<string> {
  return sha256Hex(`nutriscan:session:v1:${token}`);
}
