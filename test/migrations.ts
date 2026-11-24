import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Harness dos testes de migração: aplica as migrações em ordem, para o teste
// parar antes da que está testando, inserir dados "de antes" e só então aplicar
// a migração alvo por cima (o que o db:migrate faz no Neon). Cada statement
// roda sozinho; o db:migrate roda a migração inteira numa transação.

/** Os arquivos `drizzle/*.sql`, em ordem. */
export const MIGRATIONS: readonly string[] = readdirSync("drizzle")
  .filter((file) => file.endsWith(".sql"))
  .sort();

/** `"0003"` → `"0003_fase3_passagem.sql"`; lança se não existir. */
export function migrationFile(prefix: string): string {
  const file = MIGRATIONS.find((name) => name.startsWith(prefix));
  if (!file) throw new Error(`migração ${prefix} não encontrada`);
  return file;
}

/** Os statements do arquivo, quebrados por `--> statement-breakpoint`, sem vazios. */
export function statementsOf(file: string): string[] {
  return readFileSync(`drizzle/${file}`, "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement !== "");
}

export async function applyMigration(
  client: PGlite,
  file: string,
): Promise<void> {
  for (const statement of statementsOf(file)) {
    await client.exec(statement);
  }
}

/**
 * PGlite novo, pronto, com as migrações dos prefixos aplicadas na ordem
 * (`["0000", "0001", "0002"]`). Quem chama fecha o cliente; se uma migração
 * falhar aqui, ele é fechado antes de o erro subir.
 */
export async function migratedTo(prefixes: readonly string[]): Promise<PGlite> {
  const client = new PGlite();
  try {
    await client.waitReady;
    for (const prefix of prefixes) {
      await applyMigration(client, migrationFile(prefix));
    }
  } catch (error) {
    await client.close();
    throw error;
  }
  return client;
}
