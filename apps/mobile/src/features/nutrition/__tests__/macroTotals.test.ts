import { scaleNutrition, sumNutrition } from "../normalization";

describe("macro totals", () => {
  it("scales portions and sums known fields", () => {
    const half = scaleNutrition({ energyKcal: 200, proteinG: 10, carbsG: 30 }, 50);
    expect(half).toMatchObject({ energyKcal: 100, proteinG: 5, carbsG: 15 });
    expect(sumNutrition([half, { energyKcal: 50, fatG: 3 }])).toMatchObject({
      energyKcal: 150, proteinG: 5, carbsG: 15, fatG: 3,
    });
  });
  it("does not turn wholly missing fields into zero", () => {
    expect(sumNutrition([{ proteinG: 2 }]).sugarsG).toBeUndefined();
  });
});
