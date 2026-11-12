import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  optimizeDeps: { exclude: ["@duckdb/duckdb-wasm"] },
  worker: { format: "es" },
  build: { chunkSizeWarningLimit: 4000 },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
