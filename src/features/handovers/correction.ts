import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { item } from "@/db/schema/catalog";
import {
  handover,
  handoverCorrection,
  handoverItem,
} from "@/db/schema/handovers";
import type { Db } from "@/db/types";
import { notFoundMessage } from "@/features/admin/messages";
import {
  type AdminResult,
  type FieldErrors,
  fail,
  INVALID_INPUT_MESSAGE,
  ok,
} from "@/features/admin/result";
import { type Authz, isAdmin } from "@/features/authz/authz";

import { diffHandover } from "./diff";
import {
  codePointLength,
  normalizeFreeText,
  normalizeItemNote,
  normalizeReason,
} from "./fieldRules";
import {
  ITEM_NOTE_MAX_LENGTH,
  MAX_QUANTITY,
  REASON_MAX_LENGTH,
  TEXT_MAX_LENGTH,
} from "./limits";
import { findHandoverById, loadSector, lockHandover } from "./loaders";
import {
  CORRECTION_FORBIDDEN_MESSAGE,
  DUPLICATE_ITEM_MESSAGE,
  HANDOVER_NOT_FOUND_MESSAGE,
  NO_CHANGES_MESSAGE,
  NOT_CONFIRMED_MESSAGE,
  NOTE_TOO_LONG_MESSAGE,
  QUANTITY_MESSAGE,
  REASON_REQUIRED_MESSAGE,
  REASON_TOO_LONG_MESSAGE,
  SECTOR_INACTIVE_HANDOVER_MESSAGE,
  TEXT_TOO_LONG_MESSAGE,
} from "./messages";

export type CorrectionInput = {
  id: string;
  reason: string;
  occurrencesText: string;
  nextShiftText: string;
  items: { itemId: string; quantity: number; note: string }[];
};

type CleanInput = {
  reason: string;
  occurrencesText: string;
  nextShiftText: string;
  items: { itemId: string; quantity: number; note: string | null }[];
};

// O domínio revalida tudo: a tela e o schema Zod podem ter sido contornados.
function validate(
  input: CorrectionInput,
): { ok: true; clean: CleanInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const reason = normalizeReason(input.reason);
  if (reason === "") errors.reason = REASON_REQUIRED_MESSAGE;
  else if (codePointLength(reason) > REASON_MAX_LENGTH) {
    errors.reason = REASON_TOO_LONG_MESSAGE;
  }

  const occurrencesText = normalizeFreeText(input.occurrencesText);
  if (codePointLength(occurrencesText) > TEXT_MAX_LENGTH) {
    errors.occurrencesText = TEXT_TOO_LONG_MESSAGE;
  }
  const nextShiftText = normalizeFreeText(input.nextShiftText);
  if (codePointLength(nextShiftText) > TEXT_MAX_LENGTH) {
    errors.nextShiftText = TEXT_TOO_LONG_MESSAGE;
  }

  const seen = new Set<string>();
  const items: CleanInput["items"] = [];
  for (const line of input.items) {
    const note = normalizeItemNote(line.note);
    if (seen.has(line.itemId)) errors.items = DUPLICATE_ITEM_MESSAGE;
    else if (
      !Number.isInteger(line.quantity) ||
      line.quantity < 0 ||
      line.quantity > MAX_QUANTITY
    ) {
      errors.items = QUANTITY_MESSAGE;
    } else if (note !== null && codePointLength(note) > ITEM_NOTE_MAX_LENGTH) {
      errors.items = NOTE_TOO_LONG_MESSAGE;
    }
    seen.add(line.itemId);
    items.push({ itemId: line.itemId, quantity: line.quantity, note });
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    clean: { reason, occurrencesText, nextShiftText, items },
  };
}

export async function correctHandover(
  db: Db,
  actor: Authz,
  input: CorrectionInput,
  now: Date,
): Promise<AdminResult<{ changes: number }>> {
  return db.transaction(async (tx) => {
    const visible = await findHandoverById(tx, actor, input.id);
    if (!visible) return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);
    if (!isAdmin(actor)) {
      return fail("FORBIDDEN", CORRECTION_FORBIDDEN_MESSAGE);
    }

    // Setor inativo é só leitura (P26).
    const owner = await loadSector(tx, actor, visible.sectorId);
    if (!owner) return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);
    if (!owner.active) {
      return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_HANDOVER_MESSAGE);
    }

    const checked = validate(input);
    if (!checked.ok) {
      return fail("INVALID_INPUT", INVALID_INPUT_MESSAGE, checked.errors);
    }
    const { clean } = checked;

    const row = await lockHandover(tx, input.id);
    if (!row) return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);
    if (row.status !== "confirmed") {
      return fail("NOT_CONFIRMED", NOT_CONFIRMED_MESSAGE);
    }

    const current = await tx
      .select({
        itemId: handoverItem.itemId,
        quantity: handoverItem.quantity,
        note: handoverItem.note,
      })
      .from(handoverItem)
      .innerJoin(item, eq(item.id, handoverItem.itemId))
      .where(eq(handoverItem.handoverId, row.id))
      .orderBy(asc(item.sortOrder), asc(item.id));
    const known = new Set(current.map((line) => line.itemId));
    if (clean.items.some((line) => !known.has(line.itemId))) {
      return fail("NOT_FOUND", notFoundMessage("item"));
    }

    const changes = diffHandover(
      {
        occurrencesText: row.occurrencesText,
        nextShiftText: row.nextShiftText,
        items: current,
      },
      clean,
    );
    if (changes.length === 0) return fail("NO_CHANGES", NO_CHANGES_MESSAGE);

    for (const change of changes) {
      if (change.itemId === null) continue;
      const where = and(
        eq(handoverItem.handoverId, row.id),
        eq(handoverItem.itemId, change.itemId),
      );
      if (change.field === "item_quantity") {
        await tx
          .update(handoverItem)
          .set({ quantity: Number(change.newValue) })
          .where(where);
      } else {
        await tx
          .update(handoverItem)
          .set({ note: change.newValue === "" ? null : change.newValue })
          .where(where);
      }
    }
    await tx
      .update(handover)
      .set({
        occurrencesText: clean.occurrencesText,
        nextShiftText: clean.nextShiftText,
        updatedAt: now,
        updatedBy: actor.userId,
      })
      .where(eq(handover.id, row.id));
    await tx.insert(handoverCorrection).values(
      changes.map((change) => ({
        handoverId: row.id,
        field: change.field,
        itemId: change.itemId,
        oldValue: change.oldValue,
        newValue: change.newValue,
        reason: clean.reason,
        correctedBy: actor.userId,
        correctedAt: now,
      })),
    );
    return ok({ changes: changes.length });
  });
}
