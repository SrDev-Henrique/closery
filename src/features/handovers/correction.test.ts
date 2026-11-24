import type { PGlite } from "@electric-sql/pglite";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  handover,
  handoverCorrection,
  handoverItem,
} from "@/db/schema/handovers";
import type { Authz } from "@/features/authz/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { type CorrectionInput, correctHandover } from "./correction";
import { getHandoverSummary } from "./summary";

const NIL_ID = "00000000-0000-4000-8000-000000000000";
const NOW = spDate("2026-11-21", "09:00");

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
});

function operator(id: string, name: string, sectorId: string): Authz {
  return {
    userId: id,
    name,
    email: `${id}@example.test`,
    role: "operator",
    sectorId,
  };
}

// Setor ULD: Ana entregou, Bia é operadora, Admin Teste corrige. A passagem
// está confirmada com três itens: redes 3, rolos 10 (obs. "antiga"), cabos 0.
async function seed(status: "confirmed" | "delivered" | "draft" = "confirmed") {
  const uld = await insertSector(db, "ULD");
  const other = await insertSector(db, "Outro");
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Bia Teste",
  });
  const caio = await insertUser(db, {
    role: "operator",
    sectorId: other.id,
    name: "Caio Teste",
  });
  const root = await insertUser(db, {
    role: "admin",
    sectorId: null,
    name: "Admin Teste",
  });
  const turno = await insertShift(db, { sectorId: uld.id, name: "Manhã" });
  const redes = await insertItem(db, {
    sectorId: uld.id,
    name: "Redes danificadas",
    kind: "control",
  });
  const rolos = await insertItem(db, {
    sectorId: uld.id,
    name: "Rolos de fita",
    unit: "rolo",
    kind: "stock",
  });
  const cabos = await insertItem(db, {
    sectorId: uld.id,
    name: "Cabos soltos",
    kind: "control",
  });
  const passagem = await insertHandover(db, {
    sectorId: uld.id,
    shiftId: turno.id,
    status,
    occurrencesText: "Texto A",
    nextShiftText: "Próximo A",
    ...(status === "draft" ? {} : { deliveredBy: ana.id }),
    ...(status === "confirmed" ? { confirmedBy: root.id } : {}),
  });
  await insertHandoverItem(db, {
    handoverId: passagem.id,
    itemId: redes.id,
    quantity: 3,
    snapshot: true,
  });
  await insertHandoverItem(db, {
    handoverId: passagem.id,
    itemId: rolos.id,
    quantity: 10,
    note: "antiga",
    snapshot: true,
  });
  await insertHandoverItem(db, {
    handoverId: passagem.id,
    itemId: cabos.id,
    quantity: 0,
    snapshot: true,
  });
  return {
    uld,
    other,
    redes,
    rolos,
    cabos,
    id: passagem.id,
    ana: operator(ana.id, "Ana Teste", uld.id),
    bia: operator(bia.id, "Bia Teste", uld.id),
    caio: operator(caio.id, "Caio Teste", other.id),
    root: {
      userId: root.id,
      name: "Admin Teste",
      email: "admin@example.test",
      role: "admin",
      sectorId: null,
    } satisfies Authz,
    anaId: ana.id,
    rootId: root.id,
  };
}

type Seeded = Awaited<ReturnType<typeof seed>>;

// Estado igual ao atual (nenhuma mudança) + motivo; cada teste altera o que quer.
function unchanged(seeded: Seeded): CorrectionInput {
  return {
    id: seeded.id,
    reason: "Erro de contagem",
    occurrencesText: "Texto A",
    nextShiftText: "Próximo A",
    items: [
      { itemId: seeded.redes.id, quantity: 3, note: "" },
      { itemId: seeded.rolos.id, quantity: 10, note: "antiga" },
      { itemId: seeded.cabos.id, quantity: 0, note: "" },
    ],
  };
}

async function correctionRows(id: string) {
  return db
    .select()
    .from(handoverCorrection)
    .where(eq(handoverCorrection.handoverId, id))
    .orderBy(asc(handoverCorrection.field), asc(handoverCorrection.id));
}

async function lineOf(id: string, itemId: string) {
  const rows = await db
    .select()
    .from(handoverItem)
    .where(eq(handoverItem.handoverId, id));
  const line = rows.find((row) => row.itemId === itemId);
  if (!line) throw new Error("linha do item sumiu no teste");
  return line;
}

async function handoverRow(id: string) {
  const [row] = await db.select().from(handover).where(eq(handover.id, id));
  if (!row) throw new Error("passagem sumiu no teste");
  return row;
}

describe("correctHandover", () => {
  it("admin corrige texto, quantidade e observação: uma linha por campo, com antigo, novo, motivo, quem e quando", async () => {
    const seeded = await seed();
    const input = unchanged(seeded);
    input.occurrencesText = "Texto B";
    input.items = [
      { itemId: seeded.redes.id, quantity: 5, note: "" },
      { itemId: seeded.rolos.id, quantity: 10, note: "nova" },
      { itemId: seeded.cabos.id, quantity: 0, note: "" },
    ];

    const result = await correctHandover(db, seeded.root, input, NOW);

    expect(result).toEqual({ ok: true, changes: 3 });
    const rows = await correctionRows(seeded.id);
    expect(
      rows.map((row) => ({
        field: row.field,
        itemId: row.itemId,
        oldValue: row.oldValue,
        newValue: row.newValue,
        reason: row.reason,
        correctedBy: row.correctedBy,
        correctedAt: row.correctedAt,
      })),
    ).toEqual([
      {
        field: "item_note",
        itemId: seeded.rolos.id,
        oldValue: "antiga",
        newValue: "nova",
        reason: "Erro de contagem",
        correctedBy: seeded.rootId,
        correctedAt: NOW,
      },
      {
        field: "item_quantity",
        itemId: seeded.redes.id,
        oldValue: "3",
        newValue: "5",
        reason: "Erro de contagem",
        correctedBy: seeded.rootId,
        correctedAt: NOW,
      },
      {
        field: "occurrences_text",
        itemId: null,
        oldValue: "Texto A",
        newValue: "Texto B",
        reason: "Erro de contagem",
        correctedBy: seeded.rootId,
        correctedAt: NOW,
      },
    ]);
  });

  it("os valores vigentes são os corrigidos e a passagem continua confirmada", async () => {
    const seeded = await seed();
    const input = unchanged(seeded);
    input.nextShiftText = "Próximo B";
    input.items = [
      { itemId: seeded.redes.id, quantity: 5, note: "" },
      { itemId: seeded.rolos.id, quantity: 10, note: "" },
      { itemId: seeded.cabos.id, quantity: 0, note: "  cabo   novo " },
    ];

    await correctHandover(db, seeded.root, input, NOW);

    const row = await handoverRow(seeded.id);
    expect(row.status).toBe("confirmed");
    expect(row.confirmedBy).toBe(seeded.rootId);
    expect(row.nextShiftText).toBe("Próximo B");
    expect(row.updatedBy).toBe(seeded.rootId);
    expect(row.updatedAt).toEqual(NOW);
    expect((await lineOf(seeded.id, seeded.redes.id)).quantity).toBe(5);
    expect((await lineOf(seeded.id, seeded.rolos.id)).note).toBeNull();
    expect((await lineOf(seeded.id, seeded.cabos.id)).note).toBe("cabo novo");

    const summary = await getHandoverSummary(db, seeded.root, seeded.id);
    if (!summary.ok) throw new Error("resumo falhou");
    expect(summary.summary.corrected).toBe(true);
    expect(summary.summary.nextShiftText).toBe("Próximo B");
  });

  it("duas correções encadeiam: o valor antigo da segunda é o novo da primeira", async () => {
    const seeded = await seed();
    const first = unchanged(seeded);
    first.items = [
      { itemId: seeded.redes.id, quantity: 5, note: "" },
      { itemId: seeded.rolos.id, quantity: 10, note: "antiga" },
      { itemId: seeded.cabos.id, quantity: 0, note: "" },
    ];
    await correctHandover(db, seeded.root, first, NOW);
    const second = { ...first, reason: "Segunda conferência" };
    second.items = [
      { itemId: seeded.redes.id, quantity: 8, note: "" },
      { itemId: seeded.rolos.id, quantity: 10, note: "antiga" },
      { itemId: seeded.cabos.id, quantity: 0, note: "" },
    ];

    const result = await correctHandover(
      db,
      seeded.root,
      second,
      spDate("2026-11-21", "10:00"),
    );

    expect(result).toEqual({ ok: true, changes: 1 });
    const summary = await getHandoverSummary(db, seeded.root, seeded.id);
    if (!summary.ok) throw new Error("resumo falhou");
    expect(
      summary.summary.corrections.map((row) => [
        row.oldValue,
        row.newValue,
        row.reason,
      ]),
    ).toEqual([
      ["3", "5", "Erro de contagem"],
      ["5", "8", "Segunda conferência"],
    ]);
    expect((await lineOf(seeded.id, seeded.redes.id)).quantity).toBe(8);
  });

  it("nada mudou: NO_CHANGES e nenhuma linha de correção", async () => {
    const seeded = await seed();

    const result = await correctHandover(
      db,
      seeded.root,
      unchanged(seeded),
      NOW,
    );

    expect(result).toEqual({
      ok: false,
      code: "NO_CHANGES",
      message: "Nada foi alterado. Mude algum campo para registrar a correção.",
    });
    expect(await correctionRows(seeded.id)).toEqual([]);
    expect((await handoverRow(seeded.id)).updatedAt).not.toEqual(NOW);
  });

  it("texto igual depois da normalização (\\r\\n, NFC) e observação nula contra vazia não são mudança", async () => {
    const seeded = await seed();
    await db
      .update(handover)
      .set({ occurrencesText: "Linha 1\nLinha 2 café" })
      .where(eq(handover.id, seeded.id));
    const input = unchanged(seeded);
    input.occurrencesText = "Linha 1\r\nLinha 2 cafe\u{301}";

    const result = await correctHandover(db, seeded.root, input, NOW);

    expect(result).toMatchObject({ ok: false, code: "NO_CHANGES" });
  });

  it("operador do setor, mesmo quem entregou, recebe FORBIDDEN e nada é gravado", async () => {
    const seeded = await seed();
    const input = unchanged(seeded);
    input.occurrencesText = "Texto B";

    for (const actor of [seeded.bia, seeded.ana]) {
      const result = await correctHandover(db, actor, input, NOW);
      expect(result).toEqual({
        ok: false,
        code: "FORBIDDEN",
        message: "Só um administrador pode corrigir uma passagem confirmada.",
      });
    }
    expect(await correctionRows(seeded.id)).toEqual([]);
    expect((await handoverRow(seeded.id)).occurrencesText).toBe("Texto A");
  });

  it("operador de outro setor e id inexistente recebem o mesmo NOT_FOUND", async () => {
    const seeded = await seed();
    const input = unchanged(seeded);
    input.occurrencesText = "Texto B";

    const foreign = await correctHandover(db, seeded.caio, input, NOW);
    const missing = await correctHandover(
      db,
      seeded.caio,
      { ...input, id: NIL_ID },
      NOW,
    );

    expect(foreign).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Passagem não encontrada. Atualize a página.",
    });
    expect(missing).toEqual(foreign);
    expect(await correctionRows(seeded.id)).toEqual([]);
  });

  it("setor inativo é só leitura: SECTOR_INACTIVE e nenhuma correção é gravada (P26)", async () => {
    const seeded = await seed();
    await client.query("update sector set active = false where id = $1", [
      seeded.uld.id,
    ]);
    const input = unchanged(seeded);
    input.occurrencesText = "Texto B";

    const result = await correctHandover(db, seeded.root, input, NOW);

    expect(result).toEqual({
      ok: false,
      code: "SECTOR_INACTIVE",
      message:
        "Este setor está inativo. Peça a um administrador para reativá-lo.",
    });
    expect(await correctionRows(seeded.id)).toEqual([]);
    expect((await handoverRow(seeded.id)).occurrencesText).toBe("Texto A");
  });

  it.each([
    ["vazio", ""],
    ["só espaços", "   \n "],
    ["só tabulação", "\t\t"],
  ])("motivo %s: INVALID_INPUT no campo reason", async (_label, reason) => {
    const seeded = await seed();
    const input = { ...unchanged(seeded), reason, occurrencesText: "Texto B" };

    const result = await correctHandover(db, seeded.root, input, NOW);

    expect(result).toEqual({
      ok: false,
      code: "INVALID_INPUT",
      message: "Confira os campos e tente de novo.",
      fieldErrors: { reason: "Informe o motivo da correção." },
    });
    expect(await correctionRows(seeded.id)).toEqual([]);
  });

  it("motivo de 501 caracteres é recusado; 500 passa e é guardado sem espaços nas pontas", async () => {
    const seeded = await seed();
    const input = { ...unchanged(seeded), occurrencesText: "Texto B" };

    const long = await correctHandover(
      db,
      seeded.root,
      { ...input, reason: "m".repeat(501) },
      NOW,
    );
    expect(long).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { reason: "O motivo pode ter no máximo 500 caracteres." },
    });

    const fits = await correctHandover(
      db,
      seeded.root,
      { ...input, reason: `  ${"m".repeat(500)}  ` },
      NOW,
    );
    expect(fits).toEqual({ ok: true, changes: 1 });
    expect((await correctionRows(seeded.id))[0]?.reason).toBe("m".repeat(500));
  });

  it("ordem das checagens: operador sem motivo recebe FORBIDDEN, não o erro do motivo", async () => {
    const seeded = await seed();

    const result = await correctHandover(
      db,
      seeded.bia,
      { ...unchanged(seeded), reason: "" },
      NOW,
    );

    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it.each([
    "delivered",
    "draft",
  ] as const)("passagem %s: NOT_CONFIRMED e nada muda", async (status) => {
    const seeded = await seed(status);
    const input = { ...unchanged(seeded), occurrencesText: "Texto B" };

    const result = await correctHandover(db, seeded.root, input, NOW);

    expect(result).toEqual({
      ok: false,
      code: "NOT_CONFIRMED",
      message:
        "Só passagens confirmadas passam pela correção com motivo. Edite a passagem direto.",
    });
    expect((await handoverRow(seeded.id)).occurrencesText).toBe("Texto A");
    expect(await correctionRows(seeded.id)).toEqual([]);
  });

  it("item que a passagem não tem (ou de outro setor): NOT_FOUND e a transação inteira é recusada", async () => {
    const seeded = await seed();
    const stranger = await insertItem(db, {
      sectorId: seeded.other.id,
      name: "Alheio",
    });
    const input = unchanged(seeded);
    input.occurrencesText = "Texto B";
    input.items = [
      ...input.items,
      { itemId: stranger.id, quantity: 1, note: "" },
    ];

    const result = await correctHandover(db, seeded.root, input, NOW);

    expect(result).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Item não encontrado. Atualize a página.",
    });
    expect((await handoverRow(seeded.id)).occurrencesText).toBe("Texto A");
    expect(await correctionRows(seeded.id)).toEqual([]);
  });

  it.each([
    ["negativa", -1],
    ["decimal", 1.5],
    ["acima do teto", 100_000],
  ])("quantidade %s: INVALID_INPUT em items", async (_label, quantity) => {
    const seeded = await seed();
    const input = unchanged(seeded);
    input.items = [{ itemId: seeded.redes.id, quantity, note: "" }];

    const result = await correctHandover(db, seeded.root, input, NOW);

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { items: "Informe um número inteiro de 0 a 99.999." },
    });
  });

  it("quantidade no teto (99.999) passa", async () => {
    const seeded = await seed();
    const input = unchanged(seeded);
    input.items = [{ itemId: seeded.redes.id, quantity: 99_999, note: "" }];

    const result = await correctHandover(db, seeded.root, input, NOW);

    expect(result).toEqual({ ok: true, changes: 1 });
  });

  it("item repetido, observação longa e texto longo viram INVALID_INPUT", async () => {
    const seeded = await seed();

    const duplicated = unchanged(seeded);
    duplicated.items = [
      { itemId: seeded.redes.id, quantity: 4, note: "" },
      { itemId: seeded.redes.id, quantity: 5, note: "" },
    ];
    expect(
      await correctHandover(db, seeded.root, duplicated, NOW),
    ).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { items: "Item repetido. Atualize a página." },
    });

    const longNote = unchanged(seeded);
    longNote.items = [
      { itemId: seeded.redes.id, quantity: 3, note: "n".repeat(201) },
    ];
    expect(await correctHandover(db, seeded.root, longNote, NOW)).toMatchObject(
      {
        ok: false,
        fieldErrors: {
          items: "A observação pode ter no máximo 200 caracteres.",
        },
      },
    );

    const longText = { ...unchanged(seeded), nextShiftText: "t".repeat(2001) };
    expect(await correctHandover(db, seeded.root, longText, NOW)).toMatchObject(
      {
        ok: false,
        fieldErrors: {
          nextShiftText: "O texto pode ter no máximo 2.000 caracteres.",
        },
      },
    );
    expect(await correctionRows(seeded.id)).toEqual([]);
  });

  it("item ausente do envio fica como está (só os enviados entram no diff)", async () => {
    const seeded = await seed();
    const input = unchanged(seeded);
    input.items = [{ itemId: seeded.redes.id, quantity: 4, note: "" }];

    const result = await correctHandover(db, seeded.root, input, NOW);

    expect(result).toEqual({ ok: true, changes: 1 });
    expect((await lineOf(seeded.id, seeded.rolos.id)).quantity).toBe(10);
  });

  it("limpar o texto grava a correção com novo valor vazio", async () => {
    const seeded = await seed();
    const input = { ...unchanged(seeded), occurrencesText: "" };

    await correctHandover(db, seeded.root, input, NOW);

    const [row] = await correctionRows(seeded.id);
    expect(row).toMatchObject({
      field: "occurrences_text",
      oldValue: "Texto A",
      newValue: "",
    });
  });
});
