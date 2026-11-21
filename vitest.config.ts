import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Substitui o pacote "server-only" (que lança fora do Next). Caminho absoluto
// via fileURLToPath: URL.pathname gera "/C:/..." no Windows.
const empty = fileURLToPath(new URL("./test/empty.ts", import.meta.url));

export default defineConfig({
  // Resolve "@/*" do tsconfig.json nativamente (Vite 8); sem plugin.
  resolve: { tsconfigPaths: true },
  test: {
    exclude: ["e2e/**", ".claude/**", "node_modules/**"],
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts", "test/**/*.test.ts"],
          globalSetup: ["./test/global-setup.ts"],
          alias: { "server-only": empty },
          testTimeout: 15_000,
          hookTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./test/setup-dom.ts"],
          globalSetup: ["./test/global-setup.ts"],
          testTimeout: 15_000,
          hookTimeout: 30_000,
          alias: { "server-only": empty },
        },
      },
    ],
  },
});
