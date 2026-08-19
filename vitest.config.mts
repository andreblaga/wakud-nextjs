import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Minimal Vitest setup: node environment, no jsdom and no browser driver — the
 * suite covers pure server-side logic (lib/*.test.ts), not rendering.
 *
 * The alias mirrors tsconfig's `@/*` -> `./*` so tests import modules by the
 * same specifier the app uses.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
