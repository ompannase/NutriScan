import * as SecureStore from "expo-secure-store";

/** The session token is a credential, so it lives in the OS keystore, never in AsyncStorage. */
const KEY = "nutriscan.session.v1";
export type Session = { token: string; userId: string; expiresAt: string };

let cache: Session | null | undefined;

export async function loadSession(): Promise<Session | null> {
  if (cache !== undefined) return cache;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    const parsed = raw ? (JSON.parse(raw) as Session) : null;
    cache = parsed && new Date(parsed.expiresAt).getTime() > Date.now() ? parsed : null;
  } catch {
    cache = null;
  }
  return cache;
}
export async function saveSession(session: Session) {
  cache = session;
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}
export async function clearSession() {
  cache = null;
  try { await SecureStore.deleteItemAsync(KEY); } catch { /* already gone */ }
}
