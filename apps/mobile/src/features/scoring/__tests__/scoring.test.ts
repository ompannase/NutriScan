import { scoreProduct } from "..";

describe("scoreProduct", () => {
  it("returns insufficient data without fake precision", () => {
    expect(scoreProduct({ proteinG: 12 }).category).toBe("Insufficient data");
    expect(scoreProduct({ proteinG: 12 }).score).toBeUndefined();
  });

  it("clamps scores and returns a versioned breakdown", () => {
    const result = scoreProduct({
      energyKcal: 450, sugarsG: 40, saturatedFatG: 18,
      sodiumMg: 1400, fibreG: 0, proteinG: 2,
    }, 4);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.breakdown.length).toBeGreaterThan(0);
    expect(result.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("increases sugar emphasis once for diabetes", () => {
    const nutrition = { energyKcal: 300, sugarsG: 12, saturatedFatG: 2, sodiumMg: 200, fibreG: 3, proteinG: 5 };
    expect(scoreProduct(nutrition, 2, ["type2-diabetes"]).score!).toBeLessThan(scoreProduct(nutrition, 2).score!);
  });
});
