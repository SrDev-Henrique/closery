import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

import { resolveDatabaseUrls } from "./src/db/databaseUrl";

// Carrega .env/.env.local com as mesmas regras do Next.
loadEnvConfig(process.cwd());

// Migrações usam a conexão direta (sem pooler) do Neon.
const { migration } = resolveDatabaseUrls(process.env);

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: migration ?? "" },
  strict: true,
  verbose: true,
});
