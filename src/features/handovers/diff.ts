import type { CorrectionField } from "@/db/schema/handovers";

import { normalizeFreeText, normalizeItemNote } from "./fieldRules";

export type HandoverValues = {
  occurrencesText: string;
  nextShiftText: string;
  items: readonly { itemId: string; quantity: number; note: string | null }[];
};

export type CorrectionChange = {
  field: CorrectionField;
  itemId: string | null;
  oldValue: string;
  newValue: string;
};

/**
 * O que mudou entre a passagem atual e o estado desejado: uma linha por campo
 * alterado, na ordem ocorrências, próximo turno e depois cada item de
 * `current` (quantidade, observação). Textos são comparados depois da
 * normalização; observação null e "" são o mesmo valor. Item ausente em
 * `next` fica inalterado; item só em `next` é ignorado (o domínio recusa antes).
 */
export function diffHandover(
  current: HandoverValues,
  next: HandoverValues,
): CorrectionChange[] {
  const changes: CorrectionChange[] = [];

  const newOccurrences = normalizeFreeText(next.occurrencesText);
  if (normalizeFreeText(current.occurrencesText) !== newOccurrences) {
    changes.push({
      field: "occurrences_text",
      itemId: null,
      oldValue: current.occurrencesText,
      newValue: newOccurrences,
    });
  }

  const newNextShift = normalizeFreeText(next.nextShiftText);
  if (normalizeFreeText(current.nextShiftText) !== newNextShift) {
    changes.push({
      field: "next_shift_text",
      itemId: null,
      oldValue: current.nextShiftText,
      newValue: newNextShift,
    });
  }

  for (const before of current.items) {
    const after = next.items.find((item) => item.itemId === before.itemId);
    if (after === undefined) continue;

    if (before.quantity !== after.quantity) {
      changes.push({
        field: "item_quantity",
        itemId: before.itemId,
        oldValue: String(before.quantity),
        newValue: String(after.quantity),
      });
    }

    const oldNote = normalizeItemNote(before.note ?? "") ?? "";
    const newNote = normalizeItemNote(after.note ?? "") ?? "";
    if (oldNote !== newNote) {
      changes.push({
        field: "item_note",
        itemId: before.itemId,
        oldValue: before.note ?? "",
        newValue: newNote,
      });
    }
  }

  return changes;
}

/** "Ocorrências do turno" · "Fica para o próximo turno" · "{item}: quantidade" · "{item}: observação". */
export function correctionFieldLabel(
  field: CorrectionField,
  itemName: string | null,
): string {
  switch (field) {
    case "occurrences_text":
      return "Ocorrências do turno";
    case "next_shift_text":
      return "Fica para o próximo turno";
    case "item_quantity":
      return `${itemName ?? "Item"}: quantidade`;
    case "item_note":
      return `${itemName ?? "Item"}: observação`;
  }
}

/** Valor vazio aparece como "(vazio)" na lista de correções. */
export function displayCorrectionValue(value: string): string {
  return value === "" ? "(vazio)" : value;
}
