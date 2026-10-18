import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../env";
import { ApiError } from "../errors";
import { parse, readJson } from "../lib/http";
import { requireAuth } from "../middleware/auth";
import { enforceRateLimit } from "../middleware/rateLimit";

export const SYNC_COLLECTIONS = [
  "profile", "custom_products", "favorites", "conversations",
  "meal_entries", "hydration_entries", "chat_messages",
] as const;
/** Kept small so one sync stays far below Workers Free per-request query limits. */
export const SYNC_MAX_CHANGES = 25;
export const SYNC_PULL_PAGE = 50;
export const MAX_RECORDS_PER_USER = 20_000;
const MAX_RECORD_BYTES = 64 * 1024;
const MAX_CLOCK_SKEW_MS = 5 * 60_000;

const changeSchema = z.object({
  collection: z.enum(SYNC_COLLECTIONS),
  id: z.string().regex(/^[\w:.\-]{1,200}$/),
  op: z.enum(["upsert", "delete"]),
  updatedAt: z.iso.datetime(),
  data: z.record(z.string(), z.unknown()).optional(),
}).refine((c) => c.op === "delete" || c.data !== undefined, { message: "upsert requires data" });

const bodySchema = z.object({
  deviceId: z.string().regex(/^[\w-]{8,64}$/),
  cursor: z.number().int().min(0),
  changes: z.array(changeSchema).max(SYNC_MAX_CHANGES),
});

type Row = { collection: string; record_id: string; data: string | null; deleted: number; updated_at: string; seq: number };

function toWire(r: Row) {
  return {
    collection: r.collection,
    id: r.record_id,
    op: (r.deleted === 1 ? "delete" : "upsert") as "delete" | "upsert",
    updatedAt: r.updated_at,
    data: r.data ? (JSON.parse(r.data) as Record<string, unknown>) : undefined,
  };
}

export const syncRoutes = new Hono<AppBindings>();
syncRoutes.use("*", requireAuth);

syncRoutes.post("/", async (c) => {
  const userId = c.get("userId")!;
  await enforceRateLimit(c.env.DB, "sync", userId, 600, 3600);
  const body = parse(bodySchema, await readJson(c.req.raw, 512 * 1024));

  const nowMs = Date.now();
  const changes = body.changes.map((change) => {
    const requested = new Date(change.updatedAt).getTime();
    const updatedAt = new Date(Math.min(requested, nowMs + MAX_CLOCK_SKEW_MS)).toISOString();
    const data = change.op === "delete" ? null : JSON.stringify(change.data);
    if (data && data.length > MAX_RECORD_BYTES) {
      throw new ApiError(413, "PAYLOAD_TOO_LARGE", "A synced record is too large.");
    }
    return { ...change, updatedAt, data };
  });

  const db = c.env.DB;
  const n = changes.length;
  const statements: D1PreparedStatement[] = [];

  if (n > 0) {
    // Which records are new for this user? (One query: keys are `collection|id`.)
    const keys = changes.map((ch) => `${ch.collection}|${ch.id}`);
    const existing = await db
      .prepare(
        `SELECT collection || '|' || record_id AS k FROM sync_records
         WHERE user_id = ? AND collection || '|' || record_id IN (${keys.map(() => "?").join(",")})`,
      )
      .bind(userId, ...keys)
      .all<{ k: string }>();
    const known = new Set((existing.results ?? []).map((r) => r.k));
    const newKeys = new Set(keys.filter((k) => !known.has(k)));
    const user = await db.prepare("SELECT record_count FROM users WHERE id = ?").bind(userId).first<{ record_count: number }>();
    if (!user) throw new ApiError(401, "UNAUTHORIZED", "Please sign in again.");
    if (user.record_count + newKeys.size > MAX_RECORDS_PER_USER) {
      throw new ApiError(413, "STORAGE_LIMIT", "Your synced storage is full. Delete old data to continue syncing.");
    }
    // Reserve a block of n sequence numbers, then give each change its own.
    statements.push(db.prepare("UPDATE users SET sync_seq = sync_seq + ?, record_count = record_count + ? WHERE id = ?")
      .bind(n, newKeys.size, userId));
    changes.forEach((ch, i) => {
      statements.push(
        db.prepare(
          `INSERT INTO sync_records(user_id, collection, record_id, data, deleted, updated_at, seq, device_id)
           VALUES(?,?,?,?,?,?, (SELECT sync_seq FROM users WHERE id = ?) - ? , ?)
           ON CONFLICT(user_id, collection, record_id) DO UPDATE SET
             data = excluded.data, deleted = excluded.deleted, updated_at = excluded.updated_at,
             seq = excluded.seq, device_id = excluded.device_id
           WHERE excluded.updated_at > sync_records.updated_at`,
        ).bind(userId, ch.collection, ch.id, ch.data, ch.op === "delete" ? 1 : 0, ch.updatedAt, userId, n - i - 1, body.deviceId),
      );
    });
  }
  // Pull everything newer than the cursor that another device wrote.
  statements.push(
    db.prepare(
      `SELECT collection, record_id, data, deleted, updated_at, seq FROM sync_records
       WHERE user_id = ? AND seq > ? AND device_id <> ? ORDER BY seq LIMIT ?`,
    ).bind(userId, body.cursor, body.deviceId, SYNC_PULL_PAGE + 1),
    db.prepare("SELECT sync_seq FROM users WHERE id = ?").bind(userId),
  );

  const results = await db.batch(statements);
  const offset = n > 0 ? 1 : 0; // skip the reserve statement
  const conflictKeys: string[] = [];
  let accepted = 0;
  changes.forEach((ch, i) => {
    const changed = results[offset + i]?.meta?.changes ?? 0;
    if (changed > 0) accepted += 1;
    else conflictKeys.push(`${ch.collection}|${ch.id}`);
  });

  // For every rejected change, hand back the winning server version so the
  // device never keeps a silently diverged copy.
  let conflicts: { collection: string; id: string; server?: ReturnType<typeof toWire> }[] = [];
  if (conflictKeys.length > 0) {
    const winners = await db
      .prepare(
        `SELECT collection, record_id, data, deleted, updated_at, seq FROM sync_records
         WHERE user_id = ? AND collection || '|' || record_id IN (${conflictKeys.map(() => "?").join(",")})`,
      )
      .bind(userId, ...conflictKeys)
      .all<Row>();
    const byKey = new Map((winners.results ?? []).map((r) => [`${r.collection}|${r.record_id}`, r]));
    conflicts = conflictKeys.map((k) => {
      const row = byKey.get(k);
      const [collection = "", ...rest] = k.split("|");
      return { collection, id: rest.join("|"), server: row ? toWire(row) : undefined };
    });
  }

  const pulled = (results[results.length - 2]?.results ?? []) as Row[];
  const currentSeq = ((results[results.length - 1]?.results ?? [])[0] as { sync_seq: number } | undefined)?.sync_seq ?? body.cursor;
  const hasMore = pulled.length > SYNC_PULL_PAGE;
  const page = pulled.slice(0, SYNC_PULL_PAGE);
  const cursor = hasMore ? page[page.length - 1]!.seq : Math.max(currentSeq, body.cursor);

  return c.json({
    ok: true,
    data: {
      cursor,
      hasMore,
      accepted,
      conflicts,
      changes: page.map(toWire),
    },
  });
});
