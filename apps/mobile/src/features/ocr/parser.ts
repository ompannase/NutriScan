import { normalizeField } from "@/features/nutrition/normalization";
import type { Nutrition } from "@/types/models";

export type ParsedLabel = {
  ingredients?: { value: string; confidence: number; uncertain: boolean };
  allergens?: { value: string; confidence: number; uncertain: boolean };
  servingSize?: { value: string; confidence: number; uncertain: boolean };
  nutrition: Nutrition;
};

const numberAfter = (text: string, pattern: RegExp) => {
  const match = text.match(pattern);
  if (!match?.[1]) return undefined;
  return normalizeField(match[1].replace(/[oO]/g, "0").replace(/[lI]/g, "1")).value;
};

export function parseLabel(text: string): ParsedLabel {
  const ingredients = text.match(/ingredients?\s*[:\-]\s*([^\n]+)/i)?.[1]?.trim();
  const allergens = text.match(/(?:allergens?|contains)\s*[:\-]\s*([^\n]+)/i)?.[1]?.trim();
  const serving = text.match(/serving size\s*[:\-]?\s*([^\n]+)/i)?.[1]?.trim();
  return {
    ingredients: ingredients ? { value: ingredients, confidence: 0.75, uncertain: true } : undefined,
    allergens: allergens ? { value: allergens, confidence: 0.7, uncertain: true } : undefined,
    servingSize: serving ? { value: serving, confidence: 0.72, uncertain: true } : undefined,
    nutrition: {
      energyKcal: numberAfter(text, /energy[^\n]*?([\d.,oO]+)\s*kcal/i),
      proteinG: numberAfter(text, /protein[^\n]*?([\d.,oO]+)\s*g/i),
      carbsG: numberAfter(text, /carbohydrate[^\n]*?([\d.,oO]+)\s*g/i),
      sugarsG: numberAfter(text, /sugars?[^\n]*?([\d.,oO]+)\s*g/i),
      fatG: numberAfter(text, /(?:total\s+)?fat[^\n]*?([\d.,oO]+)\s*g/i),
      saturatedFatG: numberAfter(text, /saturat(?:ed|es)[^\n]*?([\d.,oO]+)\s*g/i),
      fibreG: numberAfter(text, /fib(?:re|er)[^\n]*?([\d.,oO]+)\s*g/i),
      sodiumMg: numberAfter(text, /sodium[^\n]*?([\d.,oO]+)\s*mg/i),
    },
  };
}
