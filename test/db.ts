import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import * as schema from "@/db/schema";
import type { Schema } from "@/db/types";

const DUMP_PATH = "node_modules/.cache/closery-test/migrated.tar";

export type TestDb = PgliteDatabase<Schema>;

// Todas as tabelas do schema "public". test/db.test.ts garante que esta lista
// bate com o banco migrado: tabela nova sem entrada aqui reprova o teste.
export const TABLES: readonly string[] = [
  "sector",
  "user",
  "session",
  "account",
  "verification",
  "passkey",
  "rate_limit",
  "invite",
  "shift",
  "item",
  "destination",
  "handover",
  "handover_item",
  "handover_correction",
  "request",
  "request_item",
  "request_status_event",
  "request_comment",
];

// O dump migrado é lido uma vez por processo de worker.
let dump: Blob | undefined;

export async function createTestDb(): Promise<{
  client: PGlite;
  db: TestDb;
}> {
  dump ??= new Blob([readFileSync(DUMP_PATH)]);
  const client = new PGlite({ loadDataDir: dump });
  const db = drizzle(client, { schema });
  await client.waitReady;
  return { client, db };
}

// Limpa os dados sem se preocupar com a ordem das FKs: em modo "replica" o
// Postgres não dispara os gatilhos de FK, então DELETE vale em qualquer ordem.
export async function resetDb(client: PGlite): Promise<void> {
  await client.exec("SET session_replication_role = replica");
  try {
    for (const table of TABLES) {
      await client.exec(`DELETE FROM "${table}"`);
    }
  } finally {
    await client.exec("SET session_replication_role = DEFAULT");
  }
}
