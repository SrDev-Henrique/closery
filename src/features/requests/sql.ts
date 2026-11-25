import "server-only";

import { and, eq, inArray, isNull, ne, type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { destination } from "@/db/schema/catalog";
import { request } from "@/db/schema/requests";
import { type Authz, isAdmin } from "@/features/authz/authz";
import { scopeToSector } from "@/features/authz/sectorScope";
import { SAO_PAULO_TIME_ZONE } from "@/features/handovers/saoPaulo";

import { DESTINATION_OTHER, STALE_AFTER_DAYS } from "./limits";
import type { RequestFilters, RequestStatusFilter } from "./requestFilters";
import { SEARCH_FOLD_FROM, SEARCH_FOLD_TO, searchPattern } from "./search";
import { OPEN_STATUSES } from "./status";

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

// Nome do destino da linha: o do cadastro (inativo também) ou o texto livre
// do "Outro". Pede o leftJoin com `destination`.
export function destinationNameSql(): SQL<string> {
  return sql<string>`coalesce(${destination.name}, ${request.destinationOther})`;
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

// O instante da PRIMEIRA vez que a solicitação virou entregue (uma reaberta e
// reentregue conta pela primeira). Selecione com
// `.mapWith(requestStatusEvent.changedAt)`. `request` sem alias.
export function firstDeliveredAtSql(): SQL<Date | null> {
  return sql<Date | null>`(select min("e"."changed_at") from "request_status_event" "e" where "e"."request_id" = "request"."id" and "e"."to_status" = 'delivered')`;
}

// Dia de São Paulo da 1ª entrega entre duas datas "YYYY-MM-DD". Sem nenhum
// evento `delivered` o dia é nulo e a solicitação fica de fora.
export function deliveredBetweenSql(from: string, to: string): SQL {
  return sql`((${firstDeliveredAtSql()}) at time zone ${SAO_PAULO_TIME_ZONE})::date between ${from}::date and ${to}::date`;
}

// Status da lista: "open" = solicitada + em trânsito; "not_cancelled" = tudo
// menos cancelada; um status = ele só; "all" não filtra.
export function statusFilterSql(status: RequestStatusFilter): SQL | undefined {
  switch (status) {
    case "all":
      return undefined;
    case "open":
      return inArray(request.status, [...OPEN_STATUSES]);
    case "not_cancelled":
      return ne(request.status, "cancelled");
    default:
      return eq(request.status, status);
  }
}

// A solicitação pediu esse item (qualquer quantidade).
export function requestItemFilterSql(itemId: string): SQL {
  return sql`exists (select 1 from "request_item" "ri" where "ri"."request_id" = "request"."id" and "ri"."item_id" = ${itemId})`;
}

// Destino, status, parada, período (criação e entrega), item, criador e busca.
// Pede o JOIN com `destination`. `now` só entra na "parada" (72 h sem fuso).
export function requestFilterSql(
  filters: RequestFilters,
  now: Date,
): SQL | undefined {
  const pattern = searchPattern(filters.search);
  const { delivery } = filters;
  return and(
    filters.destination === null
      ? undefined
      : filters.destination === DESTINATION_OTHER
        ? isNull(request.destinationId)
        : eq(request.destinationId, filters.destination),
    filters.period !== "all" && filters.from !== null && filters.to !== null
      ? createdBetweenSql(filters.from, filters.to)
      : undefined,
    statusFilterSql(filters.status),
    filters.stale
      ? staleSql(now, request.status, request.statusChangedAt)
      : undefined,
    delivery.period !== "all" && delivery.from !== null && delivery.to !== null
      ? deliveredBetweenSql(delivery.from, delivery.to)
      : undefined,
    filters.itemId === null ? undefined : requestItemFilterSql(filters.itemId),
    filters.creatorId === null
      ? undefined
      : eq(request.createdBy, filters.creatorId),
    pattern === null ? undefined : searchSql(pattern),
  );
}
