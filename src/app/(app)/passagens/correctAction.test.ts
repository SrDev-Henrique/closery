import type { PGlite } from "@electric-sql/pglite";
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { db } from "@/db";
import {
  handover,
  handoverCorrection,
  handoverItem,
} from "@/db/schema/handovers";
import { authzOf } from "../../../../test/authz";
import { resetDb } from "../../../../test/db";
import {
  insertHandover,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../../test/fixtures";
import { correctHandoverAction } from "./actions";

const mocks = vi.hoisted(
  (): {
    requireUser: Mock;
    revalidatePath: Mock;
    client: PGlite | undefined;
  } => ({
    requireUser: vi.fn(),
    revalidatePath: vi.fn(),
    client: undefined,
  }),
);

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});

const REDIRECT = new Error("NEXT_REDIRECT;/entrar");

// Passagem confirmada de Ana (entregou) e Bia (recebeu), com dois itens:
// Rede = 2 (sem nota) e Fita = 10 (nota "Pedir mais").
async function seed() {
  const sector = await insertSector(db, "ULD");
  const shift = await insertShift(db, { sectorId: sector.id, name: "Manhã" });
  const nets = await insertItem(db, {
    sectorId: sector.id,
    name: "Rede de proteção",
    kind: "control",
  });
  const tape = await insertItem(db, {
    sectorId: sector.id,
    name: "Fita adesiva",
    unit: "rolo",
    kind: "stock",
  });
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
    name: "Bia Teste",
  });
  const admin = await insertUser(db, {
    role: "admin",
    sectorId: null,
    name: "Admin Teste",
  });
  const confirmed = await insertHandover(db, {
    sectorId: sector.id,
    shiftId: shift.id,
    status: "confirmed",
    deliveredBy: ana.id,
    confirmedBy: bia.id,
    occurrencesText: "Chuva",
    nextShiftText: "Conferir redes",
    shiftNameSnapshot: "Manhã",
  });
  await insertHandoverItem(db, {
    handoverId: confirmed.id,
    itemId: nets.id,
    quantity: 2,
    snapshot: true,
  });
  await insertHandoverItem(db, {
    handoverId: confirmed.id,
    itemId: tape.id,
    quantity: 10,
    note: "Pedir mais",
    snapshot: true,
  });
  return {
    sector,
    shift,
    nets,
    tape,
    ana,
    bia,
    admin,
    id: confirmed.id,
    asAdmin: authzOf({ role: "admin", userId: admin.id, name: "Admin Teste" }),
    asOperator: (who: { id: string }) =>
      authzOf({ role: "operator", userId: who.id, sectorId: sector.id }),
  };
}

type World = Awaited<ReturnType<typeof seed>>;

// Estado atual como o formulário o manda, com ajustes por cima.
function input(
  world: World,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: world.id,
    reason: "Contagem errada",
    occurrencesText: "Chuva",
    nextShiftText: "Conferir redes",
    items: [
      { itemId: world.nets.id, quantity: 2, note: "" },
      { itemId: world.tape.id, quantity: 10, note: "Pedir mais" },
    ],
    ...overrides,
  };
}

async function corrections() {
  return db
    .select()
    .from(handoverCorrection)
    .orderBy(asc(handoverCorrection.correctedAt), asc(handoverCorrection.id));
}

async function quantities(id: string) {
  const rows = await db
    .select()
    .from(handoverItem)
    .where(eq(handoverItem.handoverId, id));
  return Object.fromEntries(rows.map((row) => [row.itemId, row.quantity]));
}

describe("correctHandoverAction", () => {
  beforeEach(async () => {
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireUser.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it("sem sessão: requireUser redireciona e nada muda", async () => {
    const world = await seed();
    mocks.requireUser.mockRejectedValue(REDIRECT);

    await expect(
      correctHandoverAction(
        input(world, {
          items: [
            { itemId: world.nets.id, quantity: 9, note: "" },
            { itemId: world.tape.id, quantity: 10, note: "Pedir mais" },
          ],
        }),
      ),
    ).rejects.toBe(REDIRECT);

    expect(await corrections()).toHaveLength(0);
    expect((await quantities(world.id))[world.nets.id]).toBe(2);
  });

  describe("permissão negada", () => {
    it("operador do setor: FORBIDDEN, nada muda, nenhuma linha de correção", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asOperator(world.bia));

      const result = await correctHandoverAction(
        input(world, { occurrencesText: "Hackeado" }),
      );

      expect(result).toMatchObject({
        ok: false,
        code: "FORBIDDEN",
        message: "Só um administrador pode corrigir uma passagem confirmada.",
      });
      const [row] = await db
        .select()
        .from(handover)
        .where(eq(handover.id, world.id));
      expect(row?.occurrencesText).toBe("Chuva");
      expect(await corrections()).toHaveLength(0);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("quem entregou também não corrige a confirmada", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asOperator(world.ana));

      const result = await correctHandoverAction(input(world));

      expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
    });

    it("operador de outro setor: NOT_FOUND (não revela que existe)", async () => {
      const world = await seed();
      const other = await insertSector(db, "Outro");
      const stranger = await insertUser(db, {
        role: "operator",
        sectorId: other.id,
      });
      mocks.requireUser.mockResolvedValue(
        authzOf({ role: "operator", userId: stranger.id, sectorId: other.id }),
      );

      const result = await correctHandoverAction(input(world));

      expect(result).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
        message: "Passagem não encontrada. Atualize a página.",
      });
      expect(await corrections()).toHaveLength(0);
    });
  });

  describe("admin corrige", () => {
    it("muda texto, quantidade e nota: uma linha por campo, com motivo, quem e quando", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(
        input(world, {
          occurrencesText: "Chuva e vento",
          items: [
            { itemId: world.nets.id, quantity: 5, note: "" },
            { itemId: world.tape.id, quantity: 10, note: "" },
          ],
        }),
      );

      expect(result).toMatchObject({ ok: true, changes: 3 });
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)", "layout");
      const rows = await corrections();
      expect(
        rows.map((row) => [row.field, row.oldValue, row.newValue]).sort(),
      ).toEqual(
        [
          ["occurrences_text", "Chuva", "Chuva e vento"],
          ["item_quantity", "2", "5"],
          ["item_note", "Pedir mais", ""],
        ].sort(),
      );
      for (const row of rows) {
        expect(row).toMatchObject({
          handoverId: world.id,
          reason: "Contagem errada",
          correctedBy: world.admin.id,
        });
        expect(row.correctedAt).toBeInstanceOf(Date);
      }
      expect(rows.find((row) => row.field === "item_quantity")?.itemId).toBe(
        world.nets.id,
      );
      const [current] = await db
        .select()
        .from(handover)
        .where(eq(handover.id, world.id));
      expect(current).toMatchObject({
        occurrencesText: "Chuva e vento",
        status: "confirmed",
        updatedBy: world.admin.id,
      });
      expect((await quantities(world.id))[world.nets.id]).toBe(5);
      const [tape] = await db
        .select()
        .from(handoverItem)
        .where(eq(handoverItem.itemId, world.tape.id));
      expect(tape?.note).toBeNull();
    });

    it("só o texto do próximo turno: uma linha só", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(
        input(world, { nextShiftText: "Nada pendente" }),
      );

      expect(result).toMatchObject({ ok: true, changes: 1 });
      expect((await corrections()).map((row) => row.field)).toEqual([
        "next_shift_text",
      ]);
    });

    it("motivo com espaços nas pontas é guardado sem eles", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await correctHandoverAction(
        input(world, { reason: "  Digitei errado  ", nextShiftText: "x" }),
      );

      expect((await corrections())[0]?.reason).toBe("Digitei errado");
    });

    it("corrigir duas vezes encadeia o valor antigo", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);
      const withNets = (quantity: number) => [
        { itemId: world.nets.id, quantity, note: "" },
        { itemId: world.tape.id, quantity: 10, note: "Pedir mais" },
      ];

      await correctHandoverAction(input(world, { items: withNets(5) }));
      await correctHandoverAction(
        input(world, { reason: "Outra vez", items: withNets(7) }),
      );

      const rows = (await corrections()).filter(
        (row) => row.field === "item_quantity",
      );
      expect(rows.map((row) => [row.oldValue, row.newValue])).toEqual([
        ["2", "5"],
        ["5", "7"],
      ]);
      expect((await quantities(world.id))[world.nets.id]).toBe(7);
    });

    it("item de nota nula ganha nota: antigo vazio, novo o texto", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await correctHandoverAction(
        input(world, {
          items: [
            { itemId: world.nets.id, quantity: 2, note: "  Rasgada  " },
            { itemId: world.tape.id, quantity: 10, note: "Pedir mais" },
          ],
        }),
      );

      const rows = await corrections();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        field: "item_note",
        oldValue: "",
        newValue: "Rasgada",
        itemId: world.nets.id,
      });
    });
  });

  describe("recusas do domínio", () => {
    it("nada mudou: NO_CHANGES, zero linhas e sem revalidar", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(input(world));

      expect(result).toMatchObject({
        ok: false,
        code: "NO_CHANGES",
        message:
          "Nada foi alterado. Mude algum campo para registrar a correção.",
      });
      expect(await corrections()).toHaveLength(0);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("passagem só entregue: NOT_CONFIRMED (edita-se direto, sem motivo)", async () => {
      const world = await seed();
      const delivered = await insertHandover(db, {
        sectorId: world.sector.id,
        shiftId: world.shift.id,
        operationalDate: "2026-11-18",
        status: "delivered",
        deliveredBy: world.ana.id,
      });
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(
        input(world, { id: delivered.id, items: [] }),
      );

      expect(result).toMatchObject({ ok: false, code: "NOT_CONFIRMED" });
      expect(await corrections()).toHaveLength(0);
    });

    it("item que a passagem não tem: NOT_FOUND e nada é gravado", async () => {
      const world = await seed();
      const stranger = await insertItem(db, {
        sectorId: world.sector.id,
        name: "Item novo",
      });
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(
        input(world, {
          occurrencesText: "Mudou",
          items: [{ itemId: stranger.id, quantity: 4, note: "" }],
        }),
      );

      expect(result).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
        message: "Item não encontrado. Atualize a página.",
      });
      expect(await corrections()).toHaveLength(0);
      const [row] = await db
        .select()
        .from(handover)
        .where(eq(handover.id, world.id));
      expect(row?.occurrencesText).toBe("Chuva");
    });

    it("passagem que não existe: NOT_FOUND", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(
        input(world, { id: "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b" }),
      );

      expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    });
  });

  describe("entrada inválida (nada é gravado)", () => {
    it.each([
      [
        "motivo vazio",
        { reason: "" },
        "reason",
        "Informe o motivo da correção.",
      ],
      [
        "motivo só com espaços",
        { reason: "   \n " },
        "reason",
        "Informe o motivo da correção.",
      ],
      [
        "motivo com 501 caracteres",
        { reason: "a".repeat(501) },
        "reason",
        "O motivo pode ter no máximo 500 caracteres.",
      ],
      [
        "texto com mais de 2.000 caracteres",
        { occurrencesText: "a".repeat(2001) },
        "occurrencesText",
        "O texto pode ter no máximo 2.000 caracteres.",
      ],
    ])("%s", async (_name, overrides, field, message) => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(input(world, overrides));

      expect(result).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { [field]: message },
      });
      expect(await corrections()).toHaveLength(0);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it.each([
      ["negativa", -1],
      ["decimal", 1.5],
      ["acima do máximo", 100_000],
    ])("quantidade %s", async (_name, quantity) => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(
        input(world, {
          items: [{ itemId: world.nets.id, quantity, note: "" }],
        }),
      );

      expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
      expect((await quantities(world.id))[world.nets.id]).toBe(2);
    });

    it("item repetido", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(
        input(world, {
          items: [
            { itemId: world.nets.id, quantity: 3, note: "" },
            { itemId: world.nets.id, quantity: 4, note: "" },
          ],
        }),
      );

      expect(result).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { items: "Item repetido. Atualize a página." },
      });
    });

    it("id que não é uuid", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(input(world, { id: "abc" }));

      expect(result).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { id: "Registro inválido. Atualize a página." },
      });
    });

    it("limite: motivo com exatamente 500 caracteres passa", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(
        input(world, { reason: "a".repeat(500), nextShiftText: "novo" }),
      );

      expect(result).toMatchObject({ ok: true, changes: 1 });
    });
  });
});
