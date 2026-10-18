import type { QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";
import { syncService } from "@/services/sync";
import { useAccountStore } from "@/stores/account";

const MIN_GAP_MS = 30_000;
const INTERVAL_MS = 120_000;

/** Syncs when signed in: at launch, when returning to the app, on backgrounding, and every 2 minutes. */
export function useAutoSync(queryClient: QueryClient) {
  const userId = useAccountStore((s) => s.userId);
  useEffect(() => {
    void useAccountStore.getState().hydrate();
  }, []);
  useEffect(() => {
    if (!userId) return;
    let last = 0;
    const run = async (force = false) => {
      if (!force && Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      const result = await syncService.sync();
      if (result.ok && result.data.pulled > 0) void queryClient.invalidateQueries();
    };
    void run(true);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void run();
      if (state === "background") void run(true);
    });
    const timer = setInterval(() => { if (AppState.currentState === "active") void run(); }, INTERVAL_MS);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [userId, queryClient]);
}
