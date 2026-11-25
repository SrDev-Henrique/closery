import "server-only";

import { and, asc, desc, eq, type SQL, sql } from "drizzle-orm";

import { user } from "@/db/schema/auth";
import { destination } from "@/db/schema/catalog";
import { request } from "@/db/schema/requests";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import { PAGE_SIZE, type Page, resolvePage } from "@/features/admin/pagination";
import type { Authz } from "@/features/authz/authz";
import type { RequestStatus } from "@/lib/requestStatuses";

import { CLOSED_WINDOW_DAYS, DAY_MS } from "./limits";
import type { RequestFilters } from "./requestFilters";
import {
  daysInStatusSql,
  destinationNameSql,
  requestFilterSql,
  requestScopeSql,
  staleSql,
} from "./sql";
import { isOpenStatus } from "./status";
import type { RequestGroups, RequestListItem } from "./types";

type ListQuery = { sectorId: string | null; filters: RequestFilters };

// Tudo que a linha mostra é calculado aqui, no SQL: dias, "parada" e as
// contagens de itens e de comentários (sem os apagados).
function listColumns(now: Date) {
  return {
    id: request.id,
    sectorId: request.sectorId,
    sectorName: sector.name,
    description: request.description,
    destinationName: destinationNameSql(),
    destinationIsOther: sql<boolean>`(${request.destinationId} is null)`,
    status: request.status,
    createdByName: user.name,
    createdAt: request.createdAt,
    statusChangedAt: request.statusChangedAt,
    daysInStatus: daysInStatusSql(now, request.statusChangedAt),
    stale: staleSql(now, request.status, request.statusChangedAt),
    itemCount:
      sql<number>`(select count(*) from "request_item" where "request_item"."request_id" = "request"."id")`.mapWith(
        Number,
      ),
    commentCount:
      sql<number>`(select count(*) from "request_comment" where "request_comment"."request_id" = "request"."id" and "request_comment"."deleted_at" is null)`.mapWith(
        Number,
      ),
  };
}

function recorte(actor: Authz, query: ListQuery): SQL | undefined {
  return and(
    requestScopeSql(actor, query.sectorId),
    requestFilterSql(query.filters),
  );
}

// Entregue e Cancelada só dos últimos 30 dias (por status_changed_at) quando
// nenhum período foi escolhido; as abertas nunca saem pela janela.
function windowSql(filters: RequestFilters, now: Date): SQL | undefined {
  if (filters.period !== "all") return undefined;
  const cutoff = new Date(now.getTime() - CLOSED_WINDOW_DAYS * DAY_MS);
  return sql`"request"."status_changed_at" >= ${cutoff.toISOString()}::timestamptz`;
}

function groupWhere(
  actor: Authz,
  query: ListQuery,
  status: RequestStatus,
  now: Date,
): SQL | undefined {
  return and(
    recorte(actor, query),
    eq(request.status, status),
    isOpenStatus(status) ? undefined : windowSql(query.filters, now),
  );
}

export async function getRequestGroups(
  db: Db,
  actor: Authz,
  input: ListQuery,
  now: Date,
): Promise<RequestGroups> {
  const window = windowSql(input.filters, now) ?? sql`true`;
  const count = (status: RequestStatus) =>
    isOpenStatus(status)
      ? sql<number>`count(*) filter (where ${request.status} = ${status})`
      : sql<number>`count(*) filter (where ${request.status} = ${status} and ${window})`;

  const [totals] = await db
    .select({
      requested: count("requested").mapWith(Number),
      in_transit: count("in_transit").mapWith(Number),
      delivered: count("delivered").mapWith(Number),
      cancelled: count("cancelled").mapWith(Number),
    })
    .from(request)
    .leftJoin(destination, eq(destination.id, request.destinationId))
    .where(recorte(actor, input));

  const rowsOf = async (status: RequestStatus): Promise<RequestListItem[]> => {
    const order = isOpenStatus(status)
      ? [asc(request.statusChangedAt), asc(request.id)]
      : [desc(request.statusChangedAt), desc(request.id)];
    return db
      .select(listColumns(now))
      .from(request)
      .innerJoin(sector, eq(sector.id, request.sectorId))
      .innerJoin(user, eq(user.id, request.createdBy))
      .leftJoin(destination, eq(destination.id, request.destinationId))
      .where(groupWhere(actor, input, status, now))
      .orderBy(...order)
      .limit(input.filters.limits[status]);
  };

  const [requested, in_transit, delivered, cancelled] = await Promise.all([
    rowsOf("requested"),
    rowsOf("in_transit"),
    rowsOf("delivered"),
    rowsOf("cancelled"),
  ]);
  const rows: Record<RequestStatus, RequestListItem[]> = {
    requested,
    in_transit,
    delivered,
    cancelled,
  };

  const group = (status: RequestStatus) => ({
    status,
    total: totals?.[status] ?? 0,
    limit: input.filters.limits[status],
    rows: rows[status],
  });
  return {
    requested: group("requested"),
    in_transit: group("in_transit"),
    delivered: group("delivered"),
    cancelled: group("cancelled"),
  };
}

// A Tabela é o arquivo: todos os status, sem a janela de 30 dias, do mais
// novo para o mais antigo, PAGE_SIZE por página.
export async function listRequestTable(
  db: Db,
  actor: Authz,
  input: ListQuery,
  now: Date,
): Promise<Page<RequestListItem>> {
  const where = recorte(actor, input);

  const [counted] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(request)
    .leftJoin(destination, eq(destination.id, request.destinationId))
    .where(where);
  const total = counted?.total ?? 0;
  const { page, pageCount, offset } = resolvePage(total, input.filters.page);

  const rows = await db
    .select(listColumns(now))
    .from(request)
    .innerJoin(sector, eq(sector.id, request.sectorId))
    .innerJoin(user, eq(user.id, request.createdBy))
    .leftJoin(destination, eq(destination.id, request.destinationId))
    .where(where)
    .orderBy(desc(request.createdAt), desc(request.id))
    .limit(PAGE_SIZE)
    .offset(offset);

  return { rows, total, page, pageCount, pageSize: PAGE_SIZE };
}
