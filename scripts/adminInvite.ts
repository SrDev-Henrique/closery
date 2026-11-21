import { loadEnvConfig } from "@next/env";

import { createDb, createPool } from "@/db/client";
import { resolveDatabaseUrls } from "@/db/databaseUrl";
import {
  createAdminInvite,
  formatAdminInviteOutput,
  parseAdminInviteArgs,
} from "@/features/invites/adminInvite";

// Roda fora do Next: carrega .env/.env.local com as mesmas regras e importa só
// módulos sem `server-only`.
async function main(): Promise<void> {
  loadEnvConfig(process.cwd());

  const { label } = parseAdminInviteArgs(process.argv.slice(2));

  const baseURL = process.env.BETTER_AUTH_URL;
  if (!baseURL) {
    throw new Error(
      "BETTER_AUTH_URL ausente: adicione BETTER_AUTH_URL=http://localhost:3000 ao .env.local (em produção, a URL pública do app).",
    );
  }

  const connectionString = resolveDatabaseUrls(process.env).runtime;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL ausente: copie .env.example para .env.local e preencha com as connection strings do Neon.",
    );
  }

  const pool = createPool(connectionString);
  try {
    const result = await createAdminInvite(createDb(pool), {
      label,
      baseURL,
      now: new Date(),
    });
    console.log(formatAdminInviteOutput(result));
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Erro: ${message}`);
  process.exitCode = 1;
});
