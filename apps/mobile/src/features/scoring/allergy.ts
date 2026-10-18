export type AllergyMatch = {
  allergen: string;
  kind: "confirmed" | "uncertain" | "cross-contamination";
  matchedTerm: string;
};

const terms: Record<string, string[]> = {
  gluten: ["wheat", "barley", "rye", "maida", "semolina", "sooji"],
  milk: ["milk", "casein", "whey", "ghee", "paneer"],
  peanut: ["peanut", "groundnut", "moongphali"],
  "tree nuts": ["almond", "cashew", "kaju", "pistachio", "walnut"],
  soy: ["soy", "soya", "soybean"],
  chickpea: ["chickpea", "gram flour", "besan"],
};

export function matchAllergies(
  ingredients: string,
  allergies: string[],
  uncertain = false,
): AllergyMatch[] {
  const lower = ingredients.toLowerCase();
  return allergies.flatMap((allergen) => {
    const matchedTerm = (terms[allergen.toLowerCase()] ?? [allergen.toLowerCase()]).find((term) => lower.includes(term));
    if (!matchedTerm) return [];
    const mayContain = new RegExp(`may contain[^.]*${matchedTerm}`, "i").test(lower);
    return [{
      allergen,
      matchedTerm,
      kind: mayContain ? "cross-contamination" : uncertain ? "uncertain" : "confirmed",
    }];
  });
}
