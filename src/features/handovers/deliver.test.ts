import type { PGlite } from "@electric-sql/pglite";
import { and, count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { item, shift } from "@/db/schema/catalog";
import { handover, handoverItem } from "@/db/schema/handovers";

import { authzOf } from "../../../test/authz";
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
import { deliverHandover } from "./deliver";
import { saveHandoverField } from "./draft";

const DAY = "2026-11-21";
const NOW = spDate(DAY, "14:05");
const LATER = spDate(DAY, "14:30");

describe("deliverHandover", () => {
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

  async function world() {
    const sector = await insertSector(db, "ULD");
    const turno = await insertShift(db, { sectorId: sector.id, name: "Manhã" });
    const rede = await insertItem(db, {
      sectorId: sector.id,
      name: "Rede de proteção",
      unit: "rede",
      kind: "control",
    });
    const rolo = await insertItem(db, {
      sectorId: sector.id,
      name: "Rolo de fita",
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
    const adminUser = await insertUser(db, {
      role: "admin",
      sectorId: null,
      name: "Admin Teste",
    });
    const ref = {
      sectorId: sector.id,
      shiftId: turno.id,
      operationalDate: DAY,
    };
    return {
      sector,
      turno,
      rede,
      rolo,
      ref,
      operatorAna: authzOf({
        role: "operator",
        sectorId: sector.id,
        userId: ana.id,
        name: "Ana Teste",
      }),
      operatorBia: authzOf({
        role: "operator",
        sectorId: sector.id,
        userId: bia.id,
        name: "Bia Teste",
      }),
      admin: authzOf({
        role: "admin",
        userId: adminUser.id,
        name: "Admin Teste",
      }),
    };
  }

  async function onlyHandover() {
    const [row] = await db.select().from(handover);
    if (!row) throw new Error("passagem ausente");
    return row;
  }

  async function lines() {
    return db.select().from(handoverItem);
  }

  async function handoverCount(): Promise<number> {
    const [row] = await db.select({ total: count() }).from(handover);
    return row?.total ?? 0;
  }

  it("entrega um rascunho: status, quem, quando, nome do turno; devolve id e hora", async () => {
    const { ref, operatorAna } = await world();
    const saved = await saveHandoverField(
      db,
      operatorAna,
      { ...ref, field: "occurrences", value: "Tudo certo" },
      NOW,
    );

    const result = await deliverHandover(db, operatorAna, ref, LATER);

    expect(result).toEqual({
      ok: true,
      id: saved.ok ? saved.handoverId : "?",
      deliveredAt: LATER,
    });
    const row = await onlyHandover();
    expect(row).toMatchObject({
      status: "delivered",
      deliveredBy: operatorAna.userId,
      shiftNameSnapshot: "Manhã",
      updatedBy: operatorAna.userId,
      occurrencesText: "Tudo certo",
      confirmedBy: null,
      confirmedAt: null,
    });
    expect(row.deliveredAt?.toISOString()).toBe(LATER.toISOString());
    expect(row.updatedAt.toISOString()).toBe(LATER.toISOString());
  });

  it("sem rascunho: cria e entrega na mesma transação", async () => {
    const { ref, operatorAna } = await world();

    const result = await deliverHandover(db, operatorAna, ref, NOW);

    expect(result).toMatchObject({ ok: true });
    expect(await handoverCount()).toBe(1);
    expect((await onlyHandover()).status).toBe("delivered");
  });

  it("completa com 0 todo item ativo que faltava, mantém o que foi digitado e preenche os snapshots", async () => {
    const { ref, operatorAna, rede, rolo } = await world();
    await saveHandoverField(
      db,
      operatorAna,
      { ...ref, field: "quantity", itemId: rede.id, value: 4 },
      NOW,
    );
    await saveHandoverField(
      db,
      operatorAna,
      { ...ref, field: "note", itemId: rede.id, value: "duas rasgadas" },
      NOW,
    );

    await deliverHandover(db, operatorAna, ref, LATER);

    const all = await lines();
    expect(all).toHaveLength(2);
    expect(all.find((line) => line.itemId === rede.id)).toMatchObject({
      quantity: 4,
      note: "duas rasgadas",
      itemNameSnapshot: "Rede de proteção",
      itemUnitSnapshot: "rede",
      itemKindSnapshot: "control",
    });
    expect(all.find((line) => line.itemId === rolo.id)).toMatchObject({
      quantity: 0,
      note: null,
      itemNameSnapshot: "Rolo de fita",
      itemUnitSnapshot: "rolo",
      itemKindSnapshot: "stock",
    });
  });

  it("item inativo sem linha NÃO entra; item desativado depois de digitado MANTÉM a linha, com snapshot do cadastro", async () => {
    const { sector, ref, operatorAna, rede, rolo } = await world();
    await insertItem(db, {
      sectorId: sector.id,
      name: "Item antigo",
      active: false,
    });
    await saveHandoverField(
      db,
      operatorAna,
      { ...ref, field: "quantity", itemId: rede.id, value: 6 },
      NOW,
    );
    await db.update(item).set({ active: false }).where(eq(item.id, rede.id));

    await deliverHandover(db, operatorAna, ref, LATER);

    const all = await lines();
    expect(all.map((line) => line.itemId).sort()).toEqual(
      [rede.id, rolo.id].sort(),
    );
    expect(all.find((line) => line.itemId === rede.id)).toMatchObject({
      quantity: 6,
      itemNameSnapshot: "Rede de proteção",
    });
  });

  it("item de outro setor nunca entra nas linhas", async () => {
    const { ref, operatorAna } = await world();
    const otherSector = await insertSector(db, "Outro");
    await insertItem(db, { sectorId: otherSector.id });

    await deliverHandover(db, operatorAna, ref, NOW);

    expect(await lines()).toHaveLength(2);
  });

  it("entregar tudo zerado e sem texto é permitido", async () => {
    const { ref, operatorBia } = await world();

    const result = await deliverHandover(db, operatorBia, ref, NOW);

    expect(result).toMatchObject({ ok: true });
    const row = await onlyHandover();
    expect(row).toMatchObject({
      status: "delivered",
      occurrencesText: "",
      nextShiftText: "",
    });
    expect((await lines()).every((line) => line.quantity === 0)).toBe(true);
  });

  it("setor sem itens: entrega sem nenhuma linha", async () => {
    const sector = await insertSector(db, "Vazio");
    const turno = await insertShift(db, { sectorId: sector.id });
    const operator = authzOf({ role: "operator", sectorId: sector.id });
    const user = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
    });

    const result = await deliverHandover(
      db,
      { ...operator, userId: user.id },
      { sectorId: sector.id, shiftId: turno.id, operationalDate: DAY },
      NOW,
    );

    expect(result).toMatchObject({ ok: true });
    expect(await lines()).toEqual([]);
  });

  it("o segundo 'Entregar' devolve ALREADY_DELIVERED com nome e hora de quem entregou, sem mudar nada", async () => {
    const { ref, operatorAna, operatorBia } = await world();
    await deliverHandover(db, operatorAna, ref, NOW);
    const before = await onlyHandover();

    const again = await deliverHandover(db, operatorBia, ref, LATER);
    const sameUser = await deliverHandover(db, operatorAna, ref, LATER);

    expect(again).toEqual({
      ok: false,
      code: "ALREADY_DELIVERED",
      message: "Esta passagem já foi entregue por Ana Teste às 14:05.",
    });
    expect(sameUser).toMatchObject({
      ok: false,
      code: "ALREADY_DELIVERED",
    });
    expect(await onlyHandover()).toEqual(before);
  });

  it("passagem já confirmada também recusa com ALREADY_DELIVERED", async () => {
    const { sector, turno, ref, operatorBia, operatorAna } = await world();
    await insertHandover(db, {
      sectorId: sector.id,
      shiftId: turno.id,
      operationalDate: DAY,
      status: "confirmed",
      deliveredBy: operatorAna.userId,
      deliveredAt: spDate(DAY, "13:50"),
      confirmedBy: operatorBia.userId,
    });

    const result = await deliverHandover(db, operatorBia, ref, NOW);

    expect(result).toEqual({
      ok: false,
      code: "ALREADY_DELIVERED",
      message: "Esta passagem já foi entregue por Ana Teste às 13:50.",
    });
  });

  it("admin entrega a passagem de qualquer setor", async () => {
    const { ref, admin } = await world();

    const result = await deliverHandover(db, admin, ref, NOW);

    expect(result).toMatchObject({ ok: true });
    expect((await onlyHandover()).deliveredBy).toBe(admin.userId);
  });

  it("operador de outro setor: NOT_FOUND, nada criado", async () => {
    const { ref } = await world();
    const otherSector = await insertSector(db, "Outro");
    const stranger = authzOf({ role: "operator", sectorId: otherSector.id });

    const result = await deliverHandover(db, stranger, ref, NOW);

    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await handoverCount()).toBe(0);
  });

  it("criação recusada (data futura, 32 dias, turno inativo, setor inativo) não deixa rascunho", async () => {
    const { sector, turno, ref, operatorAna } = await world();

    for (const operationalDate of ["2026-11-22", "2026-10-20"]) {
      expect(
        await deliverHandover(
          db,
          operatorAna,
          { ...ref, operationalDate },
          NOW,
        ),
      ).toMatchObject({ ok: false, code: "DATE_OUT_OF_RANGE" });
    }
    await db.update(shift).set({ active: false }).where(eq(shift.id, turno.id));
    expect(await deliverHandover(db, operatorAna, ref, NOW)).toMatchObject({
      ok: false,
      code: "SHIFT_INACTIVE",
    });
    await db.update(shift).set({ active: true }).where(eq(shift.id, turno.id));
    await client.query("update sector set active = false where id = $1", [
      sector.id,
    ]);
    expect(await deliverHandover(db, operatorAna, ref, NOW)).toMatchObject({
      ok: false,
      code: "SECTOR_INACTIVE",
    });
    expect(await handoverCount()).toBe(0);
  });

  it("rascunho existente de setor inativo: SECTOR_INACTIVE e continua rascunho (P26)", async () => {
    const { sector, turno, ref, operatorAna } = await world();
    await insertHandover(db, {
      sectorId: sector.id,
      shiftId: turno.id,
      operationalDate: DAY,
    });
    await client.query("update sector set active = false where id = $1", [
      sector.id,
    ]);

    const result = await deliverHandover(db, operatorAna, ref, NOW);

    expect(result).toMatchObject({ ok: false, code: "SECTOR_INACTIVE" });
    expect((await onlyHandover()).status).toBe("draft");
  });

  it("rascunho existente de turno inativo continua entregável", async () => {
    const { sector, turno, ref, operatorAna } = await world();
    await insertHandover(db, {
      sectorId: sector.id,
      shiftId: turno.id,
      operationalDate: DAY,
    });
    await db.update(shift).set({ active: false }).where(eq(shift.id, turno.id));

    const result = await deliverHandover(db, operatorAna, ref, NOW);

    expect(result).toMatchObject({ ok: true });
    expect((await onlyHandover()).status).toBe("delivered");
  });

  it("depois de entregue, o snapshot do turno e dos itens não acompanha renomeação", async () => {
    const { turno, ref, operatorAna, rede } = await world();
    await deliverHandover(db, operatorAna, ref, NOW);

    await db
      .update(shift)
      .set({ name: "Turno renomeado" })
      .where(eq(shift.id, turno.id));
    await db
      .update(item)
      .set({ name: "Rede renomeada" })
      .where(eq(item.id, rede.id));

    expect((await onlyHandover()).shiftNameSnapshot).toBe("Manhã");
    const [line] = await db
      .select()
      .from(handoverItem)
      .where(and(eq(handoverItem.itemId, rede.id)));
    expect(line?.itemNameSnapshot).toBe("Rede de proteção");
  });

  it("linhas de uma passagem já existente não são duplicadas (a PK protege)", async () => {
    const { sector, turno, ref, operatorAna, rede } = await world();
    const draft = await insertHandover(db, {
      sectorId: sector.id,
      shiftId: turno.id,
      operationalDate: DAY,
    });
    await insertHandoverItem(db, {
      handoverId: draft.id,
      itemId: rede.id,
      quantity: 9,
    });

    await deliverHandover(db, operatorAna, ref, NOW);

    const all = await lines();
    expect(all).toHaveLength(2);
    expect(all.find((line) => line.itemId === rede.id)?.quantity).toBe(9);
  });
});
