import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type SyncState = {
  syncing: boolean;
  lastSyncedAt?: string;
  lastError?: string;
  lastConflicts: number;
  pending: number;
  set: (patch: Partial<Omit<SyncState, "set">>) => void;
};

/** Only non-sensitive status is persisted (timestamps and counts). */
export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({ syncing: false, lastConflicts: 0, pending: 0, set: (patch) => set(patch) }),
    {
      name: "nutriscan-sync-status",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ lastSyncedAt: s.lastSyncedAt, lastConflicts: s.lastConflicts }),
    },
  ),
);
