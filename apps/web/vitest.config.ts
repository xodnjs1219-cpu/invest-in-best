import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only`는 react-server 조건 밖에서 import 시 예외를 던지므로 테스트에서는 빈 스텁으로 대체.
      "server-only": path.resolve(__dirname, "./src/test/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["**/node_modules/**", "**/e2e/**", "**/.next/**"],
  },
});
