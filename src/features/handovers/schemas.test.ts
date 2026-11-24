import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";

import {
  type FieldErrors,
  INVALID_INPUT_MESSAGE,
} from "@/features/admin/result";
import { firstFieldErrors } from "@/features/admin/schemas";

import {
  chooseSectorSchema,
  confirmHandoverSchema,
  correctHandoverSchema,
  deliverHandoverSchema,
  handoverRefSchema,
  isoDateSchema,
  saveFieldSchema,
} from "./schemas";

const SECTOR = "00000000-0000-4000-8000-000000000001";
const SHIFT = "00000000-0000-4000-8000-000000000002";
const ITEM = "00000000-0000-4000-8000-000000000003";
const OTHER_ITEM = "00000000-0000-4000-8000-000000000004";
const HANDOVER = "00000000-0000-4000-8000-000000000005";
const REF = { sectorId: SECTOR, shiftId: SHIFT, operationalDate: "2026-11-20" };

function errorsOf(schema: ZodType, input: unknown): FieldErrors {
  const parsed = schema.safeParse(input);
  return parsed.success ? {} : firstFieldErrors(parsed.error);
}

describe("isoDateSchema", () => {
  it("aceita data real", () => {
    expect(isoDateSchema.safeParse("2026-11-20").success).toBe(true);
  });

  it.each([
    "2026-02-30",
    "20/11/2026",
    "",
    "2026-13-01",
    "2026-11-2",
  ])("recusa %j com a mensagem em pt-BR", (value) => {
    const parsed = isoDateSchema.safeParse(value);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("Data inválida.");
  });

  it("recusa o que nem é texto", () => {
    expect(isoDateSchema.safeParse(20261120).success).toBe(false);
  });
});

describe("handoverRefSchema e deliverHandoverSchema", () => {
  it("aceita a tripla", () => {
    expect(handoverRefSchema.parse(REF)).toEqual(REF);
    expect(deliverHandoverSchema.parse(REF)).toEqual(REF);
  });

  it("id malformado e data inválida dão mensagens por campo", () => {
    expect(
      errorsOf(handoverRefSchema, {
        sectorId: "x",
        shiftId: SHIFT,
        operationalDate: "2026-02-30",
      }),
    ).toEqual({
      sectorId: "Registro inválido. Atualize a página.",
      operationalDate: "Data inválida.",
    });
  });
});

describe("saveFieldSchema", () => {
  it("quantidade: 0 e o teto passam", () => {
    for (const value of [0, 1, 99_999]) {
      const parsed = saveFieldSchema.parse({
        ...REF,
        field: "quantity",
        itemId: ITEM,
        value,
      });
      expect(parsed).toEqual({
        ...REF,
        field: "quantity",
        itemId: ITEM,
        value,
      });
    }
  });

  it.each([
    -1,
    1.5,
    100_000,
    Number.NaN,
    "3",
    null,
  ])("quantidade %j é recusada com a mensagem do campo value", (value) => {
    expect(
      errorsOf(saveFieldSchema, {
        ...REF,
        field: "quantity",
        itemId: ITEM,
        value,
      }),
    ).toEqual({ value: "Informe um número inteiro de 0 a 99.999." });
  });

  it("texto: devolve o valor normalizado (NFC, quebra de linha), sem trim", () => {
    const parsed = saveFieldSchema.parse({
      ...REF,
      field: "occurrences",
      value: "  e\u{301}\r\nlinha  ",
    });
    expect(parsed).toEqual({
      ...REF,
      field: "occurrences",
      value: "  \u{e9}\nlinha  ",
    });
  });

  it("texto: 2.000 pontos de código passam; 2.001 com emoji não", () => {
    const limit = "😀".repeat(2000);
    expect(
      saveFieldSchema.safeParse({ ...REF, field: "nextShift", value: limit })
        .success,
    ).toBe(true);
    expect(
      errorsOf(saveFieldSchema, {
        ...REF,
        field: "nextShift",
        value: `${limit}😀`,
      }),
    ).toEqual({ value: "O texto pode ter no máximo 2.000 caracteres." });
  });

  it("nota: espaços colapsam, quebra de linha vira espaço, vazio vira ''", () => {
    const parsed = saveFieldSchema.parse({
      ...REF,
      field: "note",
      itemId: ITEM,
      value: "  rede\n  rasgada  ",
    });
    expect(parsed).toMatchObject({ field: "note", value: "rede rasgada" });
    const empty = saveFieldSchema.parse({
      ...REF,
      field: "note",
      itemId: ITEM,
      value: "   ",
    });
    expect(empty).toMatchObject({ value: "" });
  });

  it("nota: 201 caracteres é recusada", () => {
    expect(
      errorsOf(saveFieldSchema, {
        ...REF,
        field: "note",
        itemId: ITEM,
        value: "a".repeat(201),
      }),
    ).toEqual({ value: "A observação pode ter no máximo 200 caracteres." });
  });

  it("campo desconhecido, item sem id e tripla inválida são recusados", () => {
    expect(
      saveFieldSchema.safeParse({ ...REF, field: "outro", value: "x" }).success,
    ).toBe(false);
    expect(
      saveFieldSchema.safeParse({ ...REF, field: "quantity", value: 1 })
        .success,
    ).toBe(false);
    expect(
      saveFieldSchema.safeParse({
        ...REF,
        operationalDate: "2026-02-30",
        field: "occurrences",
        value: "",
      }).success,
    ).toBe(false);
  });
});

describe("confirmHandoverSchema", () => {
  it("observação vazia ou só espaços vira null; texto sai aparado", () => {
    expect(confirmHandoverSchema.parse({ id: HANDOVER, note: "   " })).toEqual({
      id: HANDOVER,
      note: null,
    });
    expect(
      confirmHandoverSchema.parse({ id: HANDOVER, note: "  tudo certo \r\n" }),
    ).toEqual({ id: HANDOVER, note: "tudo certo" });
  });

  it("500 caracteres passam; 501 não, com erro no campo note", () => {
    expect(
      confirmHandoverSchema.safeParse({ id: HANDOVER, note: "a".repeat(500) })
        .success,
    ).toBe(true);
    expect(
      errorsOf(confirmHandoverSchema, { id: HANDOVER, note: "a".repeat(501) }),
    ).toEqual({ note: "A observação pode ter no máximo 500 caracteres." });
  });

  it("id malformado é recusado", () => {
    expect(errorsOf(confirmHandoverSchema, { id: "x", note: "" })).toEqual({
      id: "Registro inválido. Atualize a página.",
    });
  });
});

describe("correctHandoverSchema", () => {
  const valid = {
    id: HANDOVER,
    reason: "  Contagem errada  ",
    occurrencesText: "a",
    nextShiftText: "b",
    items: [{ itemId: ITEM, quantity: 3, note: "  obs  " }],
  };

  it("normaliza motivo e nota; mantém textos e quantidade", () => {
    expect(correctHandoverSchema.parse(valid)).toEqual({
      ...valid,
      reason: "Contagem errada",
      items: [{ itemId: ITEM, quantity: 3, note: "obs" }],
    });
  });

  it("nota vazia vira string vazia (nunca null)", () => {
    const parsed = correctHandoverSchema.parse({
      ...valid,
      items: [{ itemId: ITEM, quantity: 0, note: "  " }],
    });
    expect(parsed.items[0]?.note).toBe("");
  });

  it("motivo vazio ou só espaços: Informe o motivo da correção.", () => {
    for (const reason of ["", "   \n "]) {
      expect(errorsOf(correctHandoverSchema, { ...valid, reason })).toEqual({
        reason: "Informe o motivo da correção.",
      });
    }
  });

  it("motivo: 500 passam; 501 não", () => {
    expect(
      correctHandoverSchema.safeParse({ ...valid, reason: "a".repeat(500) })
        .success,
    ).toBe(true);
    expect(
      errorsOf(correctHandoverSchema, { ...valid, reason: "a".repeat(501) }),
    ).toEqual({ reason: "O motivo pode ter no máximo 500 caracteres." });
  });

  it("item repetido recusa com a mensagem em items", () => {
    expect(
      errorsOf(correctHandoverSchema, {
        ...valid,
        items: [
          { itemId: ITEM, quantity: 1, note: "" },
          { itemId: ITEM, quantity: 2, note: "" },
        ],
      }),
    ).toEqual({ items: "Item repetido. Atualize a página." });
  });

  it("quantidade fora do limite e nota longa recusam em items", () => {
    expect(
      errorsOf(correctHandoverSchema, {
        ...valid,
        items: [{ itemId: ITEM, quantity: 100_000, note: "" }],
      }),
    ).toEqual({ items: "Informe um número inteiro de 0 a 99.999." });
    expect(
      errorsOf(correctHandoverSchema, {
        ...valid,
        items: [{ itemId: ITEM, quantity: 1, note: "a".repeat(201) }],
      }),
    ).toEqual({ items: "A observação pode ter no máximo 200 caracteres." });
  });

  it("texto acima de 2.000 pontos de código recusa; lista vazia é permitida", () => {
    expect(
      errorsOf(correctHandoverSchema, {
        ...valid,
        occurrencesText: "a".repeat(2001),
      }),
    ).toEqual({
      occurrencesText: "O texto pode ter no máximo 2.000 caracteres.",
    });
    expect(
      correctHandoverSchema.safeParse({ ...valid, items: [] }).success,
    ).toBe(true);
  });

  it("dois itens diferentes passam", () => {
    expect(
      correctHandoverSchema.safeParse({
        ...valid,
        items: [
          { itemId: ITEM, quantity: 1, note: "" },
          { itemId: OTHER_ITEM, quantity: 2, note: "" },
        ],
      }).success,
    ).toBe(true);
  });
});

describe("chooseSectorSchema", () => {
  it("aceita setor, 'todos' e os três caminhos", () => {
    for (const path of ["/", "/passagens", "/passagens/nova"]) {
      expect(
        chooseSectorSchema.safeParse({ sectorId: SECTOR, path }).success,
      ).toBe(true);
    }
    expect(
      chooseSectorSchema.safeParse({ sectorId: "todos", path: "/passagens" })
        .success,
    ).toBe(true);
  });

  it("recusa caminho fora da lista e setor malformado", () => {
    expect(
      chooseSectorSchema.safeParse({ sectorId: SECTOR, path: "//evil.test" })
        .success,
    ).toBe(false);
    expect(
      chooseSectorSchema.safeParse({ sectorId: "x", path: "/" }).success,
    ).toBe(false);
  });
});

describe("mensagens em pt-BR para entrada adulterada (nunca o inglês do Zod)", () => {
  function messagesOf(schema: ZodType, input: unknown): string[] {
    const parsed = schema.safeParse(input);
    return parsed.success ? [] : parsed.error.issues.map((i) => i.message);
  }

  it("campo desconhecido no salvamento", () => {
    expect(
      messagesOf(saveFieldSchema, { ...REF, field: "inexistente", value: "x" }),
    ).toEqual([INVALID_INPUT_MESSAGE]);
  });

  it("linha de item nula na correção", () => {
    expect(
      messagesOf(correctHandoverSchema, {
        id: HANDOVER,
        reason: "motivo",
        occurrencesText: "a",
        nextShiftText: "b",
        items: [null],
      }),
    ).toEqual([INVALID_INPUT_MESSAGE]);
  });

  it("setor que não é id nem 'todos'", () => {
    expect(
      messagesOf(chooseSectorSchema, { sectorId: 123, path: "/" }),
    ).toEqual([INVALID_INPUT_MESSAGE]);
  });
});
