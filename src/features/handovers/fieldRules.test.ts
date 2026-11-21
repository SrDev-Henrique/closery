import { describe, expect, it } from "vitest";

import {
  codePointLength,
  normalizeFreeText,
  normalizeItemNote,
  normalizeOptionalText,
  normalizeReason,
  validateFieldChange,
} from "./fieldRules";
import { ITEM_NOTE_MAX_LENGTH, MAX_QUANTITY, TEXT_MAX_LENGTH } from "./limits";
import {
  NOTE_TOO_LONG_MESSAGE,
  QUANTITY_MESSAGE,
  TEXT_TOO_LONG_MESSAGE,
} from "./messages";

const ITEM_ID = "33333333-3333-4333-8333-333333333333";
// "e" + acento combinante: a forma decomposta (NFD) de "é".
const E_DECOMPOSED = "e\u{301}";
const E_COMPOSED = "\u{e9}";

describe("codePointLength", () => {
  it("conta pontos de código, não unidades UTF-16", () => {
    expect(codePointLength("")).toBe(0);
    expect(codePointLength("abc")).toBe(3);
    expect(codePointLength("\u{1f600}")).toBe(1);
    expect("\u{1f600}".length).toBe(2);
    expect(codePointLength("a\u{1f600}b")).toBe(3);
  });
});

describe("normalizeFreeText", () => {
  it("troca \\r\\n e \\r por \\n", () => {
    expect(normalizeFreeText("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
  });

  it("não faz trim: o texto vale como foi digitado", () => {
    expect(normalizeFreeText("  oi  \n")).toBe("  oi  \n");
    expect(normalizeFreeText("")).toBe("");
  });
});

describe("normalizeItemNote", () => {
  it("colapsa espaços e quebras e faz trim", () => {
    expect(normalizeItemNote("  rede   rasgada \n no canto ")).toBe(
      "rede rasgada no canto",
    );
  });

  it("vazio ou só espaços vira null", () => {
    expect(normalizeItemNote("")).toBeNull();
    expect(normalizeItemNote("   \n\t ")).toBeNull();
    expect(normalizeItemNote("\u{a0}")).toBeNull();
  });
});

describe("normalizeOptionalText", () => {
  it("faz trim, preserva as quebras de linha e troca \\r\\n", () => {
    expect(normalizeOptionalText("  linha 1\r\nlinha 2  ")).toBe(
      "linha 1\nlinha 2",
    );
  });

  it("vazio ou só espaços vira null", () => {
    expect(normalizeOptionalText("")).toBeNull();
    expect(normalizeOptionalText("  \n ")).toBeNull();
  });
});

describe("normalizeReason", () => {
  it("faz trim, NFC e \\r\\n; pode sobrar string vazia", () => {
    expect(normalizeReason(`  ${E_DECOMPOSED}rro\r\nde digitação `)).toBe(
      `${E_COMPOSED}rro\nde digitação`,
    );
    expect(normalizeReason("   ")).toBe("");
    expect(normalizeReason("")).toBe("");
  });
});

describe("validateFieldChange", () => {
  describe("quantidade", () => {
    it.each([0, 1, 12, MAX_QUANTITY])("aceita %i", (value) => {
      expect(
        validateFieldChange({ field: "quantity", itemId: ITEM_ID, value }),
      ).toEqual({
        ok: true,
        change: { field: "quantity", itemId: ITEM_ID, value },
      });
    });

    it.each([
      -1,
      1.5,
      MAX_QUANTITY + 1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ])("recusa %s", (value) => {
      expect(
        validateFieldChange({ field: "quantity", itemId: ITEM_ID, value }),
      ).toEqual({ ok: false, message: QUANTITY_MESSAGE });
    });
  });

  describe("textos livres", () => {
    it.each([
      "occurrences",
      "nextShift",
    ] as const)("%s: aceita vazio e devolve o texto normalizado (NFC e \\n)", (field) => {
      expect(validateFieldChange({ field, value: "" })).toEqual({
        ok: true,
        change: { field, value: "" },
      });
      expect(
        validateFieldChange({ field, value: `${E_DECOMPOSED}\r\n ok ` }),
      ).toEqual({
        ok: true,
        change: { field, value: `${E_COMPOSED}\n ok ` },
      });
    });

    it("aceita exatamente 2.000 pontos de código e recusa 2.001", () => {
      const limit = "a".repeat(TEXT_MAX_LENGTH);
      expect(
        validateFieldChange({ field: "occurrences", value: limit }).ok,
      ).toBe(true);
      expect(
        validateFieldChange({ field: "occurrences", value: `${limit}a` }),
      ).toEqual({ ok: false, message: TEXT_TOO_LONG_MESSAGE });
    });

    it("conta emoji como 1: 2.000 emojis passam, 2.001 não", () => {
      const emoji = "\u{1f600}";
      expect(
        validateFieldChange({
          field: "nextShift",
          value: emoji.repeat(TEXT_MAX_LENGTH),
        }).ok,
      ).toBe(true);
      expect(
        validateFieldChange({
          field: "nextShift",
          value: emoji.repeat(TEXT_MAX_LENGTH + 1),
        }),
      ).toEqual({ ok: false, message: TEXT_TOO_LONG_MESSAGE });
    });
  });

  describe("observação do item", () => {
    it('devolve a nota normalizada, com "" no lugar de null', () => {
      expect(
        validateFieldChange({
          field: "note",
          itemId: ITEM_ID,
          value: "  rede   rasgada ",
        }),
      ).toEqual({
        ok: true,
        change: { field: "note", itemId: ITEM_ID, value: "rede rasgada" },
      });
      expect(
        validateFieldChange({ field: "note", itemId: ITEM_ID, value: "   " }),
      ).toEqual({
        ok: true,
        change: { field: "note", itemId: ITEM_ID, value: "" },
      });
    });

    it("aceita 200 e recusa 201 caracteres", () => {
      expect(
        validateFieldChange({
          field: "note",
          itemId: ITEM_ID,
          value: "n".repeat(ITEM_NOTE_MAX_LENGTH),
        }).ok,
      ).toBe(true);
      expect(
        validateFieldChange({
          field: "note",
          itemId: ITEM_ID,
          value: "n".repeat(ITEM_NOTE_MAX_LENGTH + 1),
        }),
      ).toEqual({ ok: false, message: NOTE_TOO_LONG_MESSAGE });
    });
  });
});
