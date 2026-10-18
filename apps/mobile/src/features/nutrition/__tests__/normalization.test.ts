import { kjToKcal, normalizeField, per100, saltToSodiumMg, sodiumToSaltG } from "../normalization";

describe("nutrition normalization", () => {
  it("converts energy and sodium/salt units", () => {
    expect(kjToKcal(418.4)).toBeCloseTo(100);
    expect(sodiumToSaltG(400)).toBeCloseTo(1);
    expect(saltToSodiumMg(1)).toBeCloseTo(400);
  });
  it("normalizes per-100g and comma decimals", () => {
    expect(per100(12, 30)).toBe(40);
    expect(normalizeField("1,5")).toEqual({ value: 1.5, state: "valid" });
  });
  it("keeps missing and invalid distinct from zero", () => {
    expect(normalizeField(undefined)).toEqual({ state: "missing" });
    expect(normalizeField(-1)).toEqual({ state: "invalid" });
    expect(normalizeField(0)).toEqual({ value: 0, state: "valid" });
  });
});
