import { describe, expect, it } from "vitest";
import { formatAccountKey, generateAccountKey, normalizeAccountKey } from "../src/lib/crypto";
import { change, makeWorld } from "./helpers";

const DEVICE_A = "device-aaaaaaaa";
const DEVICE_B = "device-bbbbbbbb";
const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();

describe("account keys", () => {
  it("generates 120-bit keys and normalises look-alike input", () => {
    const key = generateAccountKey();
    expect(key).toMatch(/^[0-9A-HJKMNP-TV-Z]{24}$/);
    const pretty = formatAccountKey(key);
    expect(pretty).toMatch(/^([0-9A-Z]{4}-){5}[0-9A-Z]{4}$/);
    expect(normalizeAccountKey(pretty.toLowerCase())).toBe(key);
    expect(normalizeAccountKey("short")).toBeNull();
  });
});

describe("auth", () => {
  it("registers, logs in with a re-typed key, and rejects a wrong key", async () => {
    const w = makeWorld();
    const account = await w.register();
    expect(account.status).toBe(201);
    expect(account.token.length).toBeGreaterThan(30);

    const retyped = account.accountKey.toLowerCase().replace(/-/g, " ");
    const login = await w.call("/auth/login", { body: { accountKey: retyped } });
    expect(login.status).toBe(200);
    expect(login.json.data.userId).toBe(account.userId);

    const wrong = await w.call("/auth/login", { body: { accountKey: "ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ" } });
    expect(wrong.status).toBe(401);
    expect(wrong.json.error.code).toBe("INVALID_ACCOUNT_KEY");
  });

  it("stores only a hash of the account key and of session tokens", async () => {
    const w = makeWorld();
    const account = await w.register();
    const dump = JSON.stringify([
      w.raw.prepare("SELECT * FROM users").all(),
      w.raw.prepare("SELECT * FROM sessions").all(),
    ]);
    expect(dump).not.toContain(account.token);
    expect(dump).not.toContain(account.accountKey.replace(/-/g, ""));
  });

  it("rate limits login attempts per client", async () => {
    const w = makeWorld();
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (await w.call("/auth/login", { body: { accountKey: "ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ" } })).status;
    }
    expect(last).toBe(429);
  });

  it("invalidates the session on logout and rejects missing/expired tokens", async () => {
    const w = makeWorld();
    const a = await w.register();
    expect((await w.call("/auth/me", { token: a.token })).status).toBe(200);
    expect((await w.call("/auth/me")).status).toBe(401);
    expect((await w.call("/auth/me", { token: "x".repeat(40) })).status).toBe(401);
    await w.call("/auth/logout", { method: "POST", token: a.token });
    expect((await w.call("/auth/me", { token: a.token })).status).toBe(401);

    const b = await w.register();
    w.raw.prepare("UPDATE sessions SET expires_at = ?").run("2000-01-01T00:00:00.000Z");
    expect((await w.call("/auth/me", { token: b.token })).status).toBe(401);
  });
});

describe("sync", () => {
  it("pushes from one device and pulls on another, excluding the sender's own writes", async () => {
    const w = makeWorld();
    const { token } = await w.register();
    const t = iso(-1000);
    const push = await w.call("/sync", { token, body: { deviceId: DEVICE_A, cursor: 0, changes: [change("favorites", "off:1", t, { createdAt: t })] } });
    expect(push.status).toBe(200);
    expect(push.json.data.accepted).toBe(1);
    expect(push.json.data.changes).toEqual([]);

    const pull = await w.call("/sync", { token, body: { deviceId: DEVICE_B, cursor: 0, changes: [] } });
    expect(pull.json.data.changes).toHaveLength(1);
    expect(pull.json.data.changes[0]).toMatchObject({ collection: "favorites", id: "off:1", op: "upsert" });

    const again = await w.call("/sync", { token, body: { deviceId: DEVICE_B, cursor: pull.json.data.cursor, changes: [] } });
    expect(again.json.data.changes).toEqual([]);
  });

  it("keeps the newer edit, reports the loser as a conflict and returns the winner", async () => {
    const w = makeWorld();
    const { token } = await w.register();
    await w.call("/sync", { token, body: { deviceId: DEVICE_A, cursor: 0, changes: [change("profile", "profile", iso(-1000), { name: "Newer" })] } });
    const stale = await w.call("/sync", { token, body: { deviceId: DEVICE_B, cursor: 0, changes: [change("profile", "profile", iso(-60_000), { name: "Older" })] } });
    expect(stale.json.data.accepted).toBe(0);
    expect(stale.json.data.conflicts).toHaveLength(1);
    expect(stale.json.data.conflicts[0].server.data).toEqual({ name: "Newer" });
    const row = w.raw.prepare("SELECT data FROM sync_records WHERE record_id='profile'").get() as { data: string };
    expect(JSON.parse(row.data).name).toBe("Newer");
  });

  it("propagates deletes as tombstones and lets a later edit win over them", async () => {
    const w = makeWorld();
    const { token } = await w.register();
    await w.call("/sync", { token, body: { deviceId: DEVICE_A, cursor: 0, changes: [change("meal_entries", "e1", iso(-5000), { kcal: 100 })] } });
    await w.call("/sync", { token, body: { deviceId: DEVICE_A, cursor: 0, changes: [change("meal_entries", "e1", iso(-3000), {}, "delete")] } });
    const pull = await w.call("/sync", { token, body: { deviceId: DEVICE_B, cursor: 0, changes: [] } });
    expect(pull.json.data.changes).toEqual([expect.objectContaining({ id: "e1", op: "delete" })]);
    const revive = await w.call("/sync", { token, body: { deviceId: DEVICE_B, cursor: pull.json.data.cursor, changes: [change("meal_entries", "e1", iso(-1000), { kcal: 120 })] } });
    expect(revive.json.data.accepted).toBe(1);
  });

  it("pages large pulls with hasMore and an advancing cursor", async () => {
    const w = makeWorld();
    const { token } = await w.register();
    for (let batch = 0; batch < 5; batch++) {
      const changes = Array.from({ length: 25 }, (_, i) => change("hydration_entries", `h${batch}-${i}`, iso(-1000 - i), { amountMl: 250 }));
      const r = await w.call("/sync", { token, body: { deviceId: DEVICE_A, cursor: 0, changes } });
      expect(r.status).toBe(200);
    }
    let cursor = 0; let total = 0; let pages = 0; let more = true;
    while (more) {
      const r = await w.call("/sync", { token, body: { deviceId: DEVICE_B, cursor, changes: [] } });
      total += r.json.data.changes.length; cursor = r.json.data.cursor; more = r.json.data.hasMore; pages++;
    }
    expect(total).toBe(125);
    expect(pages).toBeGreaterThan(1);
  });

  it("never lets one user read, overwrite or delete another user's records", async () => {
    const w = makeWorld();
    const a = await w.register();
    const b = await w.register();
    await w.call("/sync", { token: a.token, body: { deviceId: DEVICE_A, cursor: 0, changes: [change("profile", "profile", iso(-1000), { name: "Alice-secret" })] } });
    const bPull = await w.call("/sync", { token: b.token, body: { deviceId: DEVICE_B, cursor: 0, changes: [] } });
    expect(bPull.text).not.toContain("Alice-secret");
    expect(bPull.json.data.changes).toEqual([]);
    // B writing the same record id creates B's own row; Alice's is untouched.
    await w.call("/sync", { token: b.token, body: { deviceId: DEVICE_B, cursor: 0, changes: [change("profile", "profile", iso(0), { name: "Bob" })] } });
    const aPull = await w.call("/sync", { token: a.token, body: { deviceId: "device-cccccccc", cursor: 0, changes: [] } });
    expect(aPull.json.data.changes[0].data.name).toBe("Alice-secret");
    // A client-supplied user id is simply ignored.
    const spoof = await w.call("/sync", { token: b.token, body: { deviceId: DEVICE_B, cursor: 0, userId: a.userId, changes: [] } });
    expect(spoof.text).not.toContain("Alice-secret");
    expect((await w.call("/sync", { body: { deviceId: DEVICE_B, cursor: 0, changes: [] } })).status).toBe(401);
  });

  it("validates input, clamps far-future timestamps and caps request size", async () => {
    const w = makeWorld();
    const { token } = await w.register();
    const bad = await w.call("/sync", { token, body: { deviceId: DEVICE_A, cursor: 0, changes: [change("secrets", "x", iso())] } });
    expect(bad.status).toBe(400);
    expect(bad.json.error.code).toBe("VALIDATION_FAILED");
    const tooMany = await w.call("/sync", { token, body: { deviceId: DEVICE_A, cursor: 0, changes: Array.from({ length: 26 }, (_, i) => change("favorites", `f${i}`, iso())) } });
    expect(tooMany.status).toBe(400);
    const future = await w.call("/sync", { token, body: { deviceId: DEVICE_A, cursor: 0, changes: [change("profile", "profile", "2999-01-01T00:00:00.000Z")] } });
    expect(future.status).toBe(200);
    const stored = w.raw.prepare("SELECT updated_at FROM sync_records").get() as { updated_at: string };
    expect(new Date(stored.updated_at).getTime()).toBeLessThan(Date.now() + 6 * 60_000);
    const huge = await w.call("/sync", { token, rawBody: JSON.stringify({ pad: "x".repeat(600_000) }) });
    expect(huge.status).toBe(413);
    const broken = await w.call("/sync", { token, rawBody: "{not json" });
    expect(broken.status).toBe(400);
    expect(broken.json.error.code).toBe("INVALID_JSON");
  });
});

describe("account", () => {
  it("exports the caller's records and refuses deletion without confirmation", async () => {
    const w = makeWorld();
    const { token } = await w.register();
    await w.call("/sync", { token, body: { deviceId: DEVICE_A, cursor: 0, changes: [change("favorites", "off:9", iso(-1000))] } });
    const exported = await w.call("/account/export", { token });
    expect(exported.json.data.records).toHaveLength(1);
    const refused = await w.call("/account", { method: "DELETE", token, body: { confirm: "nope" } });
    expect(refused.status).toBe(400);
  });

  it("deletes the account, sessions and every synced record", async () => {
    const w = makeWorld();
    const a = await w.register();
    const other = await w.register();
    await w.call("/sync", { token: a.token, body: { deviceId: DEVICE_A, cursor: 0, changes: [change("favorites", "off:9", iso(-1000))] } });
    await w.call("/sync", { token: other.token, body: { deviceId: DEVICE_B, cursor: 0, changes: [change("favorites", "off:7", iso(-1000))] } });
    const del = await w.call("/account", { method: "DELETE", token: a.token, body: { confirm: "DELETE" } });
    expect(del.status).toBe(200);
    expect((await w.call("/auth/me", { token: a.token })).status).toBe(401);
    expect((await w.call("/auth/login", { body: { accountKey: a.accountKey } })).status).toBe(401);
    expect(w.raw.prepare("SELECT COUNT(*) c FROM sync_records WHERE user_id=?").get(a.userId)).toEqual({ c: 0 });
    expect(w.raw.prepare("SELECT COUNT(*) c FROM sync_records WHERE user_id=?").get(other.userId)).toEqual({ c: 1 });
  });
});

describe("platform behaviour", () => {
  it("returns JSON errors without stack traces and sets security headers", async () => {
    const w = makeWorld();
    const r = await w.call("/does-not-exist");
    expect(r.status).toBe(404);
    expect(r.json.error.code).toBe("NOT_FOUND");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.text).not.toMatch(/at \w+ \(|node_modules/);
  });
});
