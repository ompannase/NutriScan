import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../env";
import { parse, readJson } from "../lib/http";
import { requireAuth } from "../middleware/auth";

export const accountRoutes = new Hono<AppBindings>();
accountRoutes.use("*", requireAuth);

const EXPORT_LIMIT = 5000;

accountRoutes.get("/export", async (c) => {
  const userId = c.get("userId")!;
  const user = await c.env.DB
    .prepare("SELECT id, created_at FROM users WHERE id = ?").bind(userId)
    .first<{ id: string; created_at: string }>();
  const rows = await c.env.DB
    .prepare(
      `SELECT collection, record_id, data, deleted, updated_at FROM sync_records
       WHERE user_id = ? ORDER BY seq LIMIT ?`,
    )
    .bind(userId, EXPORT_LIMIT + 1)
    .all<{ collection: string; record_id: string; data: string | null; deleted: number; updated_at: string }>();
  const results = rows.results ?? [];
  return c.json({
    ok: true,
    data: {
      user,
      truncated: results.length > EXPORT_LIMIT,
      records: results.slice(0, EXPORT_LIMIT).map((r) => ({
        collection: r.collection, id: r.record_id, deleted: r.deleted === 1,
        updatedAt: r.updated_at, data: r.data ? JSON.parse(r.data) : null,
      })),
    },
  });
});

const deleteSchema = z.object({ confirm: z.literal("DELETE") });

/** Permanently removes the account, its sessions and all synced records. */
accountRoutes.delete("/", async (c) => {
  const userId = c.get("userId")!;
  parse(deleteSchema, await readJson(c.req.raw, 1_000));
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM sync_records WHERE user_id = ?").bind(userId),
    c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId),
    c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId),
  ]);
  return c.json({ ok: true, data: { deleted: true } });
});
