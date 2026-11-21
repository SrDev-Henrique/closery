import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type * as schema from "./schema";

export type Schema = typeof schema;

// Domínio recebe `db: Db` por parâmetro: o app passa o Pool do Neon, os testes
// passam o PGlite, e o mesmo código roda nos dois. NodePgDatabase<Schema> e
// PgliteDatabase<Schema> são atribuíveis a este tipo; a união dos dois quebra
// `.returning({ ... })` (TS2554).
export type Db = PgDatabase<PgQueryResultHKT, Schema>;
