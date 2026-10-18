import { getDatabase } from "@/database";
import { pendingCount, runSync, type SyncDb, type SyncReport } from "@/features/sync/engine";
import { useAccountStore } from "@/stores/account";
import { useSyncStore } from "@/stores/sync";
import { friendlyError } from "@/utils/errors";
import { apiRequest } from "./api";
import type { ServiceResult, SyncService } from "./contracts";
import { failure } from "./result";
import { clearSession, loadSession } from "./session";
import type { SyncRequest, SyncResponse } from "@/features/sync/engine";
import type { SQLiteBindValue, SQLiteDatabase } from "expo-sqlite";

export function asSyncDb(db: SQLiteDatabase): SyncDb {
  return {
    getAllAsync: <T,>(sql: string, ...p: unknown[]) => db.getAllAsync<T>(sql, p as SQLiteBindValue[]),
    getFirstAsync: <T,>(sql: string, ...p: unknown[]) => db.getFirstAsync<T>(sql, p as SQLiteBindValue[]),
    runAsync: (sql, ...p) => db.runAsync(sql, p as SQLiteBindValue[]),
    withTransactionAsync: (task) => db.withTransactionAsync(task),
  };
}

let inFlight: Promise<ServiceResult<SyncReport>> | undefined;

async function perform(): Promise<ServiceResult<SyncReport>> {
  const session = await loadSession();
  if (!session) return { ok: false, code: "UNAUTHORIZED", message: "Sign in to sync your data." };
  const store = useSyncStore.getState();
  store.set({ syncing: true, lastError: undefined });
  const db = asSyncDb(await getDatabase());
  try {
    const report = await runSync(db, (req: SyncRequest) =>
      apiRequest<SyncResponse>("/sync", { method: "POST", body: req, token: session.token }));
    useSyncStore.getState().set({
      syncing: false, lastSyncedAt: new Date().toISOString(), lastConflicts: report.conflicts, pending: await pendingCount(db),
    });
    return { ok: true, data: report };
  } catch (error) {
    const result = failure(error);
    if (!result.ok && result.code === "UNAUTHORIZED") {
      await clearSession();
      useAccountStore.getState().setUser(undefined);
    }
    useSyncStore.getState().set({ syncing: false, lastError: friendlyError(error), pending: await pendingCount(db).catch(() => 0) });
    return result;
  }
}

export const syncService: SyncService = {
  sync() {
    inFlight ??= perform().finally(() => { inFlight = undefined; });
    return inFlight;
  },
};
