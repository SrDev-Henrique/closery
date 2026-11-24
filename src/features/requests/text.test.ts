import { describe, expect, it } from "vitest";

import {
  codePointLength,
  normalizeReason,
} from "@/features/handovers/fieldRules";

import { PREVIEW_LENGTH } from "./limits";
import {
  boardSummary,
  commentCountLabel,
  destinationLabel,
  itemCountLabel,
  normalizeDestinationOther,
  normalizeRequestText,
  openCountLabel,
  requestPreview,
  staleCountLabel,
  tableSummary,
} from "./text";

describe("normalizeRequestText", () => {
  it("é a mesma regra do motivo da passagem (NFC, \\n, trim)", () => {
    for (const raw of [
      "",
      "   ",
      "  Rede\r\nde\rproteção  ",
      "cafe\u{301}",
      "a\n\nb",
    ]) {
      expect(normalizeRequestText(raw)).toBe(normalizeReason(raw));
    }
  });

  it("quebras de linha viram \\n, NFD vira NFC, pontas saem", () => {
    expect(normalizeRequestText("  a\r\nb\rc  ")).toBe("a\nb\nc");
    expect(normalizeRequestText("cafe\u{301}")).toBe("café");
  });
});

describe("normalizeDestinationOther", () => {
  it("colapsa espaços e quebras, tira as pontas, NFC", () => {
    expect(normalizeDestinationOther("  Doca \n  9  ")).toBe("Doca 9");
    expect(normalizeDestinationOther("Se\u{301}")).toBe("Sé");
  });

  it("só espaços ou vazio dão vazio", () => {
    expect(normalizeDestinationOther("")).toBe("");
    expect(normalizeDestinationOther(" \n\t ")).toBe("");
  });
});

describe("requestPreview", () => {
  it("texto curto passa como está (espaços colapsados)", () => {
    expect(requestPreview("Rede   de proteção")).toBe("Rede de proteção");
  });

  it("só a primeira linha", () => {
    expect(requestPreview("Rede para a doca\nUrgente\r\nobrigado")).toBe(
      "Rede para a doca",
    );
  });

  it("pula linhas em branco do começo", () => {
    expect(requestPreview("\n\n  Rede  \nsegunda")).toBe("Rede");
  });

  it("vazio e só espaços dão vazio", () => {
    expect(requestPreview("")).toBe("");
    expect(requestPreview("  \n  ")).toBe("");
  });

  it("60 pontos de código passam; 61 são cortados em 59 + …", () => {
    const sixty = "a".repeat(PREVIEW_LENGTH);
    expect(requestPreview(sixty)).toBe(sixty);
    const cut = requestPreview(`${sixty}b`);
    expect(cut).toBe(`${"a".repeat(PREVIEW_LENGTH - 1)}…`);
    expect(codePointLength(cut)).toBe(PREVIEW_LENGTH);
  });

  it("emoji conta 1 e nunca é partido ao meio", () => {
    const sixty = "🙂".repeat(PREVIEW_LENGTH);
    expect(requestPreview(sixty)).toBe(sixty);
    expect(requestPreview(`${sixty}🙂`)).toBe(
      `${"🙂".repeat(PREVIEW_LENGTH - 1)}…`,
    );
  });

  it("o corte que cai num espaço não deixa espaço antes do …", () => {
    const text = `${"a".repeat(PREVIEW_LENGTH - 2)} bcd`;
    expect(requestPreview(text)).toBe(`${"a".repeat(PREVIEW_LENGTH - 2)}…`);
  });
});

describe("rótulos de contagem", () => {
  it.each([
    [itemCountLabel, 0, "0 itens"],
    [itemCountLabel, 1, "1 item"],
    [itemCountLabel, 2, "2 itens"],
    [commentCountLabel, 1, "1 comentário"],
    [commentCountLabel, 3, "3 comentários"],
    [openCountLabel, 0, "0 abertas"],
    [openCountLabel, 1, "1 aberta"],
    [staleCountLabel, 1, "1 parada"],
    [staleCountLabel, 2, "2 paradas"],
  ] as const)("%#", (label, count, expected) => {
    expect(label(count)).toBe(expected);
  });
});

describe("boardSummary", () => {
  it("plural e o sufixo da janela de 30 dias", () => {
    expect(
      boardSummary({ requested: 3, in_transit: 1, delivered: 5 }, true),
    ).toBe(
      "3 solicitadas · 1 em separação / trânsito · 5 entregues nos últimos 30 dias",
    );
  });

  it("singular e sem sufixo quando há período escolhido", () => {
    expect(
      boardSummary({ requested: 1, in_transit: 1, delivered: 1 }, false),
    ).toBe("1 solicitada · 1 em separação / trânsito · 1 entregue");
  });

  it("zeros", () => {
    expect(
      boardSummary({ requested: 0, in_transit: 0, delivered: 0 }, true),
    ).toBe(
      "0 solicitadas · 0 em separação / trânsito · 0 entregues nos últimos 30 dias",
    );
  });
});

describe("tableSummary", () => {
  it("singular só no 1", () => {
    expect(tableSummary(0)).toBe("0 solicitações");
    expect(tableSummary(1)).toBe("1 solicitação");
    expect(tableSummary(12)).toBe("12 solicitações");
  });
});

describe("destinationLabel", () => {
  it("o texto do Outro ganha a marca; o da lista não", () => {
    expect(destinationLabel("Doca 9", true)).toBe("Doca 9 (outro destino)");
    expect(destinationLabel("Doca 3", false)).toBe("Doca 3");
  });
});
