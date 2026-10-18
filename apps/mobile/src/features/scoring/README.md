# NutriScan scoring

Versioned by `SCORING_VERSION`, this local engine starts at 100, applies
nutrient/processing deductions and modest fibre/protein bonuses, then clamps to
0–100. Diabetes increases only the sugar deduction; hypertension increases only
the sodium deduction. Dietary preferences, allergies, and celiac status produce
separate flags and never manipulate the score.

The comments in `config.ts` identify source context. All per-100g thresholds and
weights are **project heuristics**, not medical standards. WHO daily guidance
informed the selected nutrients, but daily recommendations are not presented as
product thresholds. Fewer than three critical fields yields “Insufficient data”
instead of false precision. Sodium/salt conversion uses the standard approximation
`salt = sodium × 2.5` after matching units.
