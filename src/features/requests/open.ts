import "server-only";

import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";

import { destination } from "@/db/schema/catalog";
import { request, requestStatusEvent } from "@/db/schema/requests";
import type { Db } from "@/db/types";
import { type Authz, canAccessSector } from "@/features/authz/authz";

import { HANDOVER_OPEN_LIMIT } from "./limits";
import { daysInStatusSql, requestScopeSql, staleSql } from "./sql";
import { isOpenStatus, OPEN_STATUSES } from "./status";
import type {
  OpenRequestSummary,
  OpenRequestsAtDelivery,
  OpenRequestsNow,
  RequestAtDelivery,
} from "./types";

// "Solicitações abertas" do formulário da passagem: as abertas AGORA do setor
// (Solicitada e Em separação / Trânsito), as paradas há mais tempo primeiro.
// Fora do escopo ou setor inativo: vazio.
export async function listOpenRequests(
  db: Db,
  actor: Authz,
  sectorId: string,
  now: Date,
): Promise<OpenRequestsNow> {
  const empty: OpenRequestsNow = { rows: [], total: 0, staleCount: 0 };
  if (!canAccessSector(actor, sectorId)) return empty;

  const where = and(
    requestScopeSql(actor, sectorId),
    inArray(request.status, [...OPEN_STATUSES]),
  );
  const stale = staleSql(now, request.status, request.statusChangedAt);

  const [counted] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      staleCount: sql<number>`count(*) filter (where ${stale})`.mapWith(Number),
    })
    .from(request)
    .where(where);

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
    .where(where)
    .orderBy(asc(request.statusChangedAt), asc(request.id))
    .limit(HANDOVER_OPEN_LIMIT);

  return {
    rows: rows.flatMap((row): OpenRequestSummary[] =>
      isOpenStatus(row.status) ? [{ ...row, status: row.status }] : [],
    ),
    total: counted?.total ?? 0,
    staleCount: counted?.staleCount ?? 0,
  };
}

// "Solicitações abertas" do resumo da passagem (D-F4-2): as que estavam
// abertas NO INSTANTE da entrega, com o status daquele instante (último
// evento com changed_at <= deliveredAt) e o de agora ao lado.
//
// O filtro "aberta" fica na consulta EXTERNA, nunca dentro do DISTINCT ON:
// dentro dele, uma solicitação entregue antes de T devolveria o último evento
// ABERTO dela. Não junta `sector.active`: o resumo de um setor inativo
// continua legível.
export async function listOpenRequestsAtDelivery(
  db: Db,
  actor: Authz,
  input: { sectorId: string; deliveredAt: Date },
): Promise<OpenRequestsAtDelivery> {
  const { sectorId, deliveredAt } = input;
  const empty: OpenRequestsAtDelivery = {
    deliveredAt,
    rows: [],
    total: 0,
    staleCount: 0,
  };
  if (!canAccessSector(actor, sectorId)) return empty;

  // Último evento de cada solicitação do setor até o instante T. Ordem total:
  // changed_at, seq (nunca id).
  const last = db.$with("last").as(
    db
      .selectDistinctOn([requestStatusEvent.requestId], {
        requestId: requestStatusEvent.requestId,
        toStatus: requestStatusEvent.toStatus,
        changedAt: requestStatusEvent.changedAt,
      })
      .from(requestStatusEvent)
      .innerJoin(request, eq(request.id, requestStatusEvent.requestId))
      .where(
        and(
          eq(request.sectorId, sectorId),
          lte(requestStatusEvent.changedAt, deliveredAt),
        ),
      )
      .orderBy(
        asc(requestStatusEvent.requestId),
        desc(requestStatusEvent.changedAt),
        desc(requestStatusEvent.seq),
      ),
  );
  const openAtDelivery = inArray(last.toStatus, [...OPEN_STATUSES]);
  const stale = staleSql(deliveredAt, last.toStatus, last.changedAt);

  const [counted] = await db
    .with(last)
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      staleCount: sql<number>`count(*) filter (where ${stale})`.mapWith(Number),
    })
    .from(last)
    .where(openAtDelivery);

  const rows = await db
    .with(last)
    .select({
      id: request.id,
      description: request.description,
      destinationName: sql<string>`coalesce(${destination.name}, ${request.destinationOther})`,
      status: last.toStatus,
      daysInStatus: daysInStatusSql(deliveredAt, last.changedAt),
      stale,
      statusNow: request.status,
    })
    .from(last)
    .innerJoin(request, eq(request.id, last.requestId))
    .leftJoin(destination, eq(destination.id, request.destinationId))
    .where(openAtDelivery)
    .orderBy(asc(last.changedAt), asc(request.id))
    .limit(HANDOVER_OPEN_LIMIT);

  return {
    deliveredAt,
    rows: rows.flatMap((row): RequestAtDelivery[] =>
      isOpenStatus(row.status) ? [{ ...row, status: row.status }] : [],
    ),
    total: counted?.total ?? 0,
    staleCount: counted?.staleCount ?? 0,
  };
}
