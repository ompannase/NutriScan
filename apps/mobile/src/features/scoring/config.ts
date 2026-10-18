export const SCORING_VERSION = "1.0.0";

export const scoringConfig = {
  // WHO guideline: free sugars below 10% energy; gram bands are a project heuristic for comparison.
  sugar: { goodMax: 5, highMin: 15, weight: 18, provenance: "project heuristic" },
  // WHO recommends saturated fat below 10% energy; per-100g bands are a project heuristic.
  saturatedFat: { goodMax: 1.5, highMin: 5, weight: 16, provenance: "project heuristic" },
  // WHO sodium guidance is <2g/day; per-100g bands are a project heuristic.
  sodiumMg: { goodMax: 120, highMin: 600, weight: 18, provenance: "project heuristic" },
  // Fibre and protein bands support relative comparison and are project heuristics.
  fibre: { goodMin: 6, weight: 12, provenance: "project heuristic" },
  protein: { goodMin: 10, weight: 8, provenance: "project heuristic" },
  processing: { nova4Penalty: 14, nova3Penalty: 6, provenance: "project heuristic" },
  categories: { favorableMin: 75, moderateMin: 50, provenance: "project heuristic" },
} as const;
