import "server-only";

import { type SQL, sql } from "drizzle-orm";

import type { SectorScope } from "@/features/authz/sectorScope";
import { endsLocalSql } from "@/features/handovers/history";

// Fragmentos das consultas de passagem do dashboard. Aliases fixos: "h"
// (handover), "hi" (handover_item), "s" (shift), "sec" (sector).

// Setor ativo + escopo. O escopo "nothing" nunca chega aqui: quem chama
// responde vazio antes de montar a consulta.
export function handoverScopeSql(
  scope: Exclude<SectorScope, { kind: "nothing" }>,
): SQL {
  const wanted =
    scope.kind === "all" ? sql`true` : sql`h.sector_id = ${scope.sectorId}`;
  return sql`(sec.active and ${wanted})`;
}

// Passagem entregue: entregue ou confirmada.
export const DELIVERED_HANDOVER_SQL: SQL = sql`h.status in ('delivered', 'confirmed')`;

// Ordem cronológica real: dia, fim do turno, entrega, id (do mais recente).
export function chronologyOrderSql(): SQL {
  return sql`h.operational_date desc, ${endsLocalSql(sql`h.operational_date`)} desc, h.delivered_at desc, h.id desc`;
}
