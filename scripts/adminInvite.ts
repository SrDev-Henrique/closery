import { loadEnvConfig } from "@next/env";

import { createDb, createPool } from "@/db/client";
import { databaseHostOf } from "@/db/databaseHost";
import { resolveDatabaseUrls } from "@/db/databaseUrl";
import {
  assertHostConfirmed,
  createAdminInvite,
  formatAdminInviteError,
  formatAdminInviteOutput,
  formatAdminInviteTarget,
  parseAdminInviteArgs,
} from "@/features/invites/adminInvite";

// Roda fora do Next: carrega .env/.env.local com as mesmas regras e importa só
// módulos sem `server-only`.
async function main(): Promise<void> {
  loadEnvConfig(process.cwd());

  const { label, confirmHost } = parseAdminInviteArgs(process.argv.slice(2));

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

  // Antes de qualquer escrita: mostra o alvo e exige a confirmação do host.
  const databaseHost = databaseHostOf(connectionString);
  console.log(formatAdminInviteTarget({ databaseHost, baseURL }));
  assertHostConfirmed(databaseHost, confirmHost);

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
  // Só a mensagem dos erros do próprio script; o erro do banco (Drizzle) traz
  // o SQL e os parâmetros, com o hash do token, e nunca vai para o terminal.
  console.error(formatAdminInviteError(error));
  process.exitCode = 1;
});
