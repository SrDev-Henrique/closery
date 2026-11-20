import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { resolveDatabaseUrls } from "./databaseUrl";
import * as schema from "./schema";

const { runtime: connectionString } = resolveDatabaseUrls(process.env);

if (!connectionString) {
  throw new Error(
    "DATABASE_URL ausente: copie .env.example para .env.local e preencha com as connection strings do Neon.",
  );
}

// Em dev, o HMR reavalia este módulo a cada edição; guardar o pool no
// globalThis evita abrir um pool novo (e vazar conexões) a cada recarga.
const globalForDb = globalThis as unknown as { closeryPool?: Pool };

function createPool(url: string): Pool {
  // enableChannelBinding: o pg ignora o `channel_binding=require` da URL; esta
  // opção é que liga o SCRAM-SHA-256-PLUS que o Neon oferece.
  const pool = new Pool({
    connectionString: url,
    max: 10,
    enableChannelBinding: true,
  });
  // Vercel Fluid compute: libera conexões ociosas antes de a função suspender.
  // Fora da Vercel é inofensivo.
  attachDatabasePool(pool);
  return pool;
}

const pool = globalForDb.closeryPool ?? createPool(connectionString);

if (process.env.NODE_ENV !== "production") {
  globalForDb.closeryPool = pool;
}

// node-postgres + Pool (D18): suporta db.transaction() interativa, exigida por
// entregar, corrigir e mudar status. Ver .context/library-docs.md §5.
export const db = drizzle({ client: pool, schema });
