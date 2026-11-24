import "server-only";

import { and, eq } from "drizzle-orm";

import {
  request,
  requestComment,
  requestStatusEvent,
} from "@/db/schema/requests";
import type { Db } from "@/db/types";
import {
  type AdminFailure,
  type AdminResult,
  fail,
  ok,
} from "@/features/admin/result";
import { runInTransaction } from "@/features/admin/transaction";
import type { Authz } from "@/features/authz/authz";
import { SECTOR_INACTIVE_HANDOVER_MESSAGE } from "@/features/handovers/messages";
import type { RequestStatus } from "@/lib/requestStatuses";

import {
  findRequestById,
  lastChange,
  lockRequest,
  lockSectorShare,
  type RequestRow,
} from "./loaders";
import {
  alreadyCancelledMessage,
  alreadyMovedMessage,
  REQUEST_NOT_FOUND_MESSAGE,
  sameStatusMessage,
  statusConflictMessage,
} from "./messages";
import type { CancelRequestInput, MoveRequestInput } from "./schemas";

export type MovedRequest = {
  id: string;
  status: RequestStatus;
  statusChangedAt: Date;
};

// Leitura de escrita: a solicitação do escopo, com o setor travado (FOR SHARE)
// e ativo. Sem isso, a falha esperada.
async function loadForWrite(
  tx: Db,
  actor: Authz,
  id: string,
): Promise<{ row: RequestRow } | { failure: AdminFailure }> {
  const row = await findRequestById(tx, actor, id);
  if (!row) return { failure: fail("NOT_FOUND", REQUEST_NOT_FOUND_MESSAGE) };
  const owner = await lockSectorShare(tx, actor, row.sectorId);
  if (!owner) return { failure: fail("NOT_FOUND", REQUEST_NOT_FOUND_MESSAGE) };
  if (!owner.active) {
    return {
      failure: fail("SECTOR_INACTIVE", SECTOR_INACTIVE_HANDOVER_MESSAGE),
    };
  }
  return { row };
}

// O UPDATE condicionado ao status que a pessoa viu não achou linha: alguém
// chegou antes. Relê com FOR UPDATE e diz quem e quando.
async function lostRace(
  tx: Db,
  id: string,
  to: RequestStatus,
): Promise<AdminFailure> {
  const current = await lockRequest(tx, id);
  if (!current) return fail("NOT_FOUND", REQUEST_NOT_FOUND_MESSAGE);
  const last = await lastChange(tx, id);
  const byName = last?.byName ?? "outra pessoa";
  const at = last?.at ?? current.statusChangedAt;
  if (current.status === to) {
    return fail(
      "NO_CHANGES",
      to === "cancelled"
        ? alreadyCancelledMessage(byName, at)
        : alreadyMovedMessage(to, byName, at),
    );
  }
  return fail(
    "STATUS_CONFLICT",
    statusConflictMessage(current.status, byName, at),
  );
}

async function changeStatus(
  tx: Db,
  actor: Authz,
  input: { id: string; from: RequestStatus; to: RequestStatus },
  now: Date,
): Promise<AdminFailure | { eventId: string }> {
  const updated = await tx
    .update(request)
    .set({ status: input.to, statusChangedAt: now })
    .where(and(eq(request.id, input.id), eq(request.status, input.from)))
    .returning({ id: request.id });
  if (updated.length === 0) return lostRace(tx, input.id, input.to);

  const [event] = await tx
    .insert(requestStatusEvent)
    .values({
      requestId: input.id,
      fromStatus: input.from,
      toStatus: input.to,
      changedBy: actor.userId,
      changedAt: now,
    })
    .returning({ id: requestStatusEvent.id });
  if (!event) throw new Error("changeStatus: evento não criado");
  return { eventId: event.id };
}

/** Mover (inclui reabrir): `UPDATE … WHERE status = from` + evento, na mesma transação. */
export async function moveRequest(
  db: Db,
  actor: Authz,
  input: MoveRequestInput,
  now: Date,
): Promise<AdminResult<MovedRequest>> {
  return runInTransaction(db, async (tx) => {
    const loaded = await loadForWrite(tx, actor, input.id);
    if ("failure" in loaded) return loaded.failure;
    if (input.from === input.to) {
      return fail("NO_CHANGES", sameStatusMessage(input.to));
    }
    const changed = await changeStatus(tx, actor, input, now);
    if ("ok" in changed) return changed;
    return ok({ id: input.id, status: input.to, statusChangedAt: now });
  });
}

/** Cancelar: o mesmo caminho, com o motivo gravado como comentário ligado ao evento. */
export async function cancelRequest(
  db: Db,
  actor: Authz,
  input: CancelRequestInput,
  now: Date,
): Promise<AdminResult<MovedRequest>> {
  return runInTransaction(db, async (tx) => {
    const loaded = await loadForWrite(tx, actor, input.id);
    if ("failure" in loaded) return loaded.failure;
    if (input.from === "cancelled") {
      return fail("NO_CHANGES", sameStatusMessage("cancelled"));
    }
    const changed = await changeStatus(
      tx,
      actor,
      { id: input.id, from: input.from, to: "cancelled" },
      now,
    );
    if ("ok" in changed) return changed;
    await tx.insert(requestComment).values({
      requestId: input.id,
      authorId: actor.userId,
      body: input.reason,
      createdAt: now,
      statusEventId: changed.eventId,
    });
    return ok({ id: input.id, status: "cancelled", statusChangedAt: now });
  });
}
