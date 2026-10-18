import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { Body, Button, Card } from "@/components/ui";
import { API_BASE_URL } from "@/config";
import { getDatabase } from "@/database";
import { pendingCount } from "@/features/sync/engine";
import { authService } from "@/services/auth";
import { asSyncDb, syncService } from "@/services/sync";
import { useAccountStore } from "@/stores/account";
import { useSyncStore } from "@/stores/sync";

export function AccountPanel() {
  const userId = useAccountStore((s) => s.userId);
  const { syncing, lastSyncedAt, lastError, lastConflicts, pending } = useSyncStore();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    void getDatabase().then((db) => pendingCount(asSyncDb(db))).then((count) => useSyncStore.getState().set({ pending: count }));
  }, [userId, lastSyncedAt]);

  if (!API_BASE_URL) {
    return <Card><Body>Cloud sync</Body><Body muted>Not configured. Set EXPO_PUBLIC_API_BASE_URL to your NutriScan server to enable optional sync and AI. All data stays on this device until then.</Body></Card>;
  }
  if (!userId) {
    return <Card><Body>Cloud sync</Body><Body muted>Off. Your data stays on this device. Sync is optional and uses a private account key.</Body><Button label="Set up sync" onPress={() => router.push("/account")} /></Card>;
  }

  const signOut = () => Alert.alert("Sign out?", "Your data stays on this device. Sign in again with your account key to resume syncing.", [
    { text: "Cancel", style: "cancel" },
    { text: "Sign out", onPress: () => { setBusy(true); void authService.signOut().finally(() => setBusy(false)); } },
  ]);
  const remove = () => Alert.alert("Delete account?", "This permanently deletes your cloud copy and signs you out. Data on this device is not deleted.", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Delete account", style: "destructive",
      onPress: async () => {
        setBusy(true);
        const result = await authService.deleteAccount();
        setBusy(false);
        if (!result.ok) {
          Alert.alert("Couldn't delete the account", `${result.message}\n\nNothing was deleted. You can safely try again.`, [
            { text: "Close", style: "cancel" }, { text: "Retry", onPress: remove },
          ]);
        }
      },
    },
  ]);

  return <Card>
    <Body>Cloud sync is on</Body>
    <Body muted>{syncing ? "Syncing…" : lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}` : "Not synced yet"}</Body>
    <Body muted>{pending > 0 ? `${pending} change${pending === 1 ? "" : "s"} waiting to upload` : "Everything is up to date on this device"}</Body>
    {lastConflicts > 0 ? <Body muted>{`${lastConflicts} edit${lastConflicts === 1 ? "" : "s"} lost to a newer change on another device in the last sync.`}</Body> : null}
    {lastError ? <Body>{`Last sync failed: ${lastError}`}</Body> : null}
    <Button label={syncing ? "Syncing…" : "Sync now"} disabled={syncing || busy} onPress={() => void syncService.sync()} />
    <Button label="Sign out" variant="secondary" disabled={busy} onPress={signOut} />
    <Button label="Delete account and cloud data" variant="danger" disabled={busy} onPress={remove} />
  </Card>;
}
