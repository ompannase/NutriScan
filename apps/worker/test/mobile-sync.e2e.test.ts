/**
 * Contract test: the REAL mobile SQLite migrations + sync engine talk to the REAL worker.
 * Each "phone" is its own in-memory SQLite database.
 */
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { migrations } from "../../mobile/src/database/schema";
import {
  getMeta, pendingCount, resetSyncState, runSync, seedOutbox, type SyncDb, type SyncTransport,
} from "../../mobile/src/features/sync/engine";
import { makeWorld } from "./helpers";

class Phone implements SyncDb {
  raw = new DatabaseSync(":memory:");
  constructor(foreignKeys: boolean) {
    for (const migration of migrations) this.raw.exec(migration);
    this.raw.exec(`PRAGMA foreign_keys = ${foreignKeys ? "ON" : "OFF"}`);
  }
  async getAllAsync<T>(sql: string, ...p: unknown[]) { return this.raw.prepare(sql).all(...(p as never[])).map((r) => ({ ...r })) as T[]; }
  async getFirstAsync<T>(sql: string, ...p: unknown[]) { const r = this.raw.prepare(sql).get(...(p as never[])); return (r ? { ...r } : null) as T | null; }
  async runAsync(sql: string, ...p: unknown[]) { return this.raw.prepare(sql).run(...(p as never[])); }
  async withTransactionAsync(task: () => Promise<void>) {
    this.raw.exec("BEGIN");
    try { await task(); this.raw.exec("COMMIT"); } catch (e) { this.raw.exec("ROLLBACK"); throw e; }
  }
  all(sql: string, ...p: unknown[]) { return this.raw.prepare(sql).all(...(p as never[])).map((r) => ({ ...r })); }
  run(sql: string, ...p: unknown[]) { this.raw.prepare(sql).run(...(p as never[])); }
  scalar<T>(sql: string, ...p: unknown[]) { const r = this.raw.prepare(sql).get(...(p as never[])) as Record<string, T> | undefined; return r ? Object.values(r)[0] : undefined; }
}

const profile = (name: string) => JSON.stringify({ name, dietaryPreference: "general", allergies: [], conditions: [], goals: { calories: 2000, proteinG: 75, carbsG: 250, fatG: 65, waterMl: 2000 } });
const product = { id: "off:123", barcode: "123", name: "Test oats (test data)", nutritionPer100: { energyKcal: 370 }, allergens: [], traces: [], labels: [], source: "Open Food Facts", retrievedAt: "2026-10-01T00:00:00.000Z", origin: "api", verified: true };
const entry = (id: string, kcal = 100) => JSON.stringify({ id, productId: "off:123", productName: "Test oats", meal: "snack", amountG: 40, nutrition: { energyKcal: kcal }, date: "2026-10-18", approximate: false });

async function setup(foreignKeys: boolean) {
  const world = makeWorld();
  const account = await world.register();
  const transport: SyncTransport = async (req) => {
    const r = await world.call("/sync", { token: account.token, body: req });
    if (r.status !== 200) throw new Error(`sync failed ${r.status} ${r.json?.error?.code}`);
    return r.json.data;
  };
  const a = new Phone(foreignKeys);
  const b = new Phone(foreignKeys);
  return { world, transport, a, b };
}

function seedPhoneA(a: Phone) {
  a.run("INSERT OR REPLACE INTO user_profile(id,data,updated_at) VALUES(1,?,?)", profile("Om"), new Date().toISOString());
  a.run("INSERT INTO products(id,barcode,data,retrieved_at) VALUES(?,?,?,?)", "off:123", "123", JSON.stringify(product), product.retrievedAt);
  a.run("INSERT INTO products(id,barcode,data,retrieved_at) VALUES(?,?,?,?)", "custom:abc", null, JSON.stringify({ id: "custom:abc", name: "Homemade ladoo", nutritionPer100: { energyKcal: 420 }, allergens: [], traces: [], labels: [], source: "User-entered", retrievedAt: "2026-10-02T00:00:00.000Z", origin: "user-entered", verified: false }), "2026-10-02T00:00:00.000Z");
  a.run("INSERT INTO favorites(product_id,created_at) VALUES(?,?)", "off:123", "2026-10-03T00:00:00.000Z");
  a.run("INSERT OR IGNORE INTO meals(id,local_date,meal_type) VALUES('2026-10-18:snack','2026-10-18','snack')");
  a.run("INSERT INTO meal_entries(id,meal_id,product_id,data) VALUES(?,?,?,?)", "e1", "2026-10-18:snack", "off:123", entry("e1"));
  a.run("INSERT INTO hydration_entries(id,local_date,amount_ml,created_at) VALUES('w1','2026-10-18',250,'2026-10-18T08:00:00.000Z')");
  a.run("INSERT INTO conversations(id,title,created_at) VALUES('c1','Is oats healthy?','2026-10-18T09:00:00.000Z')");
  a.run("INSERT INTO chat_messages(id,conversation_id,data,created_at) VALUES(?,?,?,?)", "m1", "c1", JSON.stringify({ id: "m1", role: "user", text: "Is oats healthy?", createdAt: "2026-10-18T09:00:01.000Z", aiGenerated: false }), "2026-10-18T09:00:01.000Z");
}

describe.each([[false], [true]])("mobile <-> worker sync (foreign keys %s)", (fk) => {
  it("replicates every collection from phone A to a fresh phone B, and queues nothing after pulling", async () => {
    const { transport, a, b } = await setup(fk);
    seedPhoneA(a);
    expect(await pendingCount(a)).toBe(7);
    const sent = await runSync(a, transport);
    expect(sent.pushed).toBe(7);
    expect(await pendingCount(a)).toBe(0);

    const got = await runSync(b, transport);
    expect(got.pulled).toBe(7);
    expect(JSON.parse(b.scalar<string>("SELECT data FROM user_profile")!).name).toBe("Om");
    expect(b.scalar("SELECT COUNT(*) FROM favorites")).toBe(1);
    expect(JSON.parse(b.scalar<string>("SELECT data FROM products WHERE id='off:123'")!).name).toContain("oats");
    expect(b.scalar("SELECT COUNT(*) FROM products WHERE id LIKE 'custom:%'")).toBe(1);
    expect(b.scalar("SELECT COUNT(*) FROM meal_entries")).toBe(1);
    expect(b.scalar("SELECT meal_id FROM meal_entries WHERE id='e1'")).toBe("2026-10-18:snack");
    expect(b.scalar("SELECT SUM(amount_ml) FROM hydration_entries")).toBe(250);
    expect(b.scalar("SELECT title FROM conversations WHERE id='c1'")).toBe("Is oats healthy?");
    expect(b.scalar("SELECT conversation_id FROM chat_messages WHERE id='m1'")).toBe("c1");
    expect(await pendingCount(b)).toBe(0);

    const again = await runSync(b, transport);
    expect(again).toEqual({ pushed: 0, pulled: 0, conflicts: 0, skipped: 0 });
  });

  it("propagates edits and deletions, including cascading conversation removal", async () => {
    const { transport, a, b } = await setup(fk);
    seedPhoneA(a); await runSync(a, transport); await runSync(b, transport);

    a.run("INSERT OR REPLACE INTO meal_entries(id,meal_id,product_id,data) VALUES(?,?,?,?)", "e1", "2026-10-18:snack", "off:123", entry("e1", 555));
    a.run("UPDATE conversations SET title='Renamed' WHERE id='c1'");
    a.run("DELETE FROM favorites WHERE product_id='off:123'");
    a.run("DELETE FROM hydration_entries WHERE id='w1'");
    await runSync(a, transport); await runSync(b, transport);
    expect(JSON.parse(b.scalar<string>("SELECT data FROM meal_entries WHERE id='e1'")!).nutrition.energyKcal).toBe(555);
    expect(b.scalar("SELECT title FROM conversations WHERE id='c1'")).toBe("Renamed");
    expect(b.scalar("SELECT COUNT(*) FROM favorites")).toBe(0);
    expect(b.scalar("SELECT COUNT(*) FROM hydration_entries")).toBe(0);

    a.run("DELETE FROM conversations WHERE id='c1'");
    await runSync(a, transport); await runSync(b, transport);
    expect(b.scalar("SELECT COUNT(*) FROM conversations")).toBe(0);
    expect(b.scalar("SELECT COUNT(*) FROM chat_messages")).toBe(0);
  });

  it("collapses repeated offline edits of one record into a single push", async () => {
    const { transport, a } = await setup(fk);
    a.run("INSERT OR IGNORE INTO meals(id,local_date,meal_type) VALUES('2026-10-18:snack','2026-10-18','snack')");
    for (const kcal of [100, 200, 300]) a.run("INSERT OR REPLACE INTO meal_entries(id,meal_id,product_id,data) VALUES(?,?,?,?)", "e1", "2026-10-18:snack", null, entry("e1", kcal));
    expect(await pendingCount(a)).toBe(1);
    const report = await runSync(a, transport);
    expect(report.pushed).toBe(1);
  });

  it("resolves a two-device conflict by newest timestamp and tells the loser", async () => {
    const { transport, a, b, world } = await setup(fk);
    a.run("INSERT OR REPLACE INTO user_profile(id,data,updated_at) VALUES(1,?,?)", profile("Base"), new Date().toISOString());
    a.run("UPDATE sync_outbox SET changed_at=?", new Date(Date.now() - 600_000).toISOString());
    await runSync(a, transport); await runSync(b, transport);

    // Both edit offline; A's edit is newer.
    a.run("INSERT OR REPLACE INTO user_profile(id,data,updated_at) VALUES(1,?,?)", profile("A-newer"), new Date().toISOString());
    b.run("INSERT OR REPLACE INTO user_profile(id,data,updated_at) VALUES(1,?,?)", profile("B-older"), new Date().toISOString());
    a.run("UPDATE sync_outbox SET changed_at=?", new Date(Date.now() - 1_000).toISOString());
    b.run("UPDATE sync_outbox SET changed_at=?", new Date(Date.now() - 60_000).toISOString());

    expect((await runSync(a, transport)).pushed).toBe(1);
    const loser = await runSync(b, transport);
    expect(loser.pushed).toBe(0);
    expect(loser.conflicts).toBe(1);
    expect(JSON.parse(b.scalar<string>("SELECT data FROM user_profile")!).name).toBe("A-newer");
    const row = world.raw.prepare("SELECT data FROM sync_records WHERE record_id='profile'").get() as { data: string };
    expect(JSON.parse(row.data).name).toBe("A-newer");
    await runSync(a, transport);
    expect(JSON.parse(a.scalar<string>("SELECT data FROM user_profile")!).name).toBe("A-newer");
  });

  it("keeps a newer unsynced local edit when an older remote version arrives", async () => {
    const { transport, a, b } = await setup(fk);
    a.run("INSERT OR REPLACE INTO user_profile(id,data,updated_at) VALUES(1,?,?)", profile("Remote"), new Date().toISOString());
    a.run("UPDATE sync_outbox SET changed_at=?", new Date(Date.now() - 120_000).toISOString());
    await runSync(a, transport);
    b.run("INSERT OR REPLACE INTO user_profile(id,data,updated_at) VALUES(1,?,?)", profile("Local-newer"), new Date().toISOString());
    const report = await runSync(b, transport);
    expect(report.skipped).toBe(0); // pushed (accepted) rather than overwritten
    expect(report.pushed).toBe(1);
    expect(JSON.parse(b.scalar<string>("SELECT data FROM user_profile")!).name).toBe("Local-newer");
  });

  it("uploads pre-existing guest data on first link via seeding", async () => {
    const { transport, a, b } = await setup(fk);
    // Rows inserted before triggers would matter: simulate guest data that predates the link.
    seedPhoneA(a);
    a.run("DELETE FROM sync_outbox");
    expect(await pendingCount(a)).toBe(0);
    await seedOutbox(a);
    expect(await pendingCount(a)).toBe(7);
    await runSync(a, transport); await runSync(b, transport);
    expect(b.scalar("SELECT COUNT(*) FROM meal_entries")).toBe(1);
    await seedOutbox(a); // idempotent
    expect(await pendingCount(a)).toBe(0);
  });

  it("restores cloud data after a local wipe without deleting the cloud copy", async () => {
    const { transport, a, world } = await setup(fk);
    seedPhoneA(a); await runSync(a, transport);
    for (const table of ["chat_messages", "conversations", "meal_entries", "hydration_entries", "favorites", "products", "user_profile"]) a.run(`DELETE FROM ${table}`);
    await resetSyncState(a);
    expect(await pendingCount(a)).toBe(0);
    expect(await getMeta(a, "cursor")).toBe("0");
    await runSync(a, transport);
    expect(a.scalar("SELECT COUNT(*) FROM meal_entries")).toBe(1);
    expect(world.raw.prepare("SELECT COUNT(*) c FROM sync_records WHERE deleted=1").get()).toEqual({ c: 0 });
  });

  it("skips malformed remote records without blocking the rest", async () => {
    const { transport, a, b, world } = await setup(fk);
    seedPhoneA(a); await runSync(a, transport);
    const user = world.raw.prepare("SELECT id FROM users").get() as { id: string };
    world.raw.prepare("INSERT INTO sync_records(user_id,collection,record_id,data,deleted,updated_at,seq,device_id) VALUES(?,?,?,?,0,?,?,?)")
      .run(user.id, "meal_entries", "broken", JSON.stringify({ nothing: true }), new Date().toISOString(), 999, "device-zzzzzzzz");
    const report = await runSync(b, transport);
    expect(report.skipped).toBe(1);
    expect(report.pulled).toBe(7);
    expect(b.scalar("SELECT COUNT(*) FROM meal_entries")).toBe(1);
  });

  it("syncs more than one page of records in both directions", async () => {
    const { transport, a, b } = await setup(fk);
    for (let i = 0; i < 130; i++) a.run("INSERT INTO hydration_entries(id,local_date,amount_ml,created_at) VALUES(?,?,?,?)", `bulk-${i}`, "2026-10-18", 100, `2026-10-18T10:${String(i % 60).padStart(2, "0")}:00.000Z`);
    const sent = await runSync(a, transport);
    expect(sent.pushed).toBe(130);
    const got = await runSync(b, transport);
    expect(got.pulled).toBe(130);
    expect(b.scalar("SELECT COUNT(*) FROM hydration_entries")).toBe(130);
  });
});
