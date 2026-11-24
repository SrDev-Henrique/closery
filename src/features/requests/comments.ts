import "server-only";

import { and, count, desc, eq, isNull } from "drizzle-orm";

import { user } from "@/db/schema/auth";
import { request, requestComment } from "@/db/schema/requests";
import type { Db } from "@/db/types";
import { type AdminResult, fail, ok } from "@/features/admin/result";
import { runInTransaction } from "@/features/admin/transaction";
import { type Authz, canAccessSector } from "@/features/authz/authz";
import { SECTOR_INACTIVE_HANDOVER_MESSAGE } from "@/features/handovers/messages";

import { canDeleteComment } from "./access";
import { findRequestById, lockSectorShare } from "./loaders";
import {
  CANCEL_REASON_LOCKED_MESSAGE,
  COMMENT_DELETE_FORBIDDEN_MESSAGE,
  COMMENT_NOT_FOUND_MESSAGE,
  REQUEST_NOT_FOUND_MESSAGE,
} from "./messages";
import type { AddCommentInput, DeleteCommentInput } from "./schemas";
import type { RequestCommentsPage } from "./types";

export type AddedComment = { id: string; createdAt: Date };

/** Qualquer pessoa do setor (e o admin) comenta; setor inativo é só leitura. */
export async function addComment(
  db: Db,
  actor: Authz,
  input: AddCommentInput,
  now: Date,
): Promise<AdminResult<AddedComment>> {
  return runInTransaction(db, async (tx) => {
    const row = await findRequestById(tx, actor, input.requestId);
    if (!row) return fail("NOT_FOUND", REQUEST_NOT_FOUND_MESSAGE);
    const owner = await lockSectorShare(tx, actor, row.sectorId);
    if (!owner) return fail("NOT_FOUND", REQUEST_NOT_FOUND_MESSAGE);
    if (!owner.active) {
      return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_HANDOVER_MESSAGE);
    }

    const [created] = await tx
      .insert(requestComment)
      .values({
        requestId: row.id,
        authorId: actor.userId,
        body: input.body,
        createdAt: now,
      })
      .returning({
        id: requestComment.id,
        createdAt: requestComment.createdAt,
      });
    if (!created) throw new Error("addComment: comentário não criado");
    return ok({ id: created.id, createdAt: created.createdAt });
  });
}

/**
 * Só o autor apaga o próprio comentário (o admin também só o próprio), nunca o
 * motivo de um cancelamento. É `UPDATE … SET deleted_at`, uma vez: o texto
 * fica no banco.
 */
export async function deleteComment(
  db: Db,
  actor: Authz,
  input: DeleteCommentInput,
  now: Date,
): Promise<AdminResult> {
  return runInTransaction(db, async (tx) => {
    const [found] = await tx
      .select({
        authorId: requestComment.authorId,
        statusEventId: requestComment.statusEventId,
        deletedAt: requestComment.deletedAt,
        sectorId: request.sectorId,
      })
      .from(requestComment)
      .innerJoin(request, eq(request.id, requestComment.requestId))
      .where(eq(requestComment.id, input.id));
    // Inexistente, já apagado ou de outro setor: a mesma resposta.
    if (
      !found ||
      found.deletedAt !== null ||
      !canAccessSector(actor, found.sectorId)
    ) {
      return fail("NOT_FOUND", COMMENT_NOT_FOUND_MESSAGE);
    }
    const owner = await lockSectorShare(tx, actor, found.sectorId);
    if (!owner) return fail("NOT_FOUND", COMMENT_NOT_FOUND_MESSAGE);
    if (!owner.active) {
      return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_HANDOVER_MESSAGE);
    }
    if (found.statusEventId !== null) {
      return fail("FORBIDDEN", CANCEL_REASON_LOCKED_MESSAGE);
    }
    if (found.authorId !== actor.userId) {
      return fail("FORBIDDEN", COMMENT_DELETE_FORBIDDEN_MESSAGE);
    }

    const updated = await tx
      .update(requestComment)
      .set({ deletedAt: now })
      .where(
        and(
          eq(requestComment.id, input.id),
          eq(requestComment.authorId, actor.userId),
          isNull(requestComment.deletedAt),
          isNull(requestComment.statusEventId),
        ),
      )
      .returning({ id: requestComment.id });
    if (updated.length === 0) {
      return fail("NOT_FOUND", COMMENT_NOT_FOUND_MESSAGE);
    }
    return ok();
  });
}

/**
 * Comentários não apagados: os últimos `limit` (created_at desc, id desc),
 * devolvidos em ordem cronológica. `total` e `hasEarlier` saem do SQL.
 */
export async function listRequestComments(
  db: Db,
  actor: Authz,
  input: { requestId: string; limit: number; sectorActive: boolean },
): Promise<RequestCommentsPage> {
  const visible = and(
    eq(requestComment.requestId, input.requestId),
    isNull(requestComment.deletedAt),
  );
  const [totals] = await db
    .select({ total: count() })
    .from(requestComment)
    .where(visible);
  const total = totals?.total ?? 0;

  const latest = await db
    .select({
      id: requestComment.id,
      authorId: requestComment.authorId,
      authorName: user.name,
      body: requestComment.body,
      createdAt: requestComment.createdAt,
      statusEventId: requestComment.statusEventId,
      deletedAt: requestComment.deletedAt,
    })
    .from(requestComment)
    .innerJoin(user, eq(user.id, requestComment.authorId))
    .where(visible)
    .orderBy(desc(requestComment.createdAt), desc(requestComment.id))
    .limit(input.limit);

  const rows = latest.reverse().map((row) => ({
    id: row.id,
    authorName: row.authorName,
    body: row.body,
    createdAt: row.createdAt,
    isCancelReason: row.statusEventId !== null,
    canDelete: canDeleteComment(actor, row, { active: input.sectorActive }),
  }));
  return { rows, total, hasEarlier: total > rows.length, limit: input.limit };
}
