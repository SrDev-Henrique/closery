import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";

import {
  type FieldErrors,
  INVALID_INPUT_MESSAGE,
} from "@/features/admin/result";
import { firstFieldErrors } from "@/features/admin/schemas";
import { MAX_QUANTITY } from "@/features/handovers/limits";
import { DUPLICATE_ITEM_MESSAGE } from "@/features/handovers/messages";

import {
  CANCEL_REASON_MAX_LENGTH,
  COMMENT_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  DESTINATION_OTHER_MAX_LENGTH,
  REQUEST_ITEMS_MAX,
} from "./limits";
import {
  CANCEL_NEEDS_REASON_MESSAGE,
  CANCEL_REASON_REQUIRED_MESSAGE,
  CANCEL_REASON_TOO_LONG_MESSAGE,
  COMMENT_REQUIRED_MESSAGE,
  COMMENT_TOO_LONG_MESSAGE,
  DESCRIPTION_REQUIRED_MESSAGE,
  DESCRIPTION_TOO_LONG_MESSAGE,
  DESTINATION_OTHER_REQUIRED_MESSAGE,
  DESTINATION_OTHER_TOO_LONG_MESSAGE,
  INVALID_STATUS_MESSAGE,
  ITEM_QUANTITY_MESSAGE,
  ORIGIN_SECTOR_MISMATCH_MESSAGE,
  TOO_MANY_ITEMS_MESSAGE,
} from "./messages";
import {
  addCommentSchema,
  cancelRequestSchema,
  createRequestSchema,
  deleteCommentSchema,
  moveRequestSchema,
  requestItemInputSchema,
  requestStatusSchema,
} from "./schemas";

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const SECTOR = uuid(1);
const OTHER_SECTOR = uuid(2);
const DESTINATION = uuid(3);
const SHIFT = uuid(4);
const ITEM = uuid(5);
const INVALID_ID_MESSAGE = "Registro inválido. Atualize a página.";

const ORIGIN = {
  sectorId: SECTOR,
  shiftId: SHIFT,
  operationalDate: "2026-11-20",
};

const VALID_CREATE = {
  sectorId: SECTOR,
  destinationId: DESTINATION,
  destinationOther: "",
  description: "Rede para a doca",
  items: [],
  originRef: null,
};

// O texto padrão do Zod é inglês e nunca pode chegar à tela.
const ZOD_DEFAULT = /Invalid|Too (big|small)|expected|received|Required/i;

function issuesOf(schema: ZodType, input: unknown) {
  const parsed = schema.safeParse(input);
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

function errorsOf(schema: ZodType, input: unknown): FieldErrors {
  const parsed = schema.safeParse(input);
  return parsed.success ? {} : firstFieldErrors(parsed.error);
}

// A primeira mensagem do runner: issue com path vazio vira a genérica.
function firstMessage(schema: ZodType, input: unknown): string | null {
  const issue = issuesOf(schema, input)[0];
  if (!issue) return null;
  return issue.path === "" ? INVALID_INPUT_MESSAGE : issue.message;
}

function expectNoZodDefault(schema: ZodType, input: unknown) {
  const issues = issuesOf(schema, input);
  expect(issues.length).toBeGreaterThan(0);
  for (const issue of issues) expect(issue.message).not.toMatch(ZOD_DEFAULT);
}

describe("requestStatusSchema", () => {
  it.each([
    "requested",
    "in_transit",
    "delivered",
    "cancelled",
  ])("aceita %s", (status) => {
    expect(requestStatusSchema.parse(status)).toBe(status);
  });

  it.each([
    "archived",
    "",
    "REQUESTED",
    1,
    null,
    undefined,
  ])("recusa %j com a mensagem em pt-BR", (status) => {
    const issues = issuesOf(requestStatusSchema, status);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toBe(INVALID_STATUS_MESSAGE);
  });
});

describe("requestItemInputSchema", () => {
  it.each([1, 2, 12, MAX_QUANTITY])("aceita quantidade %i", (quantity) => {
    expect(requestItemInputSchema.parse({ itemId: ITEM, quantity })).toEqual({
      itemId: ITEM,
      quantity,
    });
  });

  it.each([
    0,
    -1,
    100_000,
    1.5,
    "3",
    null,
    undefined,
    Number.NaN,
  ])("recusa quantidade %j", (quantity) => {
    expect(
      errorsOf(requestItemInputSchema, { itemId: ITEM, quantity }),
    ).toEqual({
      quantity: ITEM_QUANTITY_MESSAGE,
    });
  });

  it("item malformado ou ausente: mensagem do registro", () => {
    expect(
      errorsOf(requestItemInputSchema, { itemId: "x", quantity: 1 }),
    ).toEqual({
      itemId: INVALID_ID_MESSAGE,
    });
    expect(errorsOf(requestItemInputSchema, { quantity: 1 })).toEqual({
      itemId: INVALID_ID_MESSAGE,
    });
  });
});

describe("createRequestSchema", () => {
  describe("o caminho feliz", () => {
    it("destino da lista, sem itens e sem origem", () => {
      expect(createRequestSchema.parse(VALID_CREATE)).toEqual({
        sectorId: SECTOR,
        destination: { kind: "list", destinationId: DESTINATION },
        description: "Rede para a doca",
        items: [],
        originRef: null,
      });
    });

    it("'Outro' com itens e origem", () => {
      const parsed = createRequestSchema.parse({
        ...VALID_CREATE,
        destinationId: null,
        destinationOther: "  Doca   9  ",
        items: [{ itemId: ITEM, quantity: 12 }],
        originRef: ORIGIN,
      });
      expect(parsed).toEqual({
        sectorId: SECTOR,
        destination: { kind: "other", text: "Doca 9" },
        description: "Rede para a doca",
        items: [{ itemId: ITEM, quantity: 12 }],
        originRef: ORIGIN,
      });
    });

    it("destino da lista ignora o texto do Outro, mesmo lixo ou gigante", () => {
      for (const destinationOther of ["Doca 9", "   ", "x".repeat(1000)]) {
        const parsed = createRequestSchema.parse({
          ...VALID_CREATE,
          destinationOther,
        });
        expect(parsed.destination).toEqual({
          kind: "list",
          destinationId: DESTINATION,
        });
      }
    });
  });

  describe("descrição", () => {
    it.each([
      ["vazia", ""],
      ["só com espaços", "   "],
      ["só com quebras de linha", "\r\n \n"],
    ])("%s → mensagem do campo", (_label, description) => {
      expect(
        errorsOf(createRequestSchema, { ...VALID_CREATE, description }),
      ).toEqual({
        description: DESCRIPTION_REQUIRED_MESSAGE,
      });
    });

    it("500 pontos de código passam; 501 recusam (emoji conta 1)", () => {
      const ok = createRequestSchema.parse({
        ...VALID_CREATE,
        description: "🙂".repeat(DESCRIPTION_MAX_LENGTH),
      });
      expect(Array.from(ok.description)).toHaveLength(DESCRIPTION_MAX_LENGTH);
      expect(
        errorsOf(createRequestSchema, {
          ...VALID_CREATE,
          description: "🙂".repeat(DESCRIPTION_MAX_LENGTH + 1),
        }),
      ).toEqual({ description: DESCRIPTION_TOO_LONG_MESSAGE });
    });

    it("os espaços das pontas não contam para o limite", () => {
      const parsed = createRequestSchema.parse({
        ...VALID_CREATE,
        description: `  ${"a".repeat(DESCRIPTION_MAX_LENGTH)}  `,
      });
      expect(parsed.description).toBe("a".repeat(DESCRIPTION_MAX_LENGTH));
    });

    it("NFD vira NFC e \\r\\n vira \\n", () => {
      const parsed = createRequestSchema.parse({
        ...VALID_CREATE,
        description: "  Rede de protec\u{327}a\u{303}o\r\nUrgente\rObrigado  ",
      });
      expect(parsed.description).toBe("Rede de proteção\nUrgente\nObrigado");
    });
  });

  describe("destino 'Outro'", () => {
    const other = (destinationOther: string) => ({
      ...VALID_CREATE,
      destinationId: null,
      destinationOther,
    });

    it.each(["", "   ", "\n\t"])("%j → Informe o destino.", (text) => {
      expect(errorsOf(createRequestSchema, other(text))).toEqual({
        destinationOther: DESTINATION_OTHER_REQUIRED_MESSAGE,
      });
    });

    it("80 pontos de código passam; 81 recusam", () => {
      const ok = createRequestSchema.parse(
        other("🙂".repeat(DESTINATION_OTHER_MAX_LENGTH)),
      );
      expect(ok.destination.kind).toBe("other");
      expect(
        errorsOf(
          createRequestSchema,
          other("🙂".repeat(DESTINATION_OTHER_MAX_LENGTH + 1)),
        ),
      ).toEqual({ destinationOther: DESTINATION_OTHER_TOO_LONG_MESSAGE });
    });

    it("espaços e quebras no meio são colapsados num só", () => {
      const parsed = createRequestSchema.parse(other("  Doca \n  9  "));
      expect(parsed.destination).toEqual({ kind: "other", text: "Doca 9" });
    });
  });

  it("descrição e destino inválidos juntos: os dois campos recebem a sua mensagem", () => {
    expect(
      errorsOf(createRequestSchema, {
        ...VALID_CREATE,
        destinationId: null,
        destinationOther: "",
        description: "",
      }),
    ).toEqual({
      destinationOther: DESTINATION_OTHER_REQUIRED_MESSAGE,
      description: DESCRIPTION_REQUIRED_MESSAGE,
    });
  });

  describe("itens", () => {
    const withItems = (items: unknown) => ({ ...VALID_CREATE, items });

    it("lista vazia passa", () => {
      expect(createRequestSchema.parse(withItems([])).items).toEqual([]);
    });

    it.each([1, 99_999])("quantidade %i passa", (quantity) => {
      expect(
        createRequestSchema.parse(withItems([{ itemId: ITEM, quantity }]))
          .items,
      ).toEqual([{ itemId: ITEM, quantity }]);
    });

    it.each([
      0,
      100_000,
      1.5,
      "3",
    ])("quantidade %j → mensagem do campo", (quantity) => {
      const errors = errorsOf(
        createRequestSchema,
        withItems([{ itemId: ITEM, quantity }]),
      );
      expect(errors).toEqual({ items: ITEM_QUANTITY_MESSAGE });
    });

    it("50 linhas passam; 51 recusam", () => {
      const rows = (count: number) =>
        Array.from({ length: count }, (_, index) => ({
          itemId: uuid(100 + index),
          quantity: 1,
        }));
      expect(
        createRequestSchema.parse(withItems(rows(REQUEST_ITEMS_MAX))).items,
      ).toHaveLength(REQUEST_ITEMS_MAX);
      expect(
        errorsOf(createRequestSchema, withItems(rows(REQUEST_ITEMS_MAX + 1))),
      ).toEqual({ items: TOO_MANY_ITEMS_MESSAGE });
    });

    it("item repetido → mensagem de item repetido", () => {
      expect(
        errorsOf(
          createRequestSchema,
          withItems([
            { itemId: ITEM, quantity: 1 },
            { itemId: ITEM, quantity: 2 },
          ]),
        ),
      ).toEqual({ items: DUPLICATE_ITEM_MESSAGE });
    });
  });

  describe("origem (passagem)", () => {
    it("null passa; a tripla válida do mesmo setor passa", () => {
      expect(createRequestSchema.parse(VALID_CREATE).originRef).toBeNull();
      expect(
        createRequestSchema.parse({ ...VALID_CREATE, originRef: ORIGIN })
          .originRef,
      ).toEqual(ORIGIN);
    });

    it("data inexistente (2026-02-30) → erro no campo da origem", () => {
      const issues = issuesOf(createRequestSchema, {
        ...VALID_CREATE,
        originRef: { ...ORIGIN, operationalDate: "2026-02-30" },
      });
      expect(issues).toEqual([
        { path: "originRef.operationalDate", message: "Data inválida." },
      ]);
    });

    it("setor da origem diferente do da solicitação → erro em sectorId", () => {
      expect(
        errorsOf(createRequestSchema, {
          ...VALID_CREATE,
          originRef: { ...ORIGIN, sectorId: OTHER_SECTOR },
        }),
      ).toEqual({ sectorId: ORIGIN_SECTOR_MISMATCH_MESSAGE });
    });
  });

  describe("campo ausente ou de outro tipo: sempre pt-BR, nunca o texto do Zod", () => {
    it.each([
      ["entrada que nem é objeto", "x"],
      ["entrada nula", null],
      ["entrada ausente", undefined],
      ["sectorId ausente", { ...VALID_CREATE, sectorId: undefined }],
      ["sectorId numérico", { ...VALID_CREATE, sectorId: 3 }],
      ["destinationId ausente", { ...VALID_CREATE, destinationId: undefined }],
      ["destinationId numérico", { ...VALID_CREATE, destinationId: 3 }],
      [
        "destinationOther ausente",
        { ...VALID_CREATE, destinationOther: undefined },
      ],
      ["destinationOther numérico", { ...VALID_CREATE, destinationOther: 3 }],
      ["description ausente", { ...VALID_CREATE, description: undefined }],
      ["description numérica", { ...VALID_CREATE, description: 3 }],
      ["items ausente", { ...VALID_CREATE, items: undefined }],
      ["items texto", { ...VALID_CREATE, items: "x" }],
      ["item que nem é objeto", { ...VALID_CREATE, items: ["x"] }],
      ["originRef ausente", { ...VALID_CREATE, originRef: undefined }],
      ["originRef texto", { ...VALID_CREATE, originRef: "x" }],
      ["originRef sem campos", { ...VALID_CREATE, originRef: {} }],
    ])("%s", (_label, input) => {
      expectNoZodDefault(createRequestSchema, input);
      expect(firstMessage(createRequestSchema, input)).not.toBeNull();
    });

    it("entrada que nem é objeto cai na mensagem genérica; campo ausente, na do campo", () => {
      expect(firstMessage(createRequestSchema, "x")).toBe(
        INVALID_INPUT_MESSAGE,
      );
      expect(
        errorsOf(createRequestSchema, {
          ...VALID_CREATE,
          description: undefined,
        }),
      ).toEqual({ description: INVALID_INPUT_MESSAGE });
      expect(
        errorsOf(createRequestSchema, {
          ...VALID_CREATE,
          originRef: undefined,
        }),
      ).toEqual({ originRef: INVALID_INPUT_MESSAGE });
      expect(
        errorsOf(createRequestSchema, { ...VALID_CREATE, items: "x" }),
      ).toEqual({ items: INVALID_INPUT_MESSAGE });
      expect(
        errorsOf(createRequestSchema, { ...VALID_CREATE, sectorId: "x" }),
      ).toEqual({ sectorId: INVALID_ID_MESSAGE });
    });
  });
});

describe("moveRequestSchema", () => {
  const ID = uuid(9);

  it.each([
    ["requested", "in_transit"],
    ["in_transit", "delivered"],
    ["delivered", "requested"],
    ["cancelled", "requested"],
    ["requested", "requested"],
  ] as const)("%s → %s passa", (from, to) => {
    expect(moveRequestSchema.parse({ id: ID, from, to })).toEqual({
      id: ID,
      from,
      to,
    });
  });

  it("mover para Cancelada é recusado: use o cancelamento com motivo", () => {
    expect(
      errorsOf(moveRequestSchema, {
        id: ID,
        from: "requested",
        to: "cancelled",
      }),
    ).toEqual({ to: CANCEL_NEEDS_REASON_MESSAGE });
  });

  it("status inexistente → Status inválido", () => {
    expect(
      errorsOf(moveRequestSchema, {
        id: ID,
        from: "requested",
        to: "archived",
      }),
    ).toEqual({ to: INVALID_STATUS_MESSAGE });
    expect(
      errorsOf(moveRequestSchema, {
        id: ID,
        from: "archived",
        to: "delivered",
      }),
    ).toEqual({ from: INVALID_STATUS_MESSAGE });
  });

  it("id malformado → mensagem do registro", () => {
    expect(
      errorsOf(moveRequestSchema, {
        id: "x",
        from: "requested",
        to: "delivered",
      }),
    ).toEqual({ id: INVALID_ID_MESSAGE });
  });

  it.each([
    ["from numérico", { id: ID, from: 1, to: "delivered" }],
    ["to ausente", { id: ID, from: "requested" }],
    ["id ausente", { from: "requested", to: "delivered" }],
    ["nada", {}],
    ["texto", "x"],
    ["nulo", null],
  ])("%s → pt-BR, nunca o texto do Zod", (_label, input) => {
    expectNoZodDefault(moveRequestSchema, input);
  });
});

describe("cancelRequestSchema", () => {
  const ID = uuid(9);
  const input = (reason: unknown) => ({ id: ID, from: "in_transit", reason });

  it("passa com motivo, normalizado", () => {
    expect(cancelRequestSchema.parse(input("  Pedido\r\nduplicado  "))).toEqual(
      {
        id: ID,
        from: "in_transit",
        reason: "Pedido\nduplicado",
      },
    );
  });

  it.each(["", "   ", "\n"])("motivo %j → Informe o motivo", (reason) => {
    expect(errorsOf(cancelRequestSchema, input(reason))).toEqual({
      reason: CANCEL_REASON_REQUIRED_MESSAGE,
    });
  });

  it("500 passam; 501 recusam", () => {
    expect(
      cancelRequestSchema.parse(input("🙂".repeat(CANCEL_REASON_MAX_LENGTH)))
        .reason,
    ).toBe("🙂".repeat(CANCEL_REASON_MAX_LENGTH));
    expect(
      errorsOf(
        cancelRequestSchema,
        input("🙂".repeat(CANCEL_REASON_MAX_LENGTH + 1)),
      ),
    ).toEqual({ reason: CANCEL_REASON_TOO_LONG_MESSAGE });
  });

  it("status de origem inválido e id malformado dão mensagem por campo", () => {
    expect(
      errorsOf(cancelRequestSchema, {
        id: "x",
        from: "archived",
        reason: "ok",
      }),
    ).toEqual({ id: INVALID_ID_MESSAGE, from: INVALID_STATUS_MESSAGE });
  });

  it.each([
    ["reason ausente", { id: ID, from: "requested" }],
    ["reason indefinido", { id: ID, from: "requested", reason: undefined }],
    ["reason numérico", { id: ID, from: "requested", reason: 3 }],
    ["from numérico", { id: ID, from: 1, reason: "ok" }],
    ["texto", "x"],
    ["nulo", null],
  ])("%s → pt-BR, nunca o texto do Zod", (_label, value) => {
    expectNoZodDefault(cancelRequestSchema, value);
  });

  it("reason ausente ou numérico dá a mensagem genérica no campo", () => {
    expect(
      errorsOf(cancelRequestSchema, { id: ID, from: "requested", reason: 3 }),
    ).toEqual({ reason: INVALID_INPUT_MESSAGE });
  });
});

describe("addCommentSchema", () => {
  const ID = uuid(9);

  it("passa com texto, normalizado", () => {
    expect(
      addCommentSchema.parse({ requestId: ID, body: "  Chegou\r\nhoje " }),
    ).toEqual({
      requestId: ID,
      body: "Chegou\nhoje",
    });
  });

  it.each([
    "",
    "   ",
    "\r\n",
  ])("comentário %j → Escreva o comentário", (body) => {
    expect(errorsOf(addCommentSchema, { requestId: ID, body })).toEqual({
      body: COMMENT_REQUIRED_MESSAGE,
    });
  });

  it("2.000 passam; 2.001 recusam", () => {
    expect(
      addCommentSchema.parse({
        requestId: ID,
        body: "a".repeat(COMMENT_MAX_LENGTH),
      }).body,
    ).toHaveLength(COMMENT_MAX_LENGTH);
    expect(
      errorsOf(addCommentSchema, {
        requestId: ID,
        body: "🙂".repeat(COMMENT_MAX_LENGTH + 1),
      }),
    ).toEqual({ body: COMMENT_TOO_LONG_MESSAGE });
  });

  it("requestId malformado → mensagem do registro", () => {
    expect(errorsOf(addCommentSchema, { requestId: "x", body: "ok" })).toEqual({
      requestId: INVALID_ID_MESSAGE,
    });
  });

  it.each([
    ["body numérico", { requestId: ID, body: 3 }],
    ["body ausente", { requestId: ID }],
    ["requestId ausente", { body: "ok" }],
    ["texto", "x"],
    ["nulo", null],
  ])("%s → pt-BR, nunca o texto do Zod", (_label, value) => {
    expectNoZodDefault(addCommentSchema, value);
  });

  it("body numérico dá a mensagem genérica no campo", () => {
    expect(errorsOf(addCommentSchema, { requestId: ID, body: 3 })).toEqual({
      body: INVALID_INPUT_MESSAGE,
    });
  });
});

describe("deleteCommentSchema", () => {
  it("passa com um id válido", () => {
    expect(deleteCommentSchema.parse({ id: uuid(9) })).toEqual({ id: uuid(9) });
  });

  it("id malformado → mensagem do registro", () => {
    expect(errorsOf(deleteCommentSchema, { id: "x" })).toEqual({
      id: INVALID_ID_MESSAGE,
    });
    expect(errorsOf(deleteCommentSchema, { id: 3 })).toEqual({
      id: INVALID_ID_MESSAGE,
    });
  });

  it.each([
    ["ausente", {}],
    ["texto", "x"],
    ["nulo", null],
    ["indefinido", undefined],
  ])("id %s → pt-BR, nunca o texto do Zod", (_label, value) => {
    expectNoZodDefault(deleteCommentSchema, value);
  });
});
