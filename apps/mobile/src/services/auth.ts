import { getDatabase } from "@/database";
import { resetSyncState, seedOutbox } from "@/features/sync/engine";
import { useAccountStore } from "@/stores/account";
import { useSyncStore } from "@/stores/sync";
import { apiRequest, ApiRequestError } from "./api";
import type { AuthService } from "./contracts";
import { failure } from "./result";
import { clearSession, loadSession, saveSession } from "./session";
import { asSyncDb, syncService } from "./sync";

type SessionResponse = { userId: string; token: string; expiresAt: string };

async function startSession(response: SessionResponse) {
  await saveSession({ token: response.token, userId: response.userId, expiresAt: response.expiresAt });
  useAccountStore.getState().setUser(response.userId);
  // Everything already stored on this device joins the account (merged by newest edit).
  await seedOutbox(asSyncDb(await getDatabase()));
  void syncService.sync();
}

async function forgetLink() {
  await clearSession();
  useAccountStore.getState().setUser(undefined);
  await resetSyncState(asSyncDb(await getDatabase()));
  useSyncStore.getState().set({ lastSyncedAt: undefined, lastError: undefined, lastConflicts: 0, pending: 0 });
}

export const authService: AuthService = {
  async register() {
    try {
      const response = await apiRequest<SessionResponse & { accountKey: string }>("/auth/register", { method: "POST", body: {} });
      await startSession(response);
      return { ok: true, data: { accountKey: response.accountKey } };
    } catch (error) { return failure(error); }
  },
  async signIn(accountKey) {
    try {
      await startSession(await apiRequest<SessionResponse>("/auth/login", { body: { accountKey } }));
      return { ok: true, data: null };
    } catch (error) {
      if (error instanceof ApiRequestError && error.serverCode === "INVALID_ACCOUNT_KEY") {
        return { ok: false, code: "INVALID_KEY", message: "That account key wasn't recognised. Check it and try again." };
      }
      return failure(error);
    }
  },
  async signOut() {
    const session = await loadSession();
    if (session) {
      // Best effort: the local session is dropped even if the server can't be reached.
      await apiRequest("/auth/logout", { method: "POST", body: {}, token: session.token }).catch(() => undefined);
    }
    await forgetLink();
    return { ok: true, data: null };
  },
  async deleteAccount() {
    const session = await loadSession();
    if (!session) return { ok: false, code: "UNAUTHORIZED", message: "You're not signed in." };
    try {
      await apiRequest("/account", { method: "DELETE", body: { confirm: "DELETE" }, token: session.token });
    } catch (error) {
      return failure(error); // nothing was changed locally, so retrying is safe
    }
    await forgetLink();
    return { ok: true, data: null };
  },
};
