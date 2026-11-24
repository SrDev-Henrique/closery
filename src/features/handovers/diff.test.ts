import { describe, expect, it } from "vitest";

import {
  correctionFieldLabel,
  diffHandover,
  displayCorrectionValue,
  type HandoverValues,
} from "./diff";

const ITEM_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ITEM_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const E_DECOMPOSED = "e\u{301}";
const E_COMPOSED = "\u{e9}";

const CURRENT: HandoverValues = {
  occurrencesText: "Nada de especial",
  nextShiftText: "Conferir a rede",
  items: [
    { itemId: ITEM_A, quantity: 3, note: null },
    { itemId: ITEM_B, quantity: 10, note: "caixa aberta" },
  ],
};

function next(overrides: Partial<HandoverValues>): HandoverValues {
  return { ...CURRENT, ...overrides };
}

describe("diffHandover", () => {
  it("sem nenhuma mudança: []", () => {
    expect(diffHandover(CURRENT, CURRENT)).toEqual([]);
  });

  it("muda o texto de ocorrências", () => {
    expect(
      diffHandover(CURRENT, next({ occurrencesText: "Rede rasgada" })),
    ).toEqual([
      {
        field: "occurrences_text",
        itemId: null,
        oldValue: "Nada de especial",
        newValue: "Rede rasgada",
      },
    ]);
  });

  it("texto igual depois da normalização (NFC e \\r\\n) não é mudança", () => {
    expect(
      diffHandover(
        { ...CURRENT, occurrencesText: `caf${E_COMPOSED}\nfim` },
        { ...CURRENT, occurrencesText: `caf${E_DECOMPOSED}\r\nfim` },
      ),
    ).toEqual([]);
  });

  it("muda a quantidade: antigo e novo como texto (zerar também é mudança)", () => {
    expect(
      diffHandover(
        CURRENT,
        next({
          items: [
            { itemId: ITEM_A, quantity: 4, note: null },
            { itemId: ITEM_B, quantity: 0, note: "caixa aberta" },
          ],
        }),
      ),
    ).toEqual([
      { field: "item_quantity", itemId: ITEM_A, oldValue: "3", newValue: "4" },
      { field: "item_quantity", itemId: ITEM_B, oldValue: "10", newValue: "0" },
    ]);
  });

  it("nota null e nota vazia são o mesmo valor", () => {
    expect(
      diffHandover(CURRENT, {
        ...CURRENT,
        items: [
          { itemId: ITEM_A, quantity: 3, note: "" },
          { itemId: ITEM_B, quantity: 10, note: "caixa aberta" },
        ],
      }),
    ).toEqual([]);
    expect(
      diffHandover(
        { ...CURRENT, items: [{ itemId: ITEM_A, quantity: 3, note: "" }] },
        { ...CURRENT, items: [{ itemId: ITEM_A, quantity: 3, note: null }] },
      ),
    ).toEqual([]);
  });

  it("nota nova, nota trocada e nota apagada", () => {
    expect(
      diffHandover(
        CURRENT,
        next({
          items: [
            { itemId: ITEM_A, quantity: 3, note: "rasgada" },
            { itemId: ITEM_B, quantity: 10, note: null },
          ],
        }),
      ),
    ).toEqual([
      { field: "item_note", itemId: ITEM_A, oldValue: "", newValue: "rasgada" },
      {
        field: "item_note",
        itemId: ITEM_B,
        oldValue: "caixa aberta",
        newValue: "",
      },
    ]);
  });

  it("ordem: ocorrências, próximo turno, depois cada item (quantidade e nota)", () => {
    const result = diffHandover(CURRENT, {
      occurrencesText: "X",
      nextShiftText: "Y",
      items: [
        { itemId: ITEM_B, quantity: 11, note: "outra" },
        { itemId: ITEM_A, quantity: 5, note: "nova" },
      ],
    });
    expect(result.map((change) => [change.field, change.itemId])).toEqual([
      ["occurrences_text", null],
      ["next_shift_text", null],
      ["item_quantity", ITEM_A],
      ["item_note", ITEM_A],
      ["item_quantity", ITEM_B],
      ["item_note", ITEM_B],
    ]);
  });

  it("item ausente em `next` fica inalterado", () => {
    expect(
      diffHandover(
        CURRENT,
        next({ items: [{ itemId: ITEM_A, quantity: 3, note: null }] }),
      ),
    ).toEqual([]);
    expect(diffHandover(CURRENT, next({ items: [] }))).toEqual([]);
  });
});

describe("correctionFieldLabel", () => {
  it("rótulos dos campos de texto", () => {
    expect(correctionFieldLabel("occurrences_text", null)).toBe(
      "Ocorrências do turno",
    );
    expect(correctionFieldLabel("next_shift_text", null)).toBe(
      "Fica para o próximo turno",
    );
  });

  it("rótulos dos campos de item levam o nome do item", () => {
    expect(correctionFieldLabel("item_quantity", "Rede de proteção")).toBe(
      "Rede de proteção: quantidade",
    );
    expect(correctionFieldLabel("item_note", "Rede de proteção")).toBe(
      "Rede de proteção: observação",
    );
  });

  it('item sem nome conhecido cai para "Item"', () => {
    expect(correctionFieldLabel("item_quantity", null)).toBe(
      "Item: quantidade",
    );
  });
});

describe("displayCorrectionValue", () => {
  it("vazio vira (vazio); o resto passa direto", () => {
    expect(displayCorrectionValue("")).toBe("(vazio)");
    expect(displayCorrectionValue("0")).toBe("0");
    expect(displayCorrectionValue("texto")).toBe("texto");
  });
});
