import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ThemePreference = "system" | "light" | "dark";
export type UnitPreference = "metric" | "imperial";

type SettingsState = {
  theme: ThemePreference;
  units: UnitPreference;
  onboardingComplete: boolean;
  setTheme: (theme: ThemePreference) => void;
  setUnits: (units: UnitPreference) => void;
  finishOnboarding: () => void;
  reset: () => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      units: "metric",
      onboardingComplete: false,
      setTheme: (theme) => set({ theme }),
      setUnits: (units) => set({ units }),
      finishOnboarding: () => set({ onboardingComplete: true }),
      reset: () => set({ theme: "system", units: "metric", onboardingComplete: false }),
    }),
    { name: "nutriscan-settings", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
