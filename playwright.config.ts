import { defineConfig, devices } from "@playwright/test";

import { E2E_APP_PORT, E2E_DATABASE_URL, E2E_DB_PORT } from "./e2e/db";

const APP_URL = `http://localhost:${E2E_APP_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Um único PGlite serializa tudo: testes em paralelo só se atrapalhariam.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: APP_URL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Em array os servidores sobem em ordem e cada um espera o anterior ficar
  // pronto: primeiro o banco, depois o app (o build já precisa do banco).
  webServer: [
    {
      name: "banco",
      command: "bun e2e/start-db.ts",
      // O banco fala o protocolo do Postgres, não HTTP: só dá para esperar a
      // porta TCP. (`port` consta como obsoleto na doc, mas é o único modo.)
      port: E2E_DB_PORT,
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: "pipe",
    },
    {
      name: "app",
      command: "bun run build && bun run start -p 3200",
      url: `${APP_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 300_000,
      stdout: "pipe",
      // O Next não sobrescreve variável que já existe no ambiente, então estas
      // valem mais que o .env.local (que aponta para o Neon de dev).
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        DATABASE_URL_POOLED: E2E_DATABASE_URL,
        BETTER_AUTH_URL: APP_URL,
        BETTER_AUTH_SECRET:
          "e2e-segredo-de-teste-nao-usar-em-producao-0123456789",
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        FACEBOOK_CLIENT_ID: "",
        FACEBOOK_CLIENT_SECRET: "",
      },
    },
  ],
});
