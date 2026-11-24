import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { destination, item } from "@/db/schema/catalog";
import { request, requestItem, requestStatusEvent } from "@/db/schema/requests";
import type { Db } from "@/db/types";
import { notFoundMessage } from "@/features/admin/messages";
import { type AdminResult, fail, ok } from "@/features/admin/result";
import { runInTransaction } from "@/features/admin/transaction";
import type { Authz } from "@/features/authz/authz";
import { ensureHandover } from "@/features/handovers/ensureHandover";
import {
  DUPLICATE_ITEM_MESSAGE,
  SECTOR_INACTIVE_HANDOVER_MESSAGE,
} from "@/features/handovers/messages";

import { lockSectorShare } from "./loaders";
import {
  DESTINATION_INACTIVE_MESSAGE,
  ITEM_NOT_ALLOWED_MESSAGE,
  ORIGIN_LOCKED_MESSAGE,
  ORIGIN_SECTOR_MISMATCH_MESSAGE,
} from "./messages";
import type { CreateRequestInput } from "./schemas";

export type CreatedRequest = { id: string };

/**
 * Uma transação: setor (FOR SHARE) → origem (cria o rascunho se preciso) →
 * destino → itens → request + itens + evento NULL → requested. Qualquer falha
 * desfaz tudo, inclusive o rascunho criado por `ensureHandover`.
 */
export async function createRequest(
  db: Db,
  actor: Authz,
  input: CreateRequestInput,
  now: Date,
): Promise<AdminResult<CreatedRequest>> {
  return runInTransaction(db, async (tx) => {
    const owner = await lockSectorShare(tx, actor, input.sectorId);
    if (!owner) return fail("NOT_FOUND", notFoundMessage("setor"));
    if (!owner.active) {
      return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_HANDOVER_MESSAGE);
    }

    let originHandoverId: string | null = null;
    if (input.originRef !== null) {
      if (input.originRef.sectorId !== input.sectorId) {
        return fail("INVALID_INPUT", ORIGIN_SECTOR_MISMATCH_MESSAGE, {
          sectorId: ORIGIN_SECTOR_MISMATCH_MESSAGE,
        });
      }
      const ensured = await ensureHandover(tx, actor, input.originRef, now);
      if (!ensured.ok) return ensured;
      // Entregue vale (corrida com o formulário aberto: só liga a solicitação,
      // não escreve em `handover`); confirmada não: o turno já foi recebido.
      if (ensured.row.status === "confirmed") {
        return fail("HANDOVER_LOCKED", ORIGIN_LOCKED_MESSAGE);
      }
      originHandoverId = ensured.row.id;
    }

    let destinationId: string | null = null;
    let destinationOther: string | null = null;
    if (input.destination.kind === "list") {
      const [target] = await tx
        .select({ id: destination.id, active: destination.active })
        .from(destination)
        .where(eq(destination.id, input.destination.destinationId))
        .for("share");
      if (!target) {
        return fail("NOT_FOUND", notFoundMessage("destino"), {
          destinationId: notFoundMessage("destino"),
        });
      }
      if (!target.active) {
        return fail("DESTINATION_INACTIVE", DESTINATION_INACTIVE_MESSAGE, {
          destinationId: DESTINATION_INACTIVE_MESSAGE,
        });
      }
      destinationId = target.id;
    } else {
      destinationOther = input.destination.text;
    }

    const wanted = input.items.map((line) => line.itemId);
    if (new Set(wanted).size !== wanted.length) {
      return fail("INVALID_INPUT", DUPLICATE_ITEM_MESSAGE, {
        items: DUPLICATE_ITEM_MESSAGE,
      });
    }
    const allowed =
      wanted.length === 0
        ? []
        : await tx
            .select({ id: item.id, name: item.name, unit: item.unit })
            .from(item)
            .where(
              and(
                inArray(item.id, wanted),
                eq(item.sectorId, input.sectorId),
                eq(item.kind, "stock"),
                eq(item.active, true),
              ),
            )
            .for("share");
    const byId = new Map(allowed.map((row) => [row.id, row]));
    // Item de outro setor, de controle, inativo ou inexistente: a mesma
    // mensagem, sem revelar o que existe.
    if (wanted.some((id) => !byId.has(id))) {
      return fail("INVALID_INPUT", ITEM_NOT_ALLOWED_MESSAGE, {
        items: ITEM_NOT_ALLOWED_MESSAGE,
      });
    }

    const [created] = await tx
      .insert(request)
      .values({
        sectorId: input.sectorId,
        destinationId,
        destinationOther,
        description: input.description,
        status: "requested",
        createdBy: actor.userId,
        createdAt: now,
        statusChangedAt: now,
        originHandoverId,
      })
      .returning({ id: request.id });
    if (!created) throw new Error("createRequest: solicitação não criada");

    const lines = input.items.flatMap((line) => {
      const source = byId.get(line.itemId);
      return source
        ? [
            {
              requestId: created.id,
              itemId: source.id,
              itemNameSnapshot: source.name,
              itemUnitSnapshot: source.unit,
              quantity: line.quantity,
            },
          ]
        : [];
    });
    if (lines.length > 0) await tx.insert(requestItem).values(lines);

    await tx.insert(requestStatusEvent).values({
      requestId: created.id,
      fromStatus: null,
      toStatus: "requested",
      changedBy: actor.userId,
      changedAt: now,
    });

    return ok({ id: created.id });
  });
}
