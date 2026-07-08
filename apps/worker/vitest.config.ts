import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@iib/domain": fileURLToPath(new URL("../../packages/domain/index.ts", import.meta.url)),
    },
  },
});
