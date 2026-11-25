import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { poolMaxFrom } from "./poolSize";
import * as schema from "./schema";
import type { Schema } from "./types";

// Sem `server-only`: scripts (admin:invite) e o E2E também montam o cliente.

export function createPool(connectionString: string): Pool {
  // enableChannelBinding: o pg ignora o `channel_binding=require` da URL; esta
  // opção é que liga o SCRAM-SHA-256-PLUS que o Neon oferece.
  return new Pool({
    connectionString,
    max: poolMaxFrom(process.env),
    enableChannelBinding: true,
  });
}

// node-postgres + Pool (D18): suporta db.transaction() interativa, exigida por
// entregar, corrigir e mudar status. Ver .context/library-docs.md §5.
export function createDb(pool: Pool): NodePgDatabase<Schema> {
  return drizzle({ client: pool, schema });
}
