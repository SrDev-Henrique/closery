import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { destination, item } from "@/db/schema/catalog";
import { request, requestItem } from "@/db/schema/requests";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import type { Authz } from "@/features/authz/authz";
import { DESTINATION_OTHER } from "@/features/requests/limits";
import {
  createdBetweenSql,
  deliveredBetweenSql,
  firstDeliveredAtSql,
  requestScopeSql,
  staleSql,
} from "@/features/requests/sql";
import { OPEN_STATUSES } from "@/features/requests/status";

import { DESTINATION_BAR_LIMIT, REQUESTED_ITEM_LIMIT } from "./limits";
import type {
  DashboardQuery,
  DestinationDelivery,
  RequestedItem,
  RequestsData,
} from "./types";

const OTHER_LABEL = "Outro";

/**
 * Solicitações do dashboard. Abertas e paradas são "agora"; entregues, tempo
 * até a entrega e quantidade pedida são do período. A tabela `request` nunca
 * tem alias (os fragmentos de features/requests/sql.ts escrevem "request").
 */
export async function getRequestsData(
  db: Db,
  actor: Authz,
  input: DashboardQuery,
  now: Date,
): Promise<RequestsData> {
  const { period } = input;
  const scope = requestScopeSql(actor, input.sectorId);
  const open = sql`${request.status} in (${sql.join(
    OPEN_STATUSES.map((status) => sql`${status}`),
    sql`, `,
  )})`;
  const delivered = deliveredBetweenSql(period.from, period.to);

  const averageSeconds = sql<number>`avg(extract(epoch from (${firstDeliveredAtSql()} - ${request.createdAt})))::float8`;
  const destinationName = sql<string>`coalesce(${destination.name}, ${OTHER_LABEL})`;
  const deliveredCount = sql<number>`count(*)`.mapWith(Number);

  const latest = (column: PgColumn) =>
    sql<string>`(array_agg(${column} order by ${request.createdAt} desc, ${request.id} desc))[1]`;
  const itemName = latest(requestItem.itemNameSnapshot);
  const requestCount = sql<number>`count(*)`.mapWith(Number);
  const quantity = sql<number>`sum(${requestItem.quantity})`.mapWith(Number);

  const [countRows, destinationRows, itemRows] = await Promise.all([
    db
      .select({
        open: sql<number>`count(*) filter (where ${open})`.mapWith(Number),
        stale:
          sql<number>`count(*) filter (where ${open} and ${staleSql(now, request.status, request.statusChangedAt)})`.mapWith(
            Number,
          ),
        deliveredInPeriod:
          sql<number>`count(*) filter (where ${delivered})`.mapWith(Number),
      })
      .from(request)
      .where(scope),
    db
      .select({
        destinationId: request.destinationId,
        name: destinationName,
        deliveredCount,
        averageSeconds,
        totalDestinations: sql<number>`count(*) over ()`.mapWith(Number),
      })
      .from(request)
      .leftJoin(destination, eq(destination.id, request.destinationId))
      .where(and(scope, delivered))
      .groupBy(request.destinationId, destination.name)
      .orderBy(
        desc(averageSeconds),
        desc(deliveredCount),
        sql`lower(${destinationName})`,
        sql`${request.destinationId} nulls last`,
      )
      .limit(DESTINATION_BAR_LIMIT),
    db
      .select({
        itemId: requestItem.itemId,
        sectorId: item.sectorId,
        sectorName: sector.name,
        name: itemName,
        unit: latest(requestItem.itemUnitSnapshot),
        quantity,
        requestCount,
        totalItems: sql<number>`count(*) over ()`.mapWith(Number),
      })
      .from(requestItem)
      .innerJoin(request, eq(request.id, requestItem.requestId))
      .innerJoin(item, eq(item.id, requestItem.itemId))
      .innerJoin(sector, eq(sector.id, item.sectorId))
      .where(
        and(
          scope,
          createdBetweenSql(period.from, period.to),
          sql`"request"."status" <> 'cancelled'`,
        ),
      )
      .groupBy(requestItem.itemId, item.sectorId, sector.name)
      .orderBy(
        desc(requestCount),
        desc(quantity),
        sql`lower(${itemName})`,
        requestItem.itemId,
      )
      .limit(REQUESTED_ITEM_LIMIT),
  ]);

  const counts = countRows[0];
  const destinations: DestinationDelivery[] = destinationRows.map((row) => ({
    key: row.destinationId ?? DESTINATION_OTHER,
    destinationId: row.destinationId,
    name: row.name,
    deliveredCount: row.deliveredCount,
    averageSeconds: row.averageSeconds,
  }));
  const items: RequestedItem[] = itemRows.map((row) => ({
    itemId: row.itemId,
    sectorId: row.sectorId,
    sectorName: row.sectorName,
    name: row.name,
    unit: row.unit,
    quantity: row.quantity,
    requestCount: row.requestCount,
  }));

  return {
    open: counts?.open ?? 0,
    stale: counts?.stale ?? 0,
    deliveredInPeriod: counts?.deliveredInPeriod ?? 0,
    destinations,
    totalDestinations: destinationRows[0]?.totalDestinations ?? 0,
    items,
    totalItems: itemRows[0]?.totalItems ?? 0,
  };
}
