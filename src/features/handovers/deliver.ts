import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { item, shift } from "@/db/schema/catalog";
import { handover, handoverItem } from "@/db/schema/handovers";
import type { Db } from "@/db/types";
import { notFoundMessage } from "@/features/admin/messages";
import { type AdminResult, fail, ok } from "@/features/admin/result";
import { runInTransaction } from "@/features/admin/transaction";
import type { Authz } from "@/features/authz/authz";

import { handoverCapabilities } from "./access";
import { ensureHandover } from "./ensureHandover";
import { type HandoverRow, lockHandover, userNames } from "./loaders";
import {
  alreadyDeliveredMessage,
  HANDOVER_NOT_FOUND_MESSAGE,
} from "./messages";
import type { HandoverRef } from "./types";

export type Delivered = { id: string; deliveredAt: Date };

// "Esta passagem já foi entregue por {nome} às {HH:mm}." a partir da linha atual.
async function alreadyDelivered(tx: Db, row: HandoverRow) {
  const names = await userNames(tx, row.deliveredBy ? [row.deliveredBy] : []);
  const who = row.deliveredBy ? (names.get(row.deliveredBy) ?? "alguém") : "";
  const at = row.deliveredAt ?? row.updatedAt;
  return fail("ALREADY_DELIVERED", alreadyDeliveredMessage(who, at));
}

/**
 * Entregar o turno (F3-5), numa transação: cria o rascunho se não existir,
 * trava a linha, passa de `draft` para `delivered` só se ainda for `draft`,
 * completa com `0` os itens ATIVOS do setor que faltam e grava o snapshot
 * (nome, unidade, tipo) de TODAS as linhas. Linha de item desativado depois
 * fica (o dado digitado não se perde). Sem diálogo e sem bloqueio: entregar
 * tudo zerado e sem texto é permitido ("nada aconteceu" também é informação).
 */
export async function deliverHandover(
  db: Db,
  actor: Authz,
  ref: HandoverRef,
  now: Date,
): Promise<AdminResult<Delivered>> {
  return runInTransaction(db, async (tx) => {
    const ensured = await ensureHandover(tx, actor, ref, now);
    if (!ensured.ok) return ensured;
    const { row } = ensured;

    if (row.status !== "draft") return alreadyDelivered(tx, row);
    if (!handoverCapabilities(actor, row).canDeliver) {
      return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);
    }

    const [target] = await tx
      .select({ name: shift.name })
      .from(shift)
      .where(eq(shift.id, row.shiftId));
    if (!target) return fail("NOT_FOUND", notFoundMessage("turno"));

    const updated = await tx
      .update(handover)
      .set({
        status: "delivered",
        deliveredBy: actor.userId,
        deliveredAt: now,
        shiftNameSnapshot: target.name,
        updatedAt: now,
        updatedBy: actor.userId,
      })
      .where(and(eq(handover.id, row.id), eq(handover.status, "draft")))
      .returning({ id: handover.id });
    if (updated.length === 0) {
      // Outra entrega chegou entre a leitura e a escrita: diz quem ganhou.
      const current = await lockHandover(tx, row.id);
      if (!current) return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);
      return alreadyDelivered(tx, current);
    }

    await tx.execute(sql`
      insert into handover_item (handover_id, item_id, quantity)
      select ${row.id}, ${item.id}, 0
      from ${item}
      where ${item.sectorId} = ${row.sectorId} and ${item.active}
      on conflict do nothing
    `);
    await tx
      .update(handoverItem)
      .set({
        itemNameSnapshot: item.name,
        itemUnitSnapshot: item.unit,
        itemKindSnapshot: item.kind,
      })
      .from(item)
      .where(
        and(
          eq(item.id, handoverItem.itemId),
          eq(handoverItem.handoverId, row.id),
        ),
      );

    return ok({ id: row.id, deliveredAt: now });
  });
}
