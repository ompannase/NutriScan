import { defineConfig } from "vitest/config";

export default defineConfig({
  // Tests import the mobile sync engine across packages; don't let esbuild look up the
  // mobile app's tsconfig (it extends Expo's base config, which the worker doesn't install).
  esbuild: { tsconfigRaw: "{}" },
  test: { environment: "node", include: ["test/**/*.test.ts"], testTimeout: 20000 },
});
