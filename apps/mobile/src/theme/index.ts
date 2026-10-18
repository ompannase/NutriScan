import { useColorScheme } from "react-native";
import { useSettingsStore } from "@/stores/settings";

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;
export const type = {
  caption: 12,
  body: 15,
  label: 16,
  title: 22,
  display: 32,
} as const;

export const light = {
  background: "#F6F6F3",
  surface: "#FFFFFF",
  elevated: "#ECECE8",
  text: "#10110F",
  muted: "#676963",
  border: "#DADBD5",
  inverse: "#FFFFFF",
  primary: "#11120F",
  favorable: "#16794C",
  warning: "#9A5B00",
  danger: "#B42318",
} as const;

export const dark = {
  background: "#0E0F0D",
  surface: "#191A17",
  elevated: "#252622",
  text: "#F7F7F2",
  muted: "#A8AAA2",
  border: "#383A34",
  inverse: "#11120F",
  primary: "#F7F7F2",
  favorable: "#62D29A",
  warning: "#F4B860",
  danger: "#FF8A80",
} as const;

export type Palette = typeof light | typeof dark;

export function useTheme() {
  const system = useColorScheme();
  const preference = useSettingsStore((state) => state.theme);
  const isDark = preference === "dark" || (preference === "system" && system === "dark");
  return { colors: isDark ? dark : light, isDark, spacing, radius, type };
}
