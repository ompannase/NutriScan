import * as SQLite from "expo-sqlite";
import { resetSyncState } from "@/features/sync/engine";
import { migrations } from "./schema";

let database: Promise<SQLite.SQLiteDatabase> | undefined;

export async function getDatabase() {
  if (!database) {
    database = SQLite.openDatabaseAsync("nutriscan.db").then(async (db) => {
      const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
      for (let version = row?.user_version ?? 0; version < migrations.length; version += 1) {
        await db.execAsync(migrations[version]!);
      }
      return db;
    });
  }
  return database;
}

export async function deleteAllLocalData() {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const table of [
      "chat_messages", "conversations", "meal_entries", "meals", "hydration_entries",
      "daily_goals", "favorites", "score_results", "scan_history", "custom_products",
      "products", "allergies", "restrictions", "user_profile", "sync_queue",
    ]) await db.runAsync(`DELETE FROM ${table}`);
  });
  // Wiping this device must not queue deletions for the cloud copy: forget the link instead,
  // so a later sync restores the cloud data.
  await resetSyncState(db);
}

export async function exportLocalData(): Promise<Record<string, unknown[]>> {
  const db = await getDatabase();
  const output: Record<string, unknown[]> = {};
  for (const table of [
    "user_profile", "products", "custom_products", "scan_history", "score_results",
    "favorites", "meals", "meal_entries", "hydration_entries", "daily_goals",
    "conversations", "chat_messages", "sync_queue",
  ]) output[table] = await db.getAllAsync(`SELECT * FROM ${table}`);
  return output;
}
