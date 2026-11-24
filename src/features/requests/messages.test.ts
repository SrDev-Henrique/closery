import { describe, expect, it } from "vitest";

import { MAX_QUANTITY } from "@/features/handovers/limits";
import { formatQuantity } from "@/features/handovers/quantity";

import {
  CANCEL_REASON_MAX_LENGTH,
  COMMENT_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  DESTINATION_OTHER_MAX_LENGTH,
  REQUEST_ITEMS_MAX,
} from "./limits";
import {
  alreadyCancelledMessage,
  alreadyMovedMessage,
  CANCEL_NEEDS_REASON_MESSAGE,
  CANCEL_REASON_LOCKED_MESSAGE,
  CANCEL_REASON_REQUIRED_MESSAGE,
  CANCEL_REASON_TOO_LONG_MESSAGE,
  COMMENT_DELETE_FORBIDDEN_MESSAGE,
  COMMENT_NOT_FOUND_MESSAGE,
  COMMENT_REQUIRED_MESSAGE,
  COMMENT_TOO_LONG_MESSAGE,
  DESCRIPTION_REQUIRED_MESSAGE,
  DESCRIPTION_TOO_LONG_MESSAGE,
  DESTINATION_INACTIVE_MESSAGE,
  DESTINATION_OTHER_REQUIRED_MESSAGE,
  DESTINATION_OTHER_TOO_LONG_MESSAGE,
  INVALID_STATUS_MESSAGE,
  ITEM_NOT_ALLOWED_MESSAGE,
  ITEM_QUANTITY_MESSAGE,
  movedToastMessage,
  moveFailedToastMessage,
  ORIGIN_LOCKED_MESSAGE,
  ORIGIN_SECTOR_MISMATCH_MESSAGE,
  REQUEST_NOT_FOUND_MESSAGE,
  sameStatusMessage,
  statusConflictMessage,
  TOO_MANY_ITEMS_MESSAGE,
} from "./messages";

describe("mensagens fixas (os testes de tela e o E2E dependem do texto exato)", () => {
  it.each([
    [
      REQUEST_NOT_FOUND_MESSAGE,
      "Solicitação não encontrada. Atualize a página.",
    ],
    [
      COMMENT_NOT_FOUND_MESSAGE,
      "Comentário não encontrado. Atualize a página.",
    ],
    [DESTINATION_INACTIVE_MESSAGE, "Este destino está inativo. Escolha outro."],
    [DESTINATION_OTHER_REQUIRED_MESSAGE, "Informe o destino."],
    [DESCRIPTION_REQUIRED_MESSAGE, "Descreva a solicitação."],
    [
      ORIGIN_SECTOR_MISMATCH_MESSAGE,
      "A solicitação precisa ser do setor da passagem. Atualize a página.",
    ],
    [
      ORIGIN_LOCKED_MESSAGE,
      "Esta passagem já foi confirmada. Crie a solicitação pela tela Solicitações.",
    ],
    [INVALID_STATUS_MESSAGE, "Status inválido. Atualize a página."],
    [
      CANCEL_NEEDS_REASON_MESSAGE,
      "Para cancelar, use “Cancelar solicitação” e informe o motivo.",
    ],
    [CANCEL_REASON_REQUIRED_MESSAGE, "Informe o motivo do cancelamento."],
    [COMMENT_REQUIRED_MESSAGE, "Escreva o comentário."],
    [
      COMMENT_DELETE_FORBIDDEN_MESSAGE,
      "Só quem escreveu o comentário pode apagá-lo.",
    ],
    [
      CANCEL_REASON_LOCKED_MESSAGE,
      "O motivo do cancelamento não pode ser apagado.",
    ],
    [ITEM_NOT_ALLOWED_MESSAGE, "Escolha um item de estoque ativo deste setor."],
  ])("%s", (actual, expected) => {
    expect(actual).toBe(expected);
  });
});

describe("os números das mensagens batem com os limites", () => {
  it("descrição, motivo, destino, comentário, itens e quantidade", () => {
    expect(DESCRIPTION_TOO_LONG_MESSAGE).toBe(
      `A descrição pode ter no máximo ${DESCRIPTION_MAX_LENGTH} caracteres.`,
    );
    expect(CANCEL_REASON_TOO_LONG_MESSAGE).toBe(
      `O motivo pode ter no máximo ${CANCEL_REASON_MAX_LENGTH} caracteres.`,
    );
    expect(DESTINATION_OTHER_TOO_LONG_MESSAGE).toBe(
      `O destino pode ter no máximo ${DESTINATION_OTHER_MAX_LENGTH} caracteres.`,
    );
    expect(COMMENT_TOO_LONG_MESSAGE).toBe(
      `O comentário pode ter no máximo ${formatQuantity(COMMENT_MAX_LENGTH)} caracteres.`,
    );
    expect(TOO_MANY_ITEMS_MESSAGE).toBe(
      `Uma solicitação pode ter no máximo ${REQUEST_ITEMS_MAX} itens.`,
    );
    expect(ITEM_QUANTITY_MESSAGE).toBe(
      `Informe um número inteiro de 1 a ${formatQuantity(MAX_QUANTITY)}.`,
    );
  });
});

describe("mensagens com nome, status e hora", () => {
  // 2026-11-20 17:05 UTC = 14:05 em São Paulo.
  const AT = new Date("2026-11-20T17:05:00Z");

  it("sameStatusMessage usa o rótulo do status", () => {
    expect(sameStatusMessage("in_transit")).toBe(
      "O status desta solicitação já é Em separação / Trânsito.",
    );
    expect(sameStatusMessage("cancelled")).toBe(
      "O status desta solicitação já é Cancelada.",
    );
  });

  it("alreadyMovedMessage: quem e quando, data e hora de São Paulo", () => {
    expect(alreadyMovedMessage("delivered", "Ana Teste", AT)).toBe(
      "Esta solicitação já foi movida para Entregue por Ana Teste em 20/11/2026 às 14:05.",
    );
  });

  it("alreadyCancelledMessage", () => {
    expect(alreadyCancelledMessage("Bia Teste", AT)).toBe(
      "Esta solicitação já foi cancelada por Bia Teste em 20/11/2026 às 14:05.",
    );
  });

  it("statusConflictMessage pede para conferir", () => {
    expect(statusConflictMessage("in_transit", "Ana Teste", AT)).toBe(
      "Esta solicitação mudou para Em separação / Trânsito por Ana Teste em 20/11/2026 às 14:05. Confira e tente de novo.",
    );
  });

  it("a data é a de São Paulo, não a de UTC (meia-noite)", () => {
    // 2026-11-21 02:30 UTC = 20/11 23:30 em São Paulo.
    const late = new Date("2026-11-21T02:30:00Z");
    expect(alreadyCancelledMessage("Ana Teste", late)).toBe(
      "Esta solicitação já foi cancelada por Ana Teste em 20/11/2026 às 23:30.",
    );
    // 2026-11-21 03:00 UTC = 21/11 00:00 em São Paulo.
    const midnight = new Date("2026-11-21T03:00:00Z");
    expect(alreadyCancelledMessage("Ana Teste", midnight)).toBe(
      "Esta solicitação já foi cancelada por Ana Teste em 21/11/2026 às 00:00.",
    );
  });
});

describe("toasts do movimento", () => {
  it("sucesso nomeia a solicitação e o status", () => {
    expect(movedToastMessage("Rede para a doca", "delivered")).toBe(
      "“Rede para a doca” movida para Entregue.",
    );
  });

  it("falha nomeia a solicitação e repete a mensagem do servidor", () => {
    expect(
      moveFailedToastMessage(
        "Rede para a doca",
        "Solicitação não encontrada. Atualize a página.",
      ),
    ).toBe(
      "Não foi possível mover “Rede para a doca”. Solicitação não encontrada. Atualize a página.",
    );
  });
});
