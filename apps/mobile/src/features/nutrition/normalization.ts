import type { FieldState, Nutrition } from "@/types/models";

export type NormalizedField = { value?: number; state: FieldState };

export const kjToKcal = (kilojoules: number) => kilojoules / 4.184;
export const mgToG = (milligrams: number) => milligrams / 1000;
export const sodiumToSaltG = (sodiumMg: number) => mgToG(sodiumMg) * 2.5;
export const saltToSodiumMg = (saltG: number) => (saltG / 2.5) * 1000;

export function per100(value: number | undefined, basisG: number | undefined): number | undefined {
  if (value === undefined || basisG === undefined || basisG <= 0 || value < 0) return undefined;
  return (value / basisG) * 100;
}

export function normalizeField(value: unknown, state: FieldState = "valid"): NormalizedField {
  if (value === null || value === undefined || value === "") return { state: "missing" };
  const numeric = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(numeric) && numeric >= 0 ? { value: numeric, state } : { state: "invalid" };
}

export function scaleNutrition(nutrition: Nutrition, amountG: number, basisG = 100): Nutrition {
  const factor = amountG / basisG;
  return Object.fromEntries(
    Object.entries(nutrition).map(([key, value]) => [key, value === undefined ? undefined : value * factor]),
  ) as Nutrition;
}

export function sumNutrition(rows: Nutrition[]): Nutrition {
  const keys: (keyof Nutrition)[] = [
    "energyKcal", "proteinG", "carbsG", "sugarsG", "fatG",
    "saturatedFatG", "fibreG", "sodiumMg", "saltG",
  ];
  return Object.fromEntries(
    keys.map((key) => {
      const values = rows.flatMap((row) => row[key] === undefined ? [] : [row[key]]);
      return [key, values.length ? values.reduce((total, value) => total + value, 0) : undefined];
    }),
  ) as Nutrition;
}
