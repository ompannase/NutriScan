import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../env";
import { ApiError } from "../errors";
import {
  formatAccountKey, generateAccountKey, hashAccountKey, normalizeAccountKey, nowIso, randomToken,
} from "../lib/crypto";
import { parse, readJson } from "../lib/http";
import { bearerToken, requireAuth, sessionTokenHash } from "../middleware/auth";
import { clientSubject, enforceRateLimit } from "../middleware/rateLimit";

const SESSION_DAYS = 30;
const MAX_SESSIONS_PER_USER = 10;

async function createSession(db: D1Database, userId: string) {
  const token = randomToken(32);
  const tokenHash = await sessionTokenHash(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86400_000).toISOString();
  const statements = [
    db.prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?").bind(userId, now.toISOString()),
    // Keep only the newest sessions so old devices cannot accumulate forever.
    db.prepare(
      `DELETE FROM sessions WHERE user_id = ? AND token_hash NOT IN (
         SELECT token_hash FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?)`,
    ).bind(userId, userId, MAX_SESSIONS_PER_USER - 1),
    db.prepare("INSERT INTO sessions(token_hash, user_id, created_at, expires_at) VALUES(?,?,?,?)")
      .bind(tokenHash, userId, now.toISOString(), expiresAt),
  ];
  return { token, expiresAt, statements };
}

export const authRoutes = new Hono<AppBindings>();

authRoutes.post("/register", async (c) => {
  await enforceRateLimit(c.env.DB, "register", clientSubject(c), 5, 3600);
  const userId = crypto.randomUUID();
  const accountKey = generateAccountKey();
  const keyHash = await hashAccountKey(accountKey);
  const session = await createSession(c.env.DB, userId);
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO users(id, key_hash, created_at) VALUES(?,?,?)").bind(userId, keyHash, nowIso()),
    ...session.statements,
  ]);
  return c.json(
    { ok: true, data: { userId, accountKey: formatAccountKey(accountKey), token: session.token, expiresAt: session.expiresAt } },
    201,
  );
});

const loginSchema = z.object({ accountKey: z.string().min(8).max(64) });

authRoutes.post("/login", async (c) => {
  await enforceRateLimit(c.env.DB, "login", clientSubject(c), 10, 900);
  const body = parse(loginSchema, await readJson(c.req.raw, 2_000));
  const normalized = normalizeAccountKey(body.accountKey);
  const generic = new ApiError(401, "INVALID_ACCOUNT_KEY", "That account key was not recognised.");
  if (!normalized) throw generic;
  const user = await c.env.DB
    .prepare("SELECT id FROM users WHERE key_hash = ?")
    .bind(await hashAccountKey(normalized))
    .first<{ id: string }>();
  if (!user) throw generic;
  const session = await createSession(c.env.DB, user.id);
  await c.env.DB.batch(session.statements);
  return c.json({ ok: true, data: { userId: user.id, token: session.token, expiresAt: session.expiresAt } });
});

authRoutes.post("/logout", requireAuth, async (c) => {
  const token = bearerToken(c.req.header("Authorization"))!;
  await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sessionTokenHash(token)).run();
  return c.json({ ok: true, data: { signedOut: true } });
});

authRoutes.get("/me", requireAuth, async (c) => {
  const row = await c.env.DB
    .prepare("SELECT id, created_at, record_count FROM users WHERE id = ?")
    .bind(c.get("userId")!)
    .first<{ id: string; created_at: string; record_count: number }>();
  if (!row) throw new ApiError(401, "UNAUTHORIZED", "Please sign in again.");
  return c.json({ ok: true, data: { userId: row.id, createdAt: row.created_at, syncedRecords: row.record_count } });
});
