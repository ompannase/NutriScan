import type { Condition, Nutrition } from "@/types/models";
import { scoringConfig, SCORING_VERSION } from "./config";

export type ScoreBreakdown = {
  key: string;
  label: string;
  points: number;
  reason: string;
};
export type ScoreResult = {
  score?: number;
  category: "Favorable" | "Moderate" | "Needs Attention" | "Insufficient data";
  breakdown: ScoreBreakdown[];
  confidence: "high" | "medium" | "low";
  completeness: number;
  version: string;
};

const penalty = (value: number, good: number, high: number, weight: number) =>
  value <= good ? 0 : Math.min(weight, ((value - good) / (high - good)) * weight);

export function scoreProduct(
  nutrition: Nutrition,
  novaGroup?: 1 | 2 | 3 | 4,
  conditions: Condition[] = [],
): ScoreResult {
  const critical: (keyof Nutrition)[] = ["energyKcal", "sugarsG", "saturatedFatG", "sodiumMg"];
  const available = critical.filter((key) => nutrition[key] !== undefined).length;
  const all: (keyof Nutrition)[] = [...critical, "proteinG", "fibreG"];
  const completeness = Math.round((all.filter((key) => nutrition[key] !== undefined).length / all.length) * 100);
  if (available < 3) {
    return { category: "Insufficient data", breakdown: [], confidence: "low", completeness, version: SCORING_VERSION };
  }

  const breakdown: ScoreBreakdown[] = [];
  let score = 78;
  const add = (key: string, label: string, points: number, reason: string) => {
    if (Math.abs(points) >= 0.1) {
      breakdown.push({ key, label, points: Math.round(points * 10) / 10, reason });
      score += points;
    }
  };
  if (nutrition.sugarsG !== undefined) {
    const multiplier = conditions.includes("type2-diabetes") ? 1.35 : 1;
    add("sugar", "Sugars", -penalty(nutrition.sugarsG, scoringConfig.sugar.goodMax, scoringConfig.sugar.highMin, scoringConfig.sugar.weight) * multiplier, "Higher sugars reduce the score.");
  }
  if (nutrition.saturatedFatG !== undefined)
    add("sat-fat", "Saturated fat", -penalty(nutrition.saturatedFatG, scoringConfig.saturatedFat.goodMax, scoringConfig.saturatedFat.highMin, scoringConfig.saturatedFat.weight), "Higher saturated fat reduces the score.");
  if (nutrition.sodiumMg !== undefined) {
    const multiplier = conditions.includes("hypertension") ? 1.35 : 1;
    add("sodium", "Sodium", -penalty(nutrition.sodiumMg, scoringConfig.sodiumMg.goodMax, scoringConfig.sodiumMg.highMin, scoringConfig.sodiumMg.weight) * multiplier, "Higher sodium reduces the score.");
  }
  if (nutrition.fibreG !== undefined)
    add("fibre", "Fibre", Math.min(scoringConfig.fibre.weight, (nutrition.fibreG / scoringConfig.fibre.goodMin) * scoringConfig.fibre.weight), "Fibre adds to the score.");
  if (nutrition.proteinG !== undefined)
    add("protein", "Protein", Math.min(scoringConfig.protein.weight, (nutrition.proteinG / scoringConfig.protein.goodMin) * scoringConfig.protein.weight), "Protein adds to the score.");
  if (novaGroup === 4) add("nova", "Processing", -scoringConfig.processing.nova4Penalty, "NOVA 4 products receive a processing deduction.");
  if (novaGroup === 3) add("nova", "Processing", -scoringConfig.processing.nova3Penalty, "NOVA 3 products receive a processing deduction.");

  const rounded = Math.round(Math.max(0, Math.min(100, score)));
  const category = rounded >= scoringConfig.categories.favorableMin
    ? "Favorable"
    : rounded >= scoringConfig.categories.moderateMin ? "Moderate" : "Needs Attention";
  return {
    score: rounded,
    category,
    breakdown,
    completeness,
    confidence: completeness >= 84 ? "high" : "medium",
    version: SCORING_VERSION,
  };
}
