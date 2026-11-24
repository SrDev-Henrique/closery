import "server-only";

import { and, eq, isNull, type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { request } from "@/db/schema/requests";
import { type Authz, isAdmin } from "@/features/authz/authz";
import { scopeToSector } from "@/features/authz/sectorScope";
import { SAO_PAULO_TIME_ZONE } from "@/features/handovers/saoPaulo";

import { DESTINATION_OTHER, STALE_AFTER_DAYS } from "./limits";
import type { RequestFilters } from "./requestFilters";
import { SEARCH_FOLD_FROM, SEARCH_FOLD_TO, searchPattern } from "./search";

// Fragmentos de SQL das leituras de solicitação. As colunas de tempo e status
// são parâmetros OBRIGATÓRIOS: a seção "na entrega" da passagem calcula sobre
// o evento daquele instante, e um padrão silencioso (request.*) calcularia
// sobre o status de agora.
export function daysInStatusSql(
  now: Date,
  changedAt: SQL | PgColumn,
): SQL<number> {
  return sql<number>`greatest(0, floor(extract(epoch from (${now.toISOString()}::timestamptz - ${changedAt})) / 86400))::int`;
}

export function staleSql(
  now: Date,
  status: SQL | PgColumn,
  changedAt: SQL | PgColumn,
): SQL<boolean> {
  return sql<boolean>`(${status} in ('requested', 'in_transit') and ${now.toISOString()}::timestamptz - ${changedAt} > make_interval(days => ${sql.raw(String(STALE_AFTER_DAYS))}))`;
}

// Espelho SQL de foldForSearch (search.ts): translate(lower(x), FROM, TO).
export function foldSql(column: SQL | PgColumn): SQL<string> {
  return sql<string>`translate(lower(${column}), ${SEARCH_FOLD_FROM}, ${SEARCH_FOLD_TO})`;
}

// `pattern` vem de searchPattern (já dobrado e com \, % e _ escapados); o
// escape padrão do ILIKE é a barra invertida. Pede o JOIN com `destination`.
export function searchSql(pattern: string): SQL {
  return sql`(${foldSql(sql`"request"."description"`)} ilike ${pattern} or ${foldSql(sql`"destination"."name"`)} ilike ${pattern} or ${foldSql(sql`"request"."destination_other"`)} ilike ${pattern})`;
}

// Dia de São Paulo em que a solicitação foi criada, entre duas datas "YYYY-MM-DD".
export function createdBetweenSql(from: string, to: string): SQL {
  return sql`(("request"."created_at" at time zone ${SAO_PAULO_TIME_ZONE})::date between ${from}::date and ${to}::date)`;
}

// Escopo de setor (operador preso ao próprio; o `sectorId` dele é ignorado) +
// setor escolhido (admin) + setor ativo. Coluna externa por extenso na
// subconsulta correlata (library-docs §5).
export function requestScopeSql(actor: Authz, sectorId: string | null): SQL {
  const condition = and(
    scopeToSector(actor, request.sectorId),
    isAdmin(actor) && sectorId !== null
      ? eq(request.sectorId, sectorId)
      : undefined,
    sql`exists (select 1 from "sector" where "sector"."id" = "request"."sector_id" and "sector"."active")`,
  );
  return condition ?? sql`true`;
}

// Destino, período, criador e busca. Pede o JOIN com `destination`.
export function requestFilterSql(filters: RequestFilters): SQL | undefined {
  const pattern = searchPattern(filters.search);
  return and(
    filters.destination === null
      ? undefined
      : filters.destination === DESTINATION_OTHER
        ? isNull(request.destinationId)
        : eq(request.destinationId, filters.destination),
    filters.period !== "all" && filters.from !== null && filters.to !== null
      ? createdBetweenSql(filters.from, filters.to)
      : undefined,
    filters.creatorId === null
      ? undefined
      : eq(request.createdBy, filters.creatorId),
    pattern === null ? undefined : searchSql(pattern),
  );
}
