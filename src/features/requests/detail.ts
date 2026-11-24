import "server-only";

import { asc, desc, eq } from "drizzle-orm";
import { user } from "@/db/schema/auth";
import { destination, item, shift } from "@/db/schema/catalog";
import { handover } from "@/db/schema/handovers";
import {
  requestComment,
  requestItem,
  requestStatusEvent,
} from "@/db/schema/requests";
import type { Db } from "@/db/types";
import { type AdminResult, fail, ok } from "@/features/admin/result";
import type { Authz } from "@/features/authz/authz";
import { loadSector, userNames } from "@/features/handovers/loaders";

import { requestCapabilities } from "./access";
import { listRequestComments } from "./comments";
import { TIMELINE_LIMIT } from "./limits";
import { findRequestById } from "./loaders";
import { REQUEST_NOT_FOUND_MESSAGE } from "./messages";
import { daysInStatus, isStale } from "./stale";
import { timelineKind } from "./timeline";
import type {
  RequestDetailView,
  RequestItemLine,
  RequestOrigin,
  RequestTimelineEntry,
} from "./types";

/**
 * Os últimos TIMELINE_LIMIT eventos (changed_at desc, seq desc) devolvidos em
 * ordem cronológica, com o nome de quem mudou e, no cancelamento, o motivo
 * (o comentário ligado ao evento).
 */
export async function listRequestTimeline(
  db: Db,
  requestId: string,
): Promise<RequestTimelineEntry[]> {
  const latest = await db
    .select({
      id: requestStatusEvent.id,
      from: requestStatusEvent.fromStatus,
      to: requestStatusEvent.toStatus,
      byName: user.name,
      at: requestStatusEvent.changedAt,
      reason: requestComment.body,
    })
    .from(requestStatusEvent)
    .innerJoin(user, eq(user.id, requestStatusEvent.changedBy))
    .leftJoin(
      requestComment,
      eq(requestComment.statusEventId, requestStatusEvent.id),
    )
    .where(eq(requestStatusEvent.requestId, requestId))
    .orderBy(desc(requestStatusEvent.changedAt), desc(requestStatusEvent.seq))
    .limit(TIMELINE_LIMIT);

  return latest.reverse().map((row) => ({
    id: row.id,
    kind: timelineKind(row.from, row.to),
    from: row.from,
    to: row.to,
    byName: row.byName,
    at: row.at,
    reason: row.reason,
  }));
}

async function loadOrigin(
  db: Db,
  handoverId: string | null,
): Promise<RequestOrigin | null> {
  if (handoverId === null) return null;
  const [row] = await db
    .select({
      handoverId: handover.id,
      operationalDate: handover.operationalDate,
      snapshot: handover.shiftNameSnapshot,
      liveName: shift.name,
    })
    .from(handover)
    .innerJoin(shift, eq(shift.id, handover.shiftId))
    .where(eq(handover.id, handoverId));
  if (!row) return null;
  return {
    handoverId: row.handoverId,
    shiftName: row.snapshot ?? row.liveName,
    operationalDate: row.operationalDate,
  };
}

async function loadItems(
  db: Db,
  requestId: string,
): Promise<RequestItemLine[]> {
  return db
    .select({
      itemId: requestItem.itemId,
      name: requestItem.itemNameSnapshot,
      unit: requestItem.itemUnitSnapshot,
      quantity: requestItem.quantity,
    })
    .from(requestItem)
    .innerJoin(item, eq(item.id, requestItem.itemId))
    .where(eq(requestItem.requestId, requestId))
    .orderBy(asc(item.sortOrder), asc(item.id));
}

/**
 * Tudo que o detalhe mostra, numa chamada. Fora do escopo ou inexistente:
 * NOT_FOUND. Setor inativo continua legível (capabilities de escrita false).
 */
export async function getRequestDetail(
  db: Db,
  actor: Authz,
  input: { id: string; commentsLimit: number },
  now: Date,
): Promise<AdminResult<{ detail: RequestDetailView }>> {
  const row = await findRequestById(db, actor, input.id);
  if (!row) return fail("NOT_FOUND", REQUEST_NOT_FOUND_MESSAGE);
  const owner = await loadSector(db, actor, row.sectorId);
  if (!owner) return fail("NOT_FOUND", REQUEST_NOT_FOUND_MESSAGE);

  let destinationName = row.destinationOther ?? "";
  if (row.destinationId !== null) {
    const [target] = await db
      .select({ name: destination.name })
      .from(destination)
      .where(eq(destination.id, row.destinationId));
    destinationName = target?.name ?? "";
  }
  const names = await userNames(db, [row.createdBy]);

  const [origin, items, timeline, comments] = await Promise.all([
    loadOrigin(db, row.originHandoverId),
    loadItems(db, row.id),
    listRequestTimeline(db, row.id),
    listRequestComments(db, actor, {
      requestId: row.id,
      limit: input.commentsLimit,
      sectorActive: owner.active,
    }),
  ]);

  return ok({
    detail: {
      id: row.id,
      sectorId: owner.id,
      sectorName: owner.name,
      sectorActive: owner.active,
      description: row.description,
      destinationName,
      destinationIsOther: row.destinationId === null,
      status: row.status,
      createdByName: names.get(row.createdBy) ?? "",
      createdAt: row.createdAt,
      statusChangedAt: row.statusChangedAt,
      daysInStatus: daysInStatus(row.statusChangedAt, now),
      stale: isStale(row.status, row.statusChangedAt, now),
      origin,
      items,
      timeline,
      comments,
      capabilities: requestCapabilities(actor, row, owner),
    },
  });
}
