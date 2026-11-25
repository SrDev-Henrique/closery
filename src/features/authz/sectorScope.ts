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

// O escopo de setor de quem lê, como dado (e não como condição de SQL): o
// domínio o refaz a cada consulta, nunca confia no que a tela decidiu.
export type SectorScope =
  | { kind: "all" }
  | { kind: "sector"; sectorId: string }
  | { kind: "nothing" };

/**
 * Admin: `requested` nulo = todos os setores; senão o pedido. Operador: o
 * próprio setor, o pedido é ignorado; sem setor (estado que `toAuthz` já
 * recusa) não enxerga nada.
 */
export function sectorScopeOf(
  authz: Authz,
  requested: string | null,
): SectorScope {
  if (isAdmin(authz)) {
    return requested === null
      ? { kind: "all" }
      : { kind: "sector", sectorId: requested };
  }
  return authz.sectorId === null
    ? { kind: "nothing" }
    : { kind: "sector", sectorId: authz.sectorId };
}
