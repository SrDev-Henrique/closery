import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { destination } from "@/db/schema/catalog";
import { request } from "@/db/schema/requests";
import type { Db } from "@/db/types";
import { type Authz, canAccessSector } from "@/features/authz/authz";

import { HOME_STALE_LIMIT } from "./limits";
import { daysInStatusSql, requestScopeSql, staleSql } from "./sql";
import { isOpenStatus, OPEN_STATUSES } from "./status";
import type { HomeRequests, OpenRequestSummary } from "./types";

// Cartão "Solicitações" do Início: quantas abertas, quantas paradas e as
// paradas há mais tempo (até HOME_STALE_LIMIT). Contagens do SQL.
export async function getHomeRequests(
  db: Db,
  actor: Authz,
  sectorId: string,
  now: Date,
): Promise<HomeRequests> {
  const empty: HomeRequests = { openCount: 0, staleCount: 0, stale: [] };
  if (!canAccessSector(actor, sectorId)) return empty;

  const open = and(
    requestScopeSql(actor, sectorId),
    inArray(request.status, [...OPEN_STATUSES]),
  );
  const stale = staleSql(now, request.status, request.statusChangedAt);

  const [counted] = await db
    .select({
      openCount: sql<number>`count(*)`.mapWith(Number),
      staleCount: sql<number>`count(*) filter (where ${stale})`.mapWith(Number),
    })
    .from(request)
    .where(open);

  const rows = await db
    .select({
      id: request.id,
      description: request.description,
      destinationName: sql<string>`coalesce(${destination.name}, ${request.destinationOther})`,
      status: request.status,
      daysInStatus: daysInStatusSql(now, request.statusChangedAt),
      stale,
    })
    .from(request)
    .leftJoin(destination, eq(destination.id, request.destinationId))
    .where(and(open, stale))
    .orderBy(asc(request.statusChangedAt), asc(request.id))
    .limit(HOME_STALE_LIMIT);

  return {
    openCount: counted?.openCount ?? 0,
    staleCount: counted?.staleCount ?? 0,
    stale: rows.flatMap((row): OpenRequestSummary[] =>
      isOpenStatus(row.status) ? [{ ...row, status: row.status }] : [],
    ),
  };
}
