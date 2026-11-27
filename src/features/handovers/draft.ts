import "server-only";

import { and, eq } from "drizzle-orm";

import { item } from "@/db/schema/catalog";
import { handover, handoverItem } from "@/db/schema/handovers";
import type { Db } from "@/db/types";
import { notFoundMessage } from "@/features/admin/messages";
import {
  type AdminResult,
  fail,
  INVALID_INPUT_MESSAGE,
  ok,
} from "@/features/admin/result";
import { runInTransaction } from "@/features/admin/transaction";
import type { Authz } from "@/features/authz/authz";

import { handoverCapabilities } from "./access";
import { ensureHandover } from "./ensureHandover";
import { validateFieldChange } from "./fieldRules";
import type { HandoverRow } from "./loaders";
import { EDIT_FORBIDDEN_MESSAGE, HANDOVER_LOCKED_MESSAGE } from "./messages";
import type { FieldChange, SaveFieldInput } from "./types";

export type SavedField = {
  handoverId: string;
  savedAt: Date;
  savedByName: string;
  savedById: string;
};

// Quantidade e observação de um item do setor. Rascunho: o item precisa estar
// ativo e a linha nasce (ou muda) por upsert. Entregue: só muda a linha que a
// entrega já criou. Devolve false se o item não vale para esta passagem.
async function saveItemField(
  tx: Db,
  row: HandoverRow,
  change: Extract<FieldChange, { field: "quantity" | "note" }>,
): Promise<boolean> {
  const [target] = await tx
    .select({ active: item.active })
    .from(item)
    .where(and(eq(item.id, change.itemId), eq(item.sectorId, row.sectorId)));
  if (!target) return false;

  // Observação vazia é "sem observação": guardada como null.
  const values =
    change.field === "quantity"
      ? { quantity: change.value }
      : { note: change.value === "" ? null : change.value };

  if (row.status === "draft") {
    if (!target.active) return false;
    await tx
      .insert(handoverItem)
      .values({ handoverId: row.id, itemId: change.itemId, ...values })
      .onConflictDoUpdate({
        target: [handoverItem.handoverId, handoverItem.itemId],
        set: values,
      });
    return true;
  }

  const updated = await tx
    .update(handoverItem)
    .set(values)
    .where(
      and(
        eq(handoverItem.handoverId, row.id),
        eq(handoverItem.itemId, change.itemId),
      ),
    )
    .returning({ itemId: handoverItem.itemId });
  return updated.length > 0;
}

/**
 * Salvamento automático de UM campo (F3-2, F3-3, F3-4). Uma transação; o
 * rascunho nasce aqui, no primeiro salvamento que dá certo (uma falha desfaz
 * até o rascunho recém-criado). Rascunho: qualquer pessoa do setor e o admin.
 * Entregue: quem entregou e o admin, direto. Confirmada: ninguém (nem o admin:
 * só `correctHandover` altera, com motivo). Não revalida a página.
 */
export async function saveHandoverField(
  db: Db,
  actor: Authz,
  input: SaveFieldInput,
  now: Date,
): Promise<AdminResult<SavedField>> {
  const ref = {
    sectorId: input.sectorId,
    shiftId: input.shiftId,
    operationalDate: input.operationalDate,
  };

  return runInTransaction(db, async (tx) => {
    const ensured = await ensureHandover(tx, actor, ref, now);
    if (!ensured.ok) return ensured;
    const { row } = ensured;

    if (row.status === "confirmed") {
      return fail("HANDOVER_LOCKED", HANDOVER_LOCKED_MESSAGE);
    }
    if (!handoverCapabilities(actor, row).canEditDirectly) {
      return fail("FORBIDDEN", EDIT_FORBIDDEN_MESSAGE);
    }

    const validated = validateFieldChange(input);
    if (!validated.ok) {
      return fail("INVALID_INPUT", INVALID_INPUT_MESSAGE, {
        value: validated.message,
      });
    }
    const valid = validated.change;

    const stamp = { updatedAt: now, updatedBy: actor.userId };
    if (valid.field === "occurrences") {
      await tx
        .update(handover)
        .set({ occurrencesText: valid.value, ...stamp })
        .where(eq(handover.id, row.id));
    } else if (valid.field === "nextShift") {
      await tx
        .update(handover)
        .set({ nextShiftText: valid.value, ...stamp })
        .where(eq(handover.id, row.id));
    } else {
      if (!(await saveItemField(tx, row, valid))) {
        return fail("NOT_FOUND", notFoundMessage("item"));
      }
      await tx.update(handover).set(stamp).where(eq(handover.id, row.id));
    }

    return ok({
      handoverId: row.id,
      savedAt: now,
      savedByName: actor.name,
      savedById: actor.userId,
    });
  });
}
