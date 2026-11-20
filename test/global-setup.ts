import { mkdirSync, readdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const MIGRATIONS_FOLDER = "./drizzle";
export const DUMP_PATH = "node_modules/.cache/closery-test/migrated.tar";

// Migra ./drizzle uma única vez por execução e grava o dump do banco pronto.
// Cada arquivo de teste carrega o dump (~1,4 s) em vez de migrar do zero
// (3–6 s). O dump é regenerado sempre, então nunca serve schema velho.
export default async function setup() {
  const hasMigrations = readdirSync(MIGRATIONS_FOLDER).some((file) =>
    file.endsWith(".sql"),
  );
  if (!hasMigrations) {
    throw new Error(
      `Nenhuma migração .sql em ${MIGRATIONS_FOLDER}: rode "bun run db:generate" antes de "bun run test".`,
    );
  }

  const client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
  const dump = await client.dumpDataDir("none");
  await client.close();

  mkdirSync(dirname(DUMP_PATH), { recursive: true });
  await writeFile(DUMP_PATH, Buffer.from(await dump.arrayBuffer()));
}
