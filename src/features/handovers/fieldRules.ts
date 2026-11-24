import { ITEM_NOTE_MAX_LENGTH, MAX_QUANTITY, TEXT_MAX_LENGTH } from "./limits";
import {
  NOTE_TOO_LONG_MESSAGE,
  QUANTITY_MESSAGE,
  TEXT_TOO_LONG_MESSAGE,
} from "./messages";
import type { FieldChange } from "./types";

/** Conta pontos de código, não unidades UTF-16 (um emoji conta 1). */
export function codePointLength(value: string): number {
  let length = 0;
  for (const _ of value) length += 1;
  return length;
}

function normalizeLineBreaks(value: string): string {
  return value.normalize("NFC").replace(/\r\n?/g, "\n");
}

/** Texto livre guardado como digitado: NFC e quebras de linha \n; sem trim (salva enquanto a pessoa digita). */
export function normalizeFreeText(raw: string): string {
  return normalizeLineBreaks(raw);
}

/** Observação de item: NFC, qualquer sequência de espaços/quebras vira um espaço, trim. Vazio → null. */
export function normalizeItemNote(raw: string): string | null {
  const note = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  return note === "" ? null : note;
}

/** Observação do recebimento: NFC, \n, trim. Vazio → null. */
export function normalizeOptionalText(raw: string): string | null {
  const text = normalizeLineBreaks(raw).trim();
  return text === "" ? null : text;
}

/** Motivo da correção: NFC, \n, trim (pode sobrar ""). */
export function normalizeReason(raw: string): string {
  return normalizeLineBreaks(raw).trim();
}

/**
 * Revalida e normaliza um campo salvo pelo formulário. Devolve o valor
 * normalizado (a observação do item vira "" no lugar de null). O cliente e o
 * servidor usam esta mesma função.
 */
export function validateFieldChange(
  change: FieldChange,
): { ok: true; change: FieldChange } | { ok: false; message: string } {
  switch (change.field) {
    case "quantity": {
      const valid =
        Number.isInteger(change.value) &&
        change.value >= 0 &&
        change.value <= MAX_QUANTITY;
      return valid
        ? { ok: true, change }
        : { ok: false, message: QUANTITY_MESSAGE };
    }
    case "occurrences":
    case "nextShift": {
      const value = normalizeFreeText(change.value);
      if (codePointLength(value) > TEXT_MAX_LENGTH) {
        return { ok: false, message: TEXT_TOO_LONG_MESSAGE };
      }
      return { ok: true, change: { field: change.field, value } };
    }
    case "note": {
      const value = normalizeItemNote(change.value) ?? "";
      if (codePointLength(value) > ITEM_NOTE_MAX_LENGTH) {
        return { ok: false, message: NOTE_TOO_LONG_MESSAGE };
      }
      return {
        ok: true,
        change: { field: "note", itemId: change.itemId, value },
      };
    }
  }
}
