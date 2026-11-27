import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { ADMIN_INVITE_LABEL_MAX_LENGTH } from "@/features/invites/adminInvite";

import {
  cancelInviteSchema,
  createDestinationSchema,
  createInviteSchema,
  createItemSchema,
  createPasswordResetLinkSchema,
  createSectorSchema,
  createShiftSchema,
  firstFieldErrors,
  INVITE_LABEL_MAX_LENGTH,
  idSchema,
  moveSchema,
  nameSchema,
  renameDestinationSchema,
  renameSectorSchema,
  setActiveSchema,
  setPersonActiveSchema,
  timeSchema,
  updateItemSchema,
  updatePersonSchema,
  updateShiftSchema,
} from "./schemas";

const ID = "11111111-1111-4111-8111-111111111111";

function errorsOf(schema: z.ZodType, input: unknown) {
  const parsed = schema.safeParse(input);
  if (parsed.success) throw new Error("a entrada deveria ser recusada");
  return firstFieldErrors(parsed.error);
}

describe("idSchema", () => {
  it("aceita uuid", () => {
    expect(idSchema.safeParse(ID).success).toBe(true);
  });

  it("recusa o que não é uuid, com a mensagem pt-BR", () => {
    for (const value of ["abc", "", 42, null, undefined]) {
      const parsed = idSchema.safeParse(value);
      expect(parsed.success, String(value)).toBe(false);
      expect(parsed.error?.issues[0]?.message).toBe(
        "Registro inválido. Atualize a página.",
      );
    }
  });
});

describe("nameSchema", () => {
  it("normaliza o nome", () => {
    expect(nameSchema.parse("  Carga   geral ")).toBe("Carga geral");
  });

  it("vazio, só espaços e ausente: 'Informe o nome.'", () => {
    for (const value of ["", "   ", undefined, null, 7]) {
      const parsed = nameSchema.safeParse(value);
      expect(parsed.success, String(value)).toBe(false);
      expect(parsed.error?.issues[0]?.message).toBe("Informe o nome.");
    }
  });

  it("60 passa, 61 não", () => {
    expect(nameSchema.safeParse("a".repeat(60)).success).toBe(true);
    const parsed = nameSchema.safeParse("a".repeat(61));
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(
      "O nome pode ter no máximo 60 caracteres.",
    );
  });
});

describe("timeSchema", () => {
  it("aceita HH:mm nos limites do dia", () => {
    expect(timeSchema.safeParse("00:00").success).toBe(true);
    expect(timeSchema.safeParse("23:59").success).toBe(true);
  });

  it("recusa 24:00, hora sem zero, com segundos e lixo", () => {
    for (const value of [
      "24:00",
      "6:00",
      "06:00:00",
      "06:60",
      "",
      "abc",
      600,
      undefined,
    ]) {
      const parsed = timeSchema.safeParse(value);
      expect(parsed.success, String(value)).toBe(false);
      expect(parsed.error?.issues[0]?.message).toBe(
        "Informe um horário válido, como 06:00.",
      );
    }
  });
});

describe("setores e destinos", () => {
  it("criar: nome normalizado e cor; sobra de chave é descartada", () => {
    expect(
      createSectorSchema.parse({ name: " ULD ", color: "sky", admin: true }),
    ).toEqual({ name: "ULD", color: "sky" });
    expect(createDestinationSchema.parse({ name: "Almoxarifado" })).toEqual({
      name: "Almoxarifado",
    });
  });

  it("criar: aceita as cinco cores e recusa o resto, com mensagem em português", () => {
    for (const color of ["lilac", "peach", "sky", "green", "pink"]) {
      expect(
        createSectorSchema.safeParse({ name: "ULD", color }).success,
        color,
      ).toBe(true);
    }
    for (const color of ["red", "", "Lilac", " lilac", 1, null, undefined]) {
      expect(
        errorsOf(createSectorSchema, { name: "ULD", color }),
        String(color),
      ).toEqual({
        color: "Escolha uma das cores da lista.",
      });
    }
  });

  it("renomear exige id, nome e cor", () => {
    expect(
      renameSectorSchema.safeParse({ id: ID, name: "ULD", color: "pink" })
        .success,
    ).toBe(true);
    expect(errorsOf(renameSectorSchema, { id: ID, name: "ULD" })).toEqual({
      color: "Escolha uma das cores da lista.",
    });
    expect(
      errorsOf(renameSectorSchema, { id: "x", name: "", color: "red" }),
    ).toEqual({
      id: "Registro inválido. Atualize a página.",
      name: "Informe o nome.",
      color: "Escolha uma das cores da lista.",
    });
    expect(errorsOf(renameDestinationSchema, { id: ID, name: "" })).toEqual({
      name: "Informe o nome.",
    });
  });

  it("ativar/desativar exige boolean de verdade (string 'true' não vale)", () => {
    expect(setActiveSchema.safeParse({ id: ID, active: false }).success).toBe(
      true,
    );
    expect(setActiveSchema.safeParse({ id: ID, active: "true" }).success).toBe(
      false,
    );
  });

  it("mover aceita só up e down", () => {
    expect(moveSchema.safeParse({ id: ID, direction: "up" }).success).toBe(
      true,
    );
    expect(moveSchema.safeParse({ id: ID, direction: "down" }).success).toBe(
      true,
    );
    expect(moveSchema.safeParse({ id: ID, direction: "left" }).success).toBe(
      false,
    );
  });
});

describe("turnos", () => {
  const valid = {
    sectorId: ID,
    name: "Manhã",
    startsAt: "06:00",
    endsAt: "14:00",
  };

  it("aceita um turno comum e um que atravessa a meia-noite", () => {
    expect(createShiftSchema.safeParse(valid).success).toBe(true);
    expect(
      createShiftSchema.safeParse({
        ...valid,
        startsAt: "22:00",
        endsAt: "06:00",
      }).success,
    ).toBe(true);
  });

  it("início igual ao fim: erro no campo endsAt", () => {
    expect(errorsOf(createShiftSchema, { ...valid, endsAt: "06:00" })).toEqual({
      endsAt: "O início e o fim não podem ser iguais.",
    });
    expect(
      errorsOf(updateShiftSchema, {
        id: ID,
        name: "Manhã",
        startsAt: "00:00",
        endsAt: "00:00",
      }),
    ).toEqual({ endsAt: "O início e o fim não podem ser iguais." });
  });

  it("horário inválido: erro no campo certo, só o primeiro de cada campo", () => {
    expect(
      errorsOf(createShiftSchema, {
        ...valid,
        startsAt: "25:00",
        endsAt: "xx",
      }),
    ).toEqual({
      startsAt: "Informe um horário válido, como 06:00.",
      endsAt: "Informe um horário válido, como 06:00.",
    });
  });

  it("setor inválido e nome vazio", () => {
    expect(
      errorsOf(createShiftSchema, { ...valid, sectorId: "x", name: " " }),
    ).toEqual({
      sectorId: "Registro inválido. Atualize a página.",
      name: "Informe o nome.",
    });
  });
});

describe("itens", () => {
  const valid = {
    sectorId: ID,
    name: "Rede de proteção",
    unitChoice: "unidade",
    unitOther: "",
    kind: "control",
  };

  it("aceita uma unidade da lista e 'Outro' com texto", () => {
    expect(createItemSchema.safeParse(valid).success).toBe(true);
    expect(
      createItemSchema.safeParse({
        ...valid,
        unitChoice: "outro",
        unitOther: "Bobina",
      }).success,
    ).toBe(true);
  });

  it("'Outro' sem texto: erro em unitOther", () => {
    expect(
      errorsOf(createItemSchema, { ...valid, unitChoice: "outro" }),
    ).toEqual({
      unitOther: "Informe a unidade.",
    });
  });

  it("'Outro' com 21 caracteres: erro em unitOther", () => {
    expect(
      errorsOf(createItemSchema, {
        ...valid,
        unitChoice: "outro",
        unitOther: "a".repeat(21),
      }),
    ).toEqual({ unitOther: "A unidade pode ter no máximo 20 caracteres." });
  });

  it("escolha desconhecida: erro em unitChoice", () => {
    expect(
      errorsOf(createItemSchema, { ...valid, unitChoice: "litro" }),
    ).toEqual({
      unitChoice: "Escolha uma unidade.",
    });
  });

  it("tipo fora de control/stock: erro em kind", () => {
    expect(errorsOf(createItemSchema, { ...valid, kind: "outro" })).toEqual({
      kind: "Escolha o tipo do item.",
    });
  });

  it("editar usa as mesmas regras, com id no lugar do setor", () => {
    const edit = {
      id: ID,
      name: "Rede",
      unitChoice: "kg",
      unitOther: "",
      kind: "stock",
    };
    expect(updateItemSchema.safeParse(edit).success).toBe(true);
    expect(errorsOf(updateItemSchema, { ...edit, unitChoice: "" })).toEqual({
      unitChoice: "Escolha uma unidade.",
    });
  });
});

describe("pessoas", () => {
  it("operador com setor passa; sem setor: erro em sectorId", () => {
    expect(
      updatePersonSchema.safeParse({
        userId: "u1",
        role: "operator",
        sectorId: ID,
      }).success,
    ).toBe(true);
    expect(
      errorsOf(updatePersonSchema, {
        userId: "u1",
        role: "operator",
        sectorId: null,
      }),
    ).toEqual({ sectorId: "Escolha o setor do operador." });
  });

  it("administrador passa com ou sem setor (o domínio grava null)", () => {
    expect(
      updatePersonSchema.safeParse({
        userId: "u1",
        role: "admin",
        sectorId: null,
      }).success,
    ).toBe(true);
    expect(
      updatePersonSchema.safeParse({
        userId: "u1",
        role: "admin",
        sectorId: ID,
      }).success,
    ).toBe(true);
  });

  it("papel desconhecido e userId vazio", () => {
    expect(
      errorsOf(updatePersonSchema, {
        userId: "",
        role: "gerente",
        sectorId: null,
      }),
    ).toEqual({
      userId: "Confira os campos e tente de novo.",
      role: "Escolha o papel.",
    });
  });

  it("userId é texto livre (não uuid)", () => {
    expect(
      setPersonActiveSchema.safeParse({ userId: "abc123", active: true })
        .success,
    ).toBe(true);
    expect(
      setPersonActiveSchema.safeParse({ userId: "", active: true }).success,
    ).toBe(false);
  });
});

describe("createPasswordResetLinkSchema", () => {
  it("aceita um userId de texto livre", () => {
    expect(
      createPasswordResetLinkSchema.safeParse({ userId: "abc123" }).success,
    ).toBe(true);
  });

  it("userId vazio, ausente ou de outro tipo é recusado em português", () => {
    for (const input of [{ userId: "" }, {}, { userId: 1 }]) {
      expect(errorsOf(createPasswordResetLinkSchema, input)).toEqual({
        userId: "Confira os campos e tente de novo.",
      });
    }
  });
});

describe("convites", () => {
  const valid = {
    inviteeLabel: "Turno da noite",
    role: "operator",
    sectorId: ID,
  };

  it("rótulo é normalizado; vazio continua vazio (o domínio vira null)", () => {
    expect(
      createInviteSchema.parse({ ...valid, inviteeLabel: "  Maria   Souza " }),
    ).toMatchObject({ inviteeLabel: "Maria Souza" });
    expect(
      createInviteSchema.parse({ ...valid, inviteeLabel: "   " }),
    ).toMatchObject({
      inviteeLabel: "",
    });
  });

  it("80 caracteres passa; 81 não, no campo inviteeLabel", () => {
    expect(INVITE_LABEL_MAX_LENGTH).toBe(ADMIN_INVITE_LABEL_MAX_LENGTH);
    expect(
      createInviteSchema.safeParse({ ...valid, inviteeLabel: "a".repeat(80) })
        .success,
    ).toBe(true);
    expect(
      errorsOf(createInviteSchema, { ...valid, inviteeLabel: "a".repeat(81) }),
    ).toEqual({
      inviteeLabel: "O nome de referência pode ter no máximo 80 caracteres.",
    });
  });

  it("papel inválido; setor pode ser null (admin)", () => {
    expect(errorsOf(createInviteSchema, { ...valid, role: "x" })).toEqual({
      role: "Escolha o papel.",
    });
    expect(
      createInviteSchema.safeParse({ ...valid, role: "admin", sectorId: null })
        .success,
    ).toBe(true);
  });

  it("cancelar exige id", () => {
    expect(cancelInviteSchema.safeParse({ id: ID }).success).toBe(true);
    expect(cancelInviteSchema.safeParse({ id: "x" }).success).toBe(false);
  });
});

describe("nenhuma mensagem sai em inglês", () => {
  const schemas = {
    createSectorSchema,
    renameSectorSchema,
    createDestinationSchema,
    renameDestinationSchema,
    setActiveSchema,
    moveSchema,
    createShiftSchema,
    updateShiftSchema,
    createItemSchema,
    updateItemSchema,
    updatePersonSchema,
    setPersonActiveSchema,
    createPasswordResetLinkSchema,
    createInviteSchema,
    cancelInviteSchema,
  };
  const ENGLISH = /invalid|expected|required|received/i;

  it.each(
    Object.entries(schemas),
  )("%s com {} e com campos de tipo errado", (_name, schema) => {
    const wrongTypes = {
      id: 1,
      sectorId: 1,
      userId: 1,
      name: 1,
      startsAt: 1,
      endsAt: 1,
      unitChoice: 1,
      unitOther: 1,
      kind: 1,
      color: 1,
      role: 1,
      direction: 1,
      active: 1,
      inviteeLabel: 1,
    };
    for (const input of [{}, wrongTypes]) {
      const parsed = schema.safeParse(input);
      expect(parsed.success).toBe(false);
      for (const issue of parsed.error?.issues ?? []) {
        expect(issue.message, issue.message).not.toMatch(ENGLISH);
      }
    }
  });
});

describe("firstFieldErrors", () => {
  it("ignora problema sem campo (entrada que nem é objeto)", () => {
    const parsed = createSectorSchema.safeParse(null);
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(firstFieldErrors(parsed.error)).toEqual({});
  });

  it("devolve só a primeira mensagem de cada campo", () => {
    const parsed = createSectorSchema.safeParse({
      name: "a".repeat(100),
      color: "sky",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(firstFieldErrors(parsed.error)).toEqual({
        name: "O nome pode ter no máximo 60 caracteres.",
      });
    }
  });
});
