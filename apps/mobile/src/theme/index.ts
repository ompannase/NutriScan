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
  background: "#F3F8F5",
  surface: "#FFFFFF",
  elevated: "#E4EFE8",
  text: "#10201A",
  muted: "#5B6E64",
  border: "#D3E2D9",
  inverse: "#FFFFFF",
  primary: "#168A50",
  primarySoft: "#DDF3E6",
  gradA: "#2FBF7A",
  gradB: "#0E7C66",
  favorable: "#16794C",
  warning: "#9A5B00",
  danger: "#B42318",
  protein: "#E5634D",
  carbs: "#F2A93B",
  fat: "#5B8DEF",
  water: "#3AA7E8",
} as const;

export const dark = {
  background: "#0A130E",
  surface: "#13211A",
  elevated: "#1D2E25",
  text: "#EAF5EE",
  muted: "#9DB3A7",
  border: "#2A3F34",
  inverse: "#06130C",
  primary: "#4ADE80",
  primarySoft: "#1B3A2A",
  gradA: "#1E9E5F",
  gradB: "#0B5A47",
  favorable: "#62D29A",
  warning: "#F4B860",
  danger: "#FF8A80",
  protein: "#FF8A75",
  carbs: "#F7BE5E",
  fat: "#7FA6F5",
  water: "#5CBDF0",
} as const;

export type Palette = typeof light | typeof dark;

export function useTheme() {
  const system = useColorScheme();
  const preference = useSettingsStore((state) => state.theme);
  const isDark = preference === "dark" || (preference === "system" && system === "dark");
  return { colors: isDark ? dark : light, isDark, spacing, radius, type };
}
