module.exports = {
  preset: "jest-expo",
  testMatch: ["**/__tests__/**/*.test.ts"],
  collectCoverageFrom: ["src/features/{scoring,scanner,nutrition}/**/*.ts"],
};
