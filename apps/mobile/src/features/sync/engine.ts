/**
 * Offline-first sync engine. Pure TypeScript: the database and the network are injected,
 * so the same code is exercised by tests against the real Worker.
 *
 * Model: every local change is recorded in `sync_outbox` by SQLite triggers. A sync pushes
 * the current state of each changed record (last-write-wins by timestamp, enforced by the
 * server), then pulls records other devices changed. Nothing is overwritten silently:
 * a rejected local edit is counted as a conflict and the winning server version is applied.
 */
import { createId } from "../../utils/id";

export interface SyncDb {
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  runAsync(sql: string, ...params: unknown[]): Promise<unknown>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/** Order matters: parents before children, so foreign keys are satisfied when applying. */
export const COLLECTION_ORDER = [
  "profile", "custom_products", "favorites", "conversations", "meal_entries", "hydration_entries", "chat_messages",
] as const;
export type Collection = (typeof COLLECTION_ORDER)[number];
/** Mirrors the server's SYNC_MAX_CHANGES. */
export const SYNC_CHUNK = 25;

export type WireChange = {
  collection: Collection; id: string; op: "upsert" | "delete"; updatedAt: string; data?: Record<string, unknown>;
};
export type SyncRequest = { deviceId: string; cursor: number; changes: WireChange[] };
export type SyncResponse = {
  cursor: number; hasMore: boolean; accepted: number;
  conflicts: { collection: string; id: string; server?: WireChange }[];
  changes: WireChange[];
};
export type SyncTransport = (request: SyncRequest) => Promise<SyncResponse>;
export type SyncReport = { pushed: number; pulled: number; conflicts: number; skipped: number };

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const json = (v: unknown) => JSON.stringify(v);
function parseRec(text: string | null | undefined): Rec | null {
  if (!text) return null;
  try { const v = JSON.parse(text) as unknown; return isRec(v) ? v : null; } catch { return null; }
}

type Handler = {
  read(db: SyncDb, id: string): Promise<Rec | null>;
  write(db: SyncDb, id: string, data: Rec, updatedAt: string): Promise<void>;
  remove(db: SyncDb, id: string): Promise<void>;
};

const HANDLERS: Record<Collection, Handler> = {
  profile: {
    async read(db) {
      const row = await db.getFirstAsync<{ data: string }>("SELECT data FROM user_profile WHERE id=1");
      return parseRec(row?.data);
    },
    async write(db, _id, data, updatedAt) {
      await db.runAsync("INSERT OR REPLACE INTO user_profile(id,data,updated_at) VALUES(1,?,?)", json(data), updatedAt);
    },
    async remove(db) { await db.runAsync("DELETE FROM user_profile WHERE id=1"); },
  },
  favorites: {
    async read(db, id) {
      const fav = await db.getFirstAsync<{ created_at: string }>("SELECT created_at FROM favorites WHERE product_id=?", id);
      if (!fav) return null;
      const product = await db.getFirstAsync<{ data: string }>("SELECT data FROM products WHERE id=?", id);
      return { createdAt: fav.created_at, product: parseRec(product?.data) ?? undefined };
    },
    async write(db, id, data, updatedAt) {
      // Carry the product snapshot so a favourite is displayable on a device that never scanned it.
      if (isRec(data.product) && str(data.product.id) === id) {
        await db.runAsync(
          "INSERT OR IGNORE INTO products(id,barcode,data,retrieved_at) VALUES(?,?,?,?)",
          id, typeof data.product.barcode === "string" ? data.product.barcode : null, json(data.product),
          str(data.product.retrievedAt, updatedAt),
        );
      }
      await db.runAsync("INSERT OR REPLACE INTO favorites(product_id,created_at) VALUES(?,?)", id, str(data.createdAt, updatedAt));
    },
    async remove(db, id) { await db.runAsync("DELETE FROM favorites WHERE product_id=?", id); },
  },
  custom_products: {
    async read(db, id) {
      const row = await db.getFirstAsync<{ data: string }>("SELECT data FROM products WHERE id=?", id);
      return parseRec(row?.data);
    },
    async write(db, id, data, updatedAt) {
      await db.runAsync(
        "INSERT OR REPLACE INTO products(id,barcode,data,retrieved_at) VALUES(?,?,?,?)",
        id, typeof data.barcode === "string" ? data.barcode : null, json({ ...data, id }), str(data.retrievedAt, updatedAt),
      );
    },
    async remove(db, id) { await db.runAsync("DELETE FROM products WHERE id=? AND id LIKE 'custom:%'", id); },
  },
  conversations: {
    async read(db, id) {
      const row = await db.getFirstAsync<{ title: string; created_at: string }>("SELECT title, created_at FROM conversations WHERE id=?", id);
      return row ? { title: row.title, createdAt: row.created_at } : null;
    },
    async write(db, id, data, updatedAt) {
      // UPSERT, not REPLACE: replacing would cascade-delete the conversation's messages.
      await db.runAsync(
        `INSERT INTO conversations(id,title,created_at) VALUES(?,?,?)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title`,
        id, str(data.title, "Conversation"), str(data.createdAt, updatedAt),
      );
    },
    async remove(db, id) { await db.runAsync("DELETE FROM conversations WHERE id=?", id); },
  },
  chat_messages: {
    async read(db, id) {
      const row = await db.getFirstAsync<{ conversation_id: string; data: string }>("SELECT conversation_id, data FROM chat_messages WHERE id=?", id);
      const message = parseRec(row?.data);
      return row && message ? { ...message, conversationId: row.conversation_id } : null;
    },
    async write(db, id, data, updatedAt) {
      const conversationId = str(data.conversationId);
      if (!conversationId) throw new Error("message without conversation");
      const { conversationId: _drop, ...message } = data;
      const createdAt = str(message.createdAt, updatedAt);
      await db.runAsync("INSERT OR IGNORE INTO conversations(id,title,created_at) VALUES(?,?,?)", conversationId, "Conversation", createdAt);
      await db.runAsync(
        "INSERT OR REPLACE INTO chat_messages(id,conversation_id,data,created_at) VALUES(?,?,?,?)",
        id, conversationId, json({ ...message, id }), createdAt,
      );
    },
    async remove(db, id) { await db.runAsync("DELETE FROM chat_messages WHERE id=?", id); },
  },
  meal_entries: {
    async read(db, id) {
      const row = await db.getFirstAsync<{ data: string }>("SELECT data FROM meal_entries WHERE id=?", id);
      return parseRec(row?.data);
    },
    async write(db, id, data) {
      const date = str(data.date);
      const meal = str(data.meal);
      if (!date || !meal) throw new Error("entry without date or meal");
      const mealId = `${date}:${meal}`;
      await db.runAsync("INSERT OR IGNORE INTO meals(id,local_date,meal_type) VALUES(?,?,?)", mealId, date, meal);
      await db.runAsync(
        "INSERT OR REPLACE INTO meal_entries(id,meal_id,product_id,data) VALUES(?,?,?,?)",
        id, mealId, typeof data.productId === "string" ? data.productId : null, json({ ...data, id }),
      );
    },
    async remove(db, id) { await db.runAsync("DELETE FROM meal_entries WHERE id=?", id); },
  },
  hydration_entries: {
    async read(db, id) {
      const row = await db.getFirstAsync<{ local_date: string; amount_ml: number; created_at: string }>(
        "SELECT local_date, amount_ml, created_at FROM hydration_entries WHERE id=?", id);
      return row ? { localDate: row.local_date, amountMl: row.amount_ml, createdAt: row.created_at } : null;
    },
    async write(db, id, data, updatedAt) {
      const localDate = str(data.localDate);
      const amount = num(data.amountMl, -1);
      if (!localDate || amount <= 0) throw new Error("invalid hydration entry");
      await db.runAsync(
        "INSERT OR REPLACE INTO hydration_entries(id,local_date,amount_ml,created_at) VALUES(?,?,?,?)",
        id, localDate, Math.round(amount), str(data.createdAt, updatedAt),
      );
    },
    async remove(db, id) { await db.runAsync("DELETE FROM hydration_entries WHERE id=?", id); },
  },
};

// ---------------------------------------------------------------- metadata
export async function getMeta(db: SyncDb, key: string): Promise<string | null> {
  return (await db.getFirstAsync<{ v: string }>("SELECT v FROM sync_meta WHERE k=?", key))?.v ?? null;
}
export async function setMeta(db: SyncDb, key: string, value: string) {
  await db.runAsync("INSERT INTO sync_meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", key, value);
}
export async function getDeviceId(db: SyncDb): Promise<string> {
  const existing = await getMeta(db, "device_id");
  if (existing) return existing;
  const id = `dev-${createId()}`;
  await setMeta(db, "device_id", id);
  return id;
}

export async function pendingCount(db: SyncDb): Promise<number> {
  const row = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) c FROM (SELECT 1 FROM sync_outbox GROUP BY collection, record_id)");
  return row?.c ?? 0;
}

/** Called once when a device first links to an account: queue everything already stored locally. */
export async function seedOutbox(db: SyncDb) {
  if ((await getMeta(db, "seeded")) === "1") return;
  const now = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
  await db.withTransactionAsync(async () => {
    const statements = [
      "SELECT 'profile', 'profile', updated_at FROM user_profile",
      "SELECT 'custom_products', id, retrieved_at FROM products WHERE id LIKE 'custom:%'",
      "SELECT 'favorites', product_id, created_at FROM favorites",
      "SELECT 'conversations', id, created_at FROM conversations",
      "SELECT 'meal_entries', e.id, m.local_date || 'T12:00:00.000Z' FROM meal_entries e JOIN meals m ON m.id = e.meal_id",
      "SELECT 'hydration_entries', id, created_at FROM hydration_entries",
      "SELECT 'chat_messages', id, created_at FROM chat_messages",
    ];
    for (const select of statements) {
      await db.runAsync(`INSERT INTO sync_outbox(collection, record_id, changed_at) ${select}`);
    }
    await db.runAsync(`UPDATE sync_outbox SET changed_at = ${now} WHERE changed_at IS NULL OR changed_at = ''`);
    await setMeta(db, "seeded", "1");
  });
}

/** Forget the link to the cloud copy (sign-out, account deletion, local wipe). Local data is untouched. */
export async function resetSyncState(db: SyncDb) {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM sync_outbox");
    await setMeta(db, "cursor", "0");
    await setMeta(db, "seeded", "0");
    await setMeta(db, "device_id", `dev-${createId()}`);
  });
}

// ------------------------------------------------------------------- engine
type Pending = { collection: Collection; id: string; changedAt: string; maxId: number };

async function collectPending(db: SyncDb): Promise<Pending[]> {
  const rows = await db.getAllAsync<{ collection: string; record_id: string; changed_at: string; max_id: number }>(
    "SELECT collection, record_id, MAX(changed_at) changed_at, MAX(id) max_id FROM sync_outbox GROUP BY collection, record_id");
  return rows
    .filter((r): r is typeof r & { collection: Collection } => (COLLECTION_ORDER as readonly string[]).includes(r.collection))
    .map((r) => ({ collection: r.collection, id: r.record_id, changedAt: r.changed_at, maxId: r.max_id }))
    .sort((a, b) => COLLECTION_ORDER.indexOf(a.collection) - COLLECTION_ORDER.indexOf(b.collection) || a.changedAt.localeCompare(b.changedAt));
}

async function clearOutbox(db: SyncDb, sent: Pending[]) {
  for (const item of sent) {
    await db.runAsync("DELETE FROM sync_outbox WHERE collection=? AND record_id=? AND id<=?", item.collection, item.id, item.maxId);
  }
}

/** Applies server changes; a local edit that is newer than the incoming one is kept and pushed next time. */
async function absorb(db: SyncDb, incoming: WireChange[], report: SyncReport) {
  if (incoming.length === 0) return;
  const ordered = [...incoming].sort((a, b) => COLLECTION_ORDER.indexOf(a.collection) - COLLECTION_ORDER.indexOf(b.collection));
  await db.withTransactionAsync(async () => {
    for (const change of ordered) {
      const handler = HANDLERS[change.collection];
      if (!handler) { report.skipped += 1; continue; }
      const pending = await db.getFirstAsync<{ t: string | null }>(
        "SELECT MAX(changed_at) t FROM sync_outbox WHERE collection=? AND record_id=?", change.collection, change.id);
      if (pending?.t && pending.t > change.updatedAt) { report.skipped += 1; continue; }
      try {
        if (change.op === "delete") await handler.remove(db, change.id);
        else await handler.write(db, change.id, isRec(change.data) ? change.data : {}, change.updatedAt);
        // The triggers just queued this write; it is the server's own data, so drop it.
        await db.runAsync("DELETE FROM sync_outbox WHERE collection=? AND record_id=?", change.collection, change.id);
        report.pulled += 1;
      } catch {
        report.skipped += 1; // one malformed remote record must never block the rest
      }
    }
  });
}

export async function runSync(db: SyncDb, transport: SyncTransport): Promise<SyncReport> {
  const report: SyncReport = { pushed: 0, pulled: 0, conflicts: 0, skipped: 0 };
  const deviceId = await getDeviceId(db);
  let cursor = Number(await getMeta(db, "cursor")) || 0;
  const pending = await collectPending(db);
  const groups: Pending[][] = [];
  for (let i = 0; i < pending.length; i += SYNC_CHUNK) groups.push(pending.slice(i, i + SYNC_CHUNK));
  if (groups.length === 0) groups.push([]);

  for (const group of groups) {
    const changes: WireChange[] = [];
    for (const item of group) {
      const data = await HANDLERS[item.collection].read(db, item.id);
      changes.push(data
        ? { collection: item.collection, id: item.id, op: "upsert", updatedAt: item.changedAt, data }
        : { collection: item.collection, id: item.id, op: "delete", updatedAt: item.changedAt });
    }
    let response = await transport({ deviceId, cursor, changes });
    await clearOutbox(db, group); // acknowledged: accepted, or rejected in favour of a newer server copy
    report.pushed += response.accepted;
    report.conflicts += response.conflicts.length;
    const winners = response.conflicts.flatMap((c) => (c.server ? [c.server] : []));
    await absorb(db, [...winners, ...response.changes], report);
    cursor = response.cursor;
    await setMeta(db, "cursor", String(cursor));
    while (response.hasMore) {
      response = await transport({ deviceId, cursor, changes: [] });
      await absorb(db, response.changes, report);
      cursor = response.cursor;
      await setMeta(db, "cursor", String(cursor));
    }
  }
  return report;
}
