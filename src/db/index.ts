import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import type { Pool } from "pg";

import { createDb, createPool } from "./client";
import { resolveDatabaseUrls } from "./databaseUrl";

const { runtime: connectionString } = resolveDatabaseUrls(process.env);

if (!connectionString) {
  throw new Error(
    "DATABASE_URL ausente: copie .env.example para .env.local e preencha com as connection strings do Neon.",
  );
}

// Em dev, o HMR reavalia este módulo a cada edição; guardar o pool no
// globalThis evita abrir um pool novo (e vazar conexões) a cada recarga.
const globalForDb = globalThis as unknown as { closeryPool?: Pool };

function createAttachedPool(url: string): Pool {
  const created = createPool(url);
  // Vercel Fluid compute: libera conexões ociosas antes de a função suspender.
  // Fora da Vercel é inofensivo.
  attachDatabasePool(created);
  return created;
}

export const pool =
  globalForDb.closeryPool ?? createAttachedPool(connectionString);

if (process.env.NODE_ENV !== "production") {
  globalForDb.closeryPool = pool;
}

export const db = createDb(pool);
