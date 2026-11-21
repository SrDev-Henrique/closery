import { describe, expect, it } from "vitest";

import {
  CONFIRMATION_NOTE_MAX_LENGTH,
  ITEM_NOTE_MAX_LENGTH,
  MAX_DAYS_BACK,
  MAX_QUANTITY,
  REASON_MAX_LENGTH,
  TEXT_MAX_LENGTH,
} from "./limits";
import {
  alreadyConfirmedMessage,
  alreadyDeliveredMessage,
  CONFIRMATION_NOTE_TOO_LONG_MESSAGE,
  CORRECTION_FORBIDDEN_MESSAGE,
  DATE_OUT_OF_RANGE_MESSAGE,
  DUPLICATE_ITEM_MESSAGE,
  EDIT_FORBIDDEN_MESSAGE,
  HANDOVER_LOCKED_MESSAGE,
  HANDOVER_NOT_FOUND_MESSAGE,
  INVALID_DATE_MESSAGE,
  NO_CHANGES_MESSAGE,
  NOT_CONFIRMED_MESSAGE,
  NOT_DELIVERED_MESSAGE,
  NOTE_TOO_LONG_MESSAGE,
  OWN_HANDOVER_MESSAGE,
  QUANTITY_MESSAGE,
  REASON_REQUIRED_MESSAGE,
  REASON_TOO_LONG_MESSAGE,
  SECTOR_INACTIVE_HANDOVER_MESSAGE,
  SHIFT_INACTIVE_MESSAGE,
  SWITCH_FAILED_MESSAGE,
  TEXT_TOO_LONG_MESSAGE,
  UNSAVED_DELIVER_MESSAGE,
} from "./messages";
import { formatQuantity } from "./quantity";

describe("mensagens fixas (os testes de tela e o E2E dependem do texto exato)", () => {
  it.each([
    [HANDOVER_NOT_FOUND_MESSAGE, "Passagem não encontrada. Atualize a página."],
    [
      SECTOR_INACTIVE_HANDOVER_MESSAGE,
      "Este setor está inativo. Peça a um administrador para reativá-lo.",
    ],
    [SHIFT_INACTIVE_MESSAGE, "Este turno está inativo. Escolha outro turno."],
    [
      DATE_OUT_OF_RANGE_MESSAGE,
      "Escolha uma data de hoje ou dos últimos 31 dias.",
    ],
    [
      EDIT_FORBIDDEN_MESSAGE,
      "Só quem entregou o turno ou um administrador pode editar esta passagem.",
    ],
    [
      HANDOVER_LOCKED_MESSAGE,
      "Esta passagem já foi confirmada. Só um administrador corrige, com motivo.",
    ],
    [NOT_DELIVERED_MESSAGE, "Esta passagem ainda não foi entregue."],
    [
      OWN_HANDOVER_MESSAGE,
      "Quem entregou o turno não pode confirmar o recebimento. Peça a outra pessoa do setor.",
    ],
    [
      NOT_CONFIRMED_MESSAGE,
      "Só passagens confirmadas passam pela correção com motivo. Edite a passagem direto.",
    ],
    [
      CORRECTION_FORBIDDEN_MESSAGE,
      "Só um administrador pode corrigir uma passagem confirmada.",
    ],
    [
      NO_CHANGES_MESSAGE,
      "Nada foi alterado. Mude algum campo para registrar a correção.",
    ],
    [REASON_REQUIRED_MESSAGE, "Informe o motivo da correção."],
    [REASON_TOO_LONG_MESSAGE, "O motivo pode ter no máximo 500 caracteres."],
    [QUANTITY_MESSAGE, "Informe um número inteiro de 0 a 99.999."],
    [TEXT_TOO_LONG_MESSAGE, "O texto pode ter no máximo 2.000 caracteres."],
    [NOTE_TOO_LONG_MESSAGE, "A observação pode ter no máximo 200 caracteres."],
    [
      CONFIRMATION_NOTE_TOO_LONG_MESSAGE,
      "A observação pode ter no máximo 500 caracteres.",
    ],
    [INVALID_DATE_MESSAGE, "Data inválida."],
    [DUPLICATE_ITEM_MESSAGE, "Item repetido. Atualize a página."],
    [
      UNSAVED_DELIVER_MESSAGE,
      "Há alterações sem salvar. Toque em “Tentar de novo” e entregue de novo.",
    ],
    [
      SWITCH_FAILED_MESSAGE,
      "Não foi possível salvar. Tente de novo antes de trocar de turno.",
    ],
  ])("%s", (actual, expected) => {
    expect(actual).toBe(expected);
  });

  it("os números das mensagens batem com os limites", () => {
    expect(QUANTITY_MESSAGE).toContain(formatQuantity(MAX_QUANTITY));
    expect(TEXT_TOO_LONG_MESSAGE).toContain(formatQuantity(TEXT_MAX_LENGTH));
    expect(NOTE_TOO_LONG_MESSAGE).toContain(String(ITEM_NOTE_MAX_LENGTH));
    expect(CONFIRMATION_NOTE_TOO_LONG_MESSAGE).toContain(
      String(CONFIRMATION_NOTE_MAX_LENGTH),
    );
    expect(REASON_TOO_LONG_MESSAGE).toContain(String(REASON_MAX_LENGTH));
    expect(DATE_OUT_OF_RANGE_MESSAGE).toContain(String(MAX_DAYS_BACK));
  });
});

describe("mensagens com nome e hora", () => {
  it("alreadyDeliveredMessage usa a hora de São Paulo", () => {
    expect(
      alreadyDeliveredMessage("Ana Teste", new Date("2026-11-20T17:05:00Z")),
    ).toBe("Esta passagem já foi entregue por Ana Teste às 14:05.");
  });

  it("alreadyConfirmedMessage usa a hora de São Paulo", () => {
    expect(
      alreadyConfirmedMessage("Bia Teste", new Date("2026-11-21T02:59:00Z")),
    ).toBe("Esta passagem já foi confirmada por Bia Teste às 23:59.");
  });
});
