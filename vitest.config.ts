import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // next-auth подключает next/server без расширения — даём vitest обработать его сам
    server: { deps: { inline: [/next-auth/, /@auth\//] } },
    alias: { "next/server": "next/server.js" },
  },
});
