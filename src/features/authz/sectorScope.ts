import { eq, type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { type Authz, isAdmin } from "./authz";

// Condição de escopo por setor para um WHERE (passe a coluna `sector_id` da
// tabela consultada). Admin: sem condição. Operador: só o próprio setor.
// Operador sem setor (estado que `toAuthz` já recusa) não enxerga nada.
export function scopeToSector(authz: Authz, column: PgColumn): SQL | undefined {
  if (isAdmin(authz)) return undefined;
  if (authz.sectorId === null) return sql`false`;
  return eq(column, authz.sectorId);
}
