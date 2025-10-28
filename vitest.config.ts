import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["packages/**/tests/**/*.test.ts"],
    watchExclude: ["**/node_modules/**", "**/dist/**"],
    passWithNoTests: true,
    coverage: {
      enabled: false,
      reporter: ["text", "lcov"]
    }
  }
});
