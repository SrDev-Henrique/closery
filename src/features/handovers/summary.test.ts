import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { item } from "@/db/schema/catalog";
import { sector } from "@/db/schema/sectors";
import type { Authz } from "@/features/authz/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverCorrection,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { getHandoverSummary } from "./summary";

const NIL_ID = "00000000-0000-4000-8000-000000000000";

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

async function seed() {
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
  return {
    uld,
    ana,
    bia,
    root,
    turno,
    anaAuthz: operator(ana.id, "Ana Teste", uld.id),
    biaAuthz: operator(bia.id, "Bia Teste", uld.id),
    caioAuthz: operator(caio.id, "Caio Teste", other.id),
  };
}

async function mustSummary(actor: Authz, id: string) {
  const result = await getHandoverSummary(db, actor, id);
  if (!result.ok) throw new Error(`resumo falhou: ${result.message}`);
  return result.summary;
}

describe("getHandoverSummary", () => {
  it("destaca valor diferente de zero ou observação e recolhe os zerados", async () => {
    const { uld, ana, turno, biaAuthz } = await seed();
    const redes = await insertItem(db, {
      sectorId: uld.id,
      name: "Redes danificadas",
      unit: "rede",
      kind: "control",
    });
    const cabos = await insertItem(db, {
      sectorId: uld.id,
      name: "Cabos soltos",
      kind: "control",
    });
    const lacres = await insertItem(db, {
      sectorId: uld.id,
      name: "Lacres rompidos",
      kind: "control",
    });
    const rolos = await insertItem(db, {
      sectorId: uld.id,
      name: "Rolos de fita",
      unit: "rolo",
      kind: "stock",
    });
    const paletes = await insertItem(db, {
      sectorId: uld.id,
      name: "Paletes",
      kind: "stock",
    });
    const passagem = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "delivered",
      deliveredBy: ana.id,
      occurrencesText: "Chuva forte às 10h.",
      nextShiftText: "Conferir a rede 7.",
    });
    for (const [line, quantity, note] of [
      [redes, 3, null],
      [cabos, 0, null],
      [lacres, 0, "Dois lacres no chão, já recolhidos"],
      [rolos, 12, null],
      [paletes, 0, null],
    ] as const) {
      await insertHandoverItem(db, {
        handoverId: passagem.id,
        itemId: line.id,
        quantity,
        note,
        snapshot: true,
      });
    }

    const summary = await mustSummary(biaAuthz, passagem.id);

    expect(summary.highlighted.controls).toEqual([
      {
        itemId: redes.id,
        name: "Redes danificadas",
        unit: "rede",
        kind: "control",
        quantity: 3,
        note: null,
      },
      {
        itemId: lacres.id,
        name: "Lacres rompidos",
        unit: "unidade",
        kind: "control",
        quantity: 0,
        note: "Dois lacres no chão, já recolhidos",
      },
    ]);
    expect(summary.highlighted.stock.map((line) => line.name)).toEqual([
      "Rolos de fita",
    ]);
    expect(summary.zeroed.count).toBe(2);
    expect(summary.zeroed.items.map((line) => line.name)).toEqual([
      "Cabos soltos",
      "Paletes",
    ]);
    expect(summary.nextShiftText).toBe("Conferir a rede 7.");
    expect(summary.occurrencesText).toBe("Chuva forte às 10h.");
  });

  it("passagem sem nenhuma linha de item: tudo vazio, sem erro", async () => {
    const { uld, ana, turno, biaAuthz } = await seed();
    const passagem = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "delivered",
      deliveredBy: ana.id,
    });

    const summary = await mustSummary(biaAuthz, passagem.id);

    expect(summary.highlighted).toEqual({ controls: [], stock: [] });
    expect(summary.zeroed).toEqual({ count: 0, items: [] });
    expect(summary.corrections).toEqual([]);
    expect(summary.corrected).toBe(false);
  });

  it("o snapshot vence a renomeação posterior do item e do turno", async () => {
    const { uld, ana, turno, biaAuthz } = await seed();
    const redes = await insertItem(db, {
      sectorId: uld.id,
      name: "Redes danificadas",
      unit: "rede",
    });
    const passagem = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "delivered",
      deliveredBy: ana.id,
      shiftNameSnapshot: "Manhã",
    });
    await insertHandoverItem(db, {
      handoverId: passagem.id,
      itemId: redes.id,
      quantity: 2,
      snapshot: true,
    });
    await db
      .update(item)
      .set({ name: "Nome novo", unit: "peça", kind: "stock" })
      .where(eq(item.id, redes.id));

    const summary = await mustSummary(biaAuthz, passagem.id);

    expect(summary.highlighted.controls).toHaveLength(1);
    expect(summary.highlighted.stock).toHaveLength(0);
    expect(summary.highlighted.controls[0]).toMatchObject({
      name: "Redes danificadas",
      unit: "rede",
      kind: "control",
    });
    expect(summary.shiftName).toBe("Manhã");
  });

  it("sem snapshot (rascunho) usa o cadastro vivo; o nome do turno vem do cadastro", async () => {
    const { uld, turno, biaAuthz } = await seed();
    const redes = await insertItem(db, {
      sectorId: uld.id,
      name: "Redes danificadas",
      unit: "rede",
    });
    const passagem = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
    });
    await insertHandoverItem(db, {
      handoverId: passagem.id,
      itemId: redes.id,
      quantity: 4,
    });

    const summary = await mustSummary(biaAuthz, passagem.id);

    expect(summary.status).toBe("draft");
    expect(summary.situation).toBeNull();
    expect(summary.highlighted.controls[0]).toMatchObject({
      name: "Redes danificadas",
      unit: "rede",
      quantity: 4,
    });
    expect(summary.shiftName).toBe("Manhã");
  });

  it("situation: a entregue mais recente é awaiting; a mais antiga não confirmada é unconfirmed", async () => {
    const { uld, ana, root, turno, biaAuthz } = await seed();
    const tarde = await insertShift(db, { sectorId: uld.id, name: "Tarde" });
    const older = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: spDate("2026-11-20", "14:00"),
    });
    const newer = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: tarde.id,
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: spDate("2026-11-20", "22:00"),
    });
    const confirmed = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      operationalDate: "2026-11-19",
      status: "confirmed",
      deliveredBy: ana.id,
      confirmedBy: root.id,
      deliveredAt: spDate("2026-11-19", "14:00"),
      confirmedAt: spDate("2026-11-19", "14:30"),
      confirmationNote: "Recebido",
    });

    expect((await mustSummary(biaAuthz, older.id)).situation).toBe(
      "unconfirmed",
    );
    expect((await mustSummary(biaAuthz, newer.id)).situation).toBe("awaiting");
    const summary = await mustSummary(biaAuthz, confirmed.id);
    expect(summary.situation).toBe("confirmed");
    expect(summary.confirmedByName).toBe("Admin Teste");
    expect(summary.confirmationNote).toBe("Recebido");
    expect(summary.deliveredByName).toBe("Ana Teste");
  });

  it("situation: uma entregue antiga com uma confirmada mais nova no setor é unconfirmed (F3-9b)", async () => {
    const { uld, ana, root, turno, biaAuthz } = await seed();
    const tarde = await insertShift(db, { sectorId: uld.id, name: "Tarde" });
    const older = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: spDate("2026-11-20", "14:00"),
    });
    await insertHandover(db, {
      sectorId: uld.id,
      shiftId: tarde.id,
      status: "confirmed",
      deliveredBy: ana.id,
      confirmedBy: root.id,
      deliveredAt: spDate("2026-11-20", "22:00"),
      confirmedAt: spDate("2026-11-20", "22:30"),
    });

    expect((await mustSummary(biaAuthz, older.id)).situation).toBe(
      "unconfirmed",
    );
  });

  it("uma entregue mais nova de OUTRO setor não rebaixa a passagem para unconfirmed", async () => {
    const { uld, ana, turno, biaAuthz } = await seed();
    const mine = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: spDate("2026-11-20", "14:00"),
    });
    const outro = await insertSector(db, "Outro setor");
    const outroTurno = await insertShift(db, { sectorId: outro.id });
    await insertHandover(db, {
      sectorId: outro.id,
      shiftId: outroTurno.id,
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: spDate("2026-11-20", "23:00"),
    });

    expect((await mustSummary(biaAuthz, mine.id)).situation).toBe("awaiting");
  });

  it("correções em ordem, com o nome do item (snapshot) e quem corrigiu; selo corrected", async () => {
    const { uld, ana, root, turno } = await seed();
    const redes = await insertItem(db, {
      sectorId: uld.id,
      name: "Redes danificadas",
    });
    const passagem = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "confirmed",
      deliveredBy: ana.id,
      confirmedBy: root.id,
    });
    await insertHandoverItem(db, {
      handoverId: passagem.id,
      itemId: redes.id,
      quantity: 5,
      snapshot: true,
    });
    await db
      .update(item)
      .set({ name: "Renomeado" })
      .where(eq(item.id, redes.id));
    const second = await insertHandoverCorrection(db, {
      handoverId: passagem.id,
      field: "next_shift_text",
      oldValue: "a",
      newValue: "b",
      reason: "Segunda",
      correctedBy: root.id,
      correctedAt: spDate("2026-11-21", "10:00"),
    });
    const first = await insertHandoverCorrection(db, {
      handoverId: passagem.id,
      field: "item_quantity",
      itemId: redes.id,
      oldValue: "3",
      newValue: "5",
      reason: "Primeira",
      correctedBy: root.id,
      correctedAt: spDate("2026-11-21", "09:00"),
    });

    const summary = await mustSummary(
      {
        ...operator(root.id, "Admin Teste", uld.id),
        role: "admin",
        sectorId: null,
      },
      passagem.id,
    );

    expect(summary.corrected).toBe(true);
    expect(summary.corrections.map((c) => c.id)).toEqual([first.id, second.id]);
    expect(summary.corrections[0]).toMatchObject({
      field: "item_quantity",
      itemName: "Redes danificadas",
      oldValue: "3",
      newValue: "5",
      reason: "Primeira",
      correctedByName: "Admin Teste",
      correctedAt: spDate("2026-11-21", "09:00"),
    });
    expect(summary.corrections[1]).toMatchObject({
      field: "next_shift_text",
      itemName: null,
    });
  });

  it("devolve as capacidades de quem pediu", async () => {
    const { uld, ana, turno, anaAuthz, biaAuthz } = await seed();
    const passagem = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "delivered",
      deliveredBy: ana.id,
    });

    expect((await mustSummary(anaAuthz, passagem.id)).capabilities).toEqual({
      canView: true,
      canEditDirectly: true,
      canDeliver: false,
      canConfirm: false,
      canCorrectWithReason: false,
    });
    expect((await mustSummary(biaAuthz, passagem.id)).capabilities).toEqual({
      canView: true,
      canEditDirectly: false,
      canDeliver: false,
      canConfirm: true,
      canCorrectWithReason: false,
    });
  });

  it("setor inativo: a passagem continua legível para o operador do setor e para o admin", async () => {
    const { uld, ana, root, turno, anaAuthz } = await seed();
    const passagem = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "delivered",
      deliveredBy: ana.id,
    });
    await db.update(sector).set({ active: false }).where(eq(sector.id, uld.id));
    const adminAuthz: Authz = {
      userId: root.id,
      name: "Admin Teste",
      email: `${root.id}@example.test`,
      role: "admin",
      sectorId: null,
    };

    const asOperator = await getHandoverSummary(db, anaAuthz, passagem.id);
    const asAdmin = await getHandoverSummary(db, adminAuthz, passagem.id);

    expect(asOperator.ok).toBe(true);
    expect(asAdmin.ok).toBe(true);
  });

  it("sectorActive: true no setor ativo; false depois de desativar, para operador e admin", async () => {
    const { uld, ana, root, turno, anaAuthz } = await seed();
    const passagem = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "delivered",
      deliveredBy: ana.id,
    });
    const adminAuthz: Authz = {
      userId: root.id,
      name: "Admin Teste",
      email: `${root.id}@example.test`,
      role: "admin",
      sectorId: null,
    };

    expect((await mustSummary(anaAuthz, passagem.id)).sectorActive).toBe(true);
    expect((await mustSummary(adminAuthz, passagem.id)).sectorActive).toBe(
      true,
    );

    await db.update(sector).set({ active: false }).where(eq(sector.id, uld.id));

    expect((await mustSummary(anaAuthz, passagem.id)).sectorActive).toBe(false);
    expect((await mustSummary(adminAuthz, passagem.id)).sectorActive).toBe(
      false,
    );
  });

  it("outro setor e id inexistente devolvem NOT_FOUND idêntico", async () => {
    const { uld, ana, turno, caioAuthz } = await seed();
    const passagem = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "delivered",
      deliveredBy: ana.id,
    });

    const foreign = await getHandoverSummary(db, caioAuthz, passagem.id);
    const missing = await getHandoverSummary(db, caioAuthz, NIL_ID);

    expect(foreign).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Passagem não encontrada. Atualize a página.",
    });
    expect(missing).toEqual(foreign);
  });
});
