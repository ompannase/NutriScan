import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

type Params = unknown[];

class Statement {
  constructor(private readonly db: DatabaseSync, readonly sql: string, private readonly params: Params = []) {}
  bind(...params: Params) { return new Statement(this.db, this.sql, params); }
  private isRead() { return /^\s*(select|with)\b/i.test(this.sql) || /\breturning\b/i.test(this.sql); }
  exec() {
    const params = this.params.map((p) => (p === undefined ? null : p)) as never[];
    const stmt = this.db.prepare(this.sql);
    if (this.isRead()) {
      const results = stmt.all(...params).map((row) => ({ ...row }));
      return { success: true, results, meta: { changes: 0, rows_read: results.length } };
    }
    const info = stmt.run(...params);
    return { success: true, results: [], meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } };
  }
  async first(column?: string) {
    const row = (this.exec().results[0] ?? null) as Record<string, unknown> | null;
    return column ? (row ? row[column] : null) : row;
  }
  async all() { return this.exec(); }
  async run() { return this.exec(); }
}

class D1Shim {
  constructor(readonly raw: DatabaseSync) {}
  prepare(sql: string) { return new Statement(this.raw, sql); }
  async batch(statements: Statement[]) {
    this.raw.exec("BEGIN");
    try {
      const out = statements.map((s) => s.exec());
      this.raw.exec("COMMIT");
      return out;
    } catch (error) {
      this.raw.exec("ROLLBACK");
      throw error;
    }
  }
}

/** In-memory D1 stand-in backed by Node's SQLite, running the real migrations. */
export function createD1() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  const dir = join(import.meta.dirname, "..", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(dir, file), "utf8"));
  }
  const shim = new D1Shim(db);
  return { d1: shim as unknown as D1Database, raw: db };
}
