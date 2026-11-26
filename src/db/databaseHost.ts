import type { DatabaseUrls } from "./databaseUrl";

// Sem `server-only`: os scripts de linha de comando (admin:invite, db:hosts)
// importam este módulo fora do Next.

// Só o host: a connection string tem usuário e senha e nunca é impressa.
export function databaseHostOf(connectionString: string): string {
  try {
    const host = new URL(connectionString).hostname.toLowerCase();
    if (host !== "") return host;
  } catch {
    // cai no erro abaixo, sem repetir a string (ela tem a senha)
  }
  throw new Error("DATABASE_URL não é uma URL de conexão válida.");
}

function hostOrMarker(connectionString: string | undefined): string {
  if (connectionString === undefined) return "ausente";
  try {
    return databaseHostOf(connectionString);
  } catch {
    return "inválida";
  }
}

// Para conferir, antes da migração de produção, em qual banco o drizzle-kit
// vai escrever (`bun run db:hosts`): o drizzle-kit não tem trava de host.
export function formatDatabaseHosts(urls: DatabaseUrls): string {
  return [
    `Banco da aplicação (runtime): ${hostOrMarker(urls.runtime)}`,
    `Banco das migrações (drizzle-kit): ${hostOrMarker(urls.migration)}`,
  ].join("\n");
}
