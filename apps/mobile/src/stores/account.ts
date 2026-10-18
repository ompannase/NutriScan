import { create } from "zustand";
import { loadSession } from "@/services/session";

type AccountState = {
  hydrated: boolean;
  userId?: string;
  hydrate: () => Promise<void>;
  setUser: (userId?: string) => void;
};

export const useAccountStore = create<AccountState>()((set) => ({
  hydrated: false,
  userId: undefined,
  hydrate: async () => { const session = await loadSession(); set({ hydrated: true, userId: session?.userId }); },
  setUser: (userId) => set({ userId }),
}));
