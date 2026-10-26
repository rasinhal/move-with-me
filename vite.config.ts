import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative base so the built app also works from a sub-folder (e.g. GitHub Pages).
  base: "./",
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
