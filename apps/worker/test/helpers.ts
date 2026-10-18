import { createApp } from "../src/app";
import type { Env } from "../src/env";
import { createD1 } from "./d1";

let counter = 0;
export function makeWorld(extra: Partial<Env> = {}) {
  const { d1, raw } = createD1();
  const env = { DB: d1, ...extra } as Env;
  const app = createApp();
  const ip = `10.0.${Math.floor(++counter / 250)}.${counter % 250}`;
  async function call(path: string, init: { method?: string; token?: string; body?: unknown; rawBody?: string; ip?: string; headers?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { "CF-Connecting-IP": init.ip ?? ip, ...(init.headers ?? {}) };
    if (init.token) headers.Authorization = `Bearer ${init.token}`;
    let body: string | undefined;
    if (init.rawBody !== undefined) body = init.rawBody;
    else if (init.body !== undefined) { body = JSON.stringify(init.body); headers["Content-Type"] = "application/json"; }
    const response = await app.fetch(new Request(`https://api.test/api/v1${path}`, { method: init.method ?? (body ? "POST" : "GET"), headers, body }), env);
    const text = await response.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* non-json */ }
    return { status: response.status, json, text, headers: response.headers };
  }
  async function register(ipOverride?: string) {
    const r = await call("/auth/register", { method: "POST", ip: ipOverride });
    return { ...r.json.data as { userId: string; accountKey: string; token: string; expiresAt: string }, status: r.status };
  }
  return { call, register, env, raw, d1 };
}

export const change = (collection: string, id: string, updatedAt: string, data: Record<string, unknown> = { v: 1 }, op: "upsert" | "delete" = "upsert") =>
  ({ collection, id, op, updatedAt, ...(op === "upsert" ? { data } : {}) });
