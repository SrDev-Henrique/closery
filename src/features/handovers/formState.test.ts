import type { PGlite } from "@electric-sql/pglite";
import { count, eq } from "drizzle-orm";
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
import {
  getHandoverFormState,
  getHandoverFormStateById,
  type HandoverFormState,
} from "./formState";

const NIL_ID = "00000000-0000-4000-8000-000000000000";
const NOW = spDate("2026-11-21", "14:05");
const DAY = "2026-11-21";

function stateOf(
  result: { ok: true; state: HandoverFormState } | { ok: false },
): HandoverFormState {
  if (!result.ok) throw new Error("esperava ok");
  return result.state;
}

describe("estado do formulário da passagem", () => {
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
    const ref = {
      sectorId: sector.id,
      shiftId: turno.id,
      operationalDate: DAY,
    };
    const operator = authzOf({
      role: "operator",
      sectorId: sector.id,
      userId: ana.id,
      name: "Ana Teste",
    });
    const other = authzOf({
      role: "operator",
      sectorId: sector.id,
      userId: bia.id,
      name: "Bia Teste",
    });
    return { sector, turno, rede, rolo, ana, bia, ref, operator, other };
  }

  async function totals() {
    const [h] = await db.select({ total: count() }).from(handover);
    const [i] = await db.select({ total: count() }).from(handoverItem);
    return { handovers: h?.total ?? 0, items: i?.total ?? 0 };
  }

  describe("getHandoverFormState", () => {
    it("sem linha: valores padrão (0 e vazio), mode draft, e NÃO escreve nada", async () => {
      const { ref, operator, rede, rolo } = await world();
      const before = await totals();

      const first = stateOf(await getHandoverFormState(db, operator, ref, NOW));
      const second = stateOf(
        await getHandoverFormState(db, operator, ref, NOW),
      );

      expect(first).toEqual(second);
      expect(first).toMatchObject({
        ref,
        handoverId: null,
        status: null,
        sectorName: "ULD",
        shiftName: "Manhã",
        occurrencesText: "",
        nextShiftText: "",
        saved: null,
        deliveredByName: null,
        deliveredAt: null,
        mode: "draft",
      });
      expect(first.controls).toEqual([
        {
          itemId: rede.id,
          name: "Rede de proteção",
          unit: "rede",
          kind: "control",
          quantity: 0,
          note: "",
        },
      ]);
      expect(first.stock).toEqual([
        {
          itemId: rolo.id,
          name: "Rolo de fita",
          unit: "rolo",
          kind: "stock",
          quantity: 0,
          note: "",
        },
      ]);
      expect(await totals()).toEqual(before);
    });

    it("itens inativos ficam fora; a ordem é a do cadastro", async () => {
      const { sector, ref, operator } = await world();
      await insertItem(db, {
        sectorId: sector.id,
        name: "Item antigo",
        active: false,
      });
      const first = await insertItem(db, {
        sectorId: sector.id,
        name: "Primeiro",
        sortOrder: 0,
      });

      const state = stateOf(await getHandoverFormState(db, operator, ref, NOW));

      expect(state.controls.map((line) => line.name)).toEqual([
        "Primeiro",
        "Rede de proteção",
      ]);
      expect(state.controls[0]?.itemId).toBe(first.id);
    });

    it("rascunho salvo: traz quantidades, observações e 'salvo por'", async () => {
      const { sector, turno, ref, operator, rede, ana } = await world();
      const draft = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: DAY,
        occurrencesText: "Chuva forte",
        nextShiftText: "Conferir a doca",
        updatedBy: ana.id,
      });
      await insertHandoverItem(db, {
        handoverId: draft.id,
        itemId: rede.id,
        quantity: 7,
        note: "duas rasgadas",
      });

      const state = stateOf(await getHandoverFormState(db, operator, ref, NOW));

      expect(state).toMatchObject({
        handoverId: draft.id,
        status: "draft",
        occurrencesText: "Chuva forte",
        nextShiftText: "Conferir a doca",
        mode: "draft",
      });
      expect(state.controls[0]).toMatchObject({
        quantity: 7,
        note: "duas rasgadas",
      });
      expect(state.stock[0]).toMatchObject({ quantity: 0, note: "" });
      expect(state.saved).toMatchObject({ byName: "Ana Teste" });
      expect(state.saved?.at).toBeInstanceOf(Date);
    });

    it("rascunho com linha de item que foi desativado: o item não aparece", async () => {
      const { sector, turno, ref, operator, rede } = await world();
      const draft = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: DAY,
      });
      await insertHandoverItem(db, {
        handoverId: draft.id,
        itemId: rede.id,
        quantity: 4,
      });
      await db.update(item).set({ active: false }).where(eq(item.id, rede.id));

      const state = stateOf(await getHandoverFormState(db, operator, ref, NOW));

      expect(state.controls).toEqual([]);
    });

    it("entregue: usa os snapshots (renomear o item depois não muda) e mantém a linha do item desativado", async () => {
      const { sector, turno, ref, rede, ana, other } = await world();
      const delivered = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: DAY,
        status: "delivered",
        deliveredBy: ana.id,
        deliveredAt: spDate(DAY, "14:00"),
        shiftNameSnapshot: "Turno da Manhã",
        updatedBy: ana.id,
      });
      await insertHandoverItem(db, {
        handoverId: delivered.id,
        itemId: rede.id,
        quantity: 3,
        snapshot: true,
      });
      await db
        .update(item)
        .set({ name: "Rede nova", unit: "peça", active: false })
        .where(eq(item.id, rede.id));

      const state = stateOf(await getHandoverFormState(db, other, ref, NOW));

      expect(state.shiftName).toBe("Turno da Manhã");
      expect(state.controls).toEqual([
        {
          itemId: rede.id,
          name: "Rede de proteção",
          unit: "rede",
          kind: "control",
          quantity: 3,
          note: "",
        },
      ]);
      expect(state.stock).toEqual([]);
      expect(state).toMatchObject({
        status: "delivered",
        deliveredByName: "Ana Teste",
        mode: null,
      });
      expect(state.deliveredAt?.toISOString()).toBe(
        spDate(DAY, "14:00").toISOString(),
      );
    });

    it("entregue sem snapshot (dado antigo): cai para o cadastro vivo", async () => {
      const { sector, turno, ref, rede, ana, operator } = await world();
      const delivered = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: DAY,
        status: "delivered",
        deliveredBy: ana.id,
      });
      await insertHandoverItem(db, {
        handoverId: delivered.id,
        itemId: rede.id,
        quantity: 2,
      });

      const state = stateOf(await getHandoverFormState(db, operator, ref, NOW));

      expect(state.controls[0]).toMatchObject({
        name: "Rede de proteção",
        unit: "rede",
        quantity: 2,
      });
    });

    it("modo por papel e estado: entregue (quem entregou e admin editam), confirmada (só admin corrige)", async () => {
      const { sector, turno, ref, ana, bia, operator, other } = await world();
      const admin = authzOf({ role: "admin" });
      const row = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: DAY,
        status: "delivered",
        deliveredBy: ana.id,
      });

      const modes = async (actor: typeof operator) =>
        stateOf(await getHandoverFormState(db, actor, ref, NOW)).mode;
      expect(await modes(operator)).toBe("edit");
      expect(await modes(other)).toBeNull();
      expect(await modes(admin)).toBe("edit");

      await db
        .update(handover)
        .set({
          status: "confirmed",
          confirmedBy: bia.id,
          confirmedAt: spDate(DAY, "14:10"),
        })
        .where(eq(handover.id, row.id));
      expect(await modes(operator)).toBeNull();
      expect(await modes(other)).toBeNull();
      expect(await modes(admin)).toBe("correction");
    });

    it("operador de outro setor e setor inexistente: NOT_FOUND", async () => {
      const { ref } = await world();
      const otherSector = await insertSector(db, "Outro");
      const stranger = authzOf({ role: "operator", sectorId: otherSector.id });

      expect(await getHandoverFormState(db, stranger, ref, NOW)).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
      });
      expect(
        await getHandoverFormState(
          db,
          authzOf({ role: "admin" }),
          { ...ref, sectorId: NIL_ID },
          NOW,
        ),
      ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    });

    it("setor inativo: SECTOR_INACTIVE", async () => {
      const { sector, ref, operator } = await world();
      await client.query("update sector set active = false where id = $1", [
        sector.id,
      ]);

      expect(await getHandoverFormState(db, operator, ref, NOW)).toMatchObject({
        ok: false,
        code: "SECTOR_INACTIVE",
      });
    });

    it("turno de outro setor ou inexistente: NOT_FOUND", async () => {
      const { ref, operator } = await world();
      const otherSector = await insertSector(db, "Outro");
      const foreign = await insertShift(db, { sectorId: otherSector.id });

      for (const shiftId of [foreign.id, NIL_ID]) {
        expect(
          await getHandoverFormState(db, operator, { ...ref, shiftId }, NOW),
        ).toMatchObject({ ok: false, code: "NOT_FOUND" });
      }
    });

    it("sem linha: turno inativo e data fora da janela são recusados; com linha, continua legível", async () => {
      const { sector, turno, ref, operator } = await world();

      for (const operationalDate of [
        "2026-11-22",
        "2026-10-20",
        "2026-02-30",
      ]) {
        expect(
          await getHandoverFormState(
            db,
            operator,
            { ...ref, operationalDate },
            NOW,
          ),
        ).toMatchObject({ ok: false, code: "DATE_OUT_OF_RANGE" });
      }

      await db
        .update(shift)
        .set({ active: false })
        .where(eq(shift.id, turno.id));
      expect(await getHandoverFormState(db, operator, ref, NOW)).toMatchObject({
        ok: false,
        code: "SHIFT_INACTIVE",
      });

      await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: "2026-09-01",
      });
      const old = await getHandoverFormState(
        db,
        operator,
        { ...ref, operationalDate: "2026-09-01" },
        NOW,
      );
      expect(old).toMatchObject({ ok: true });
      expect(stateOf(old).mode).toBe("draft");
    });
  });

  describe("getHandoverFormStateById", () => {
    it("lê pelo id, com o nome do turno do snapshot quando existe", async () => {
      const { sector, turno, operator, ana, ref } = await world();
      const row = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: DAY,
        status: "delivered",
        deliveredBy: ana.id,
        shiftNameSnapshot: "Manhã (antigo)",
      });

      const state = stateOf(
        await getHandoverFormStateById(db, operator, row.id),
      );

      expect(state).toMatchObject({
        handoverId: row.id,
        ref,
        shiftName: "Manhã (antigo)",
        status: "delivered",
        mode: "edit",
      });
    });

    it("sem snapshot usa o nome vivo do turno", async () => {
      const { sector, turno, operator } = await world();
      const row = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
      });

      const state = stateOf(
        await getHandoverFormStateById(db, operator, row.id),
      );

      expect(state.shiftName).toBe("Manhã");
    });

    it("id inexistente e operador de outro setor: NOT_FOUND com a mesma mensagem", async () => {
      const { sector, turno } = await world();
      const row = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
      });
      const otherSector = await insertSector(db, "Outro");
      const stranger = authzOf({ role: "operator", sectorId: otherSector.id });

      const missing = await getHandoverFormStateById(db, stranger, NIL_ID);
      const foreign = await getHandoverFormStateById(db, stranger, row.id);

      expect(missing).toEqual({
        ok: false,
        code: "NOT_FOUND",
        message: "Passagem não encontrada. Atualize a página.",
      });
      expect(foreign).toEqual(missing);
    });

    it("setor inativo: SECTOR_INACTIVE", async () => {
      const { sector, turno } = await world();
      const row = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
      });
      await client.query("update sector set active = false where id = $1", [
        sector.id,
      ]);

      expect(
        await getHandoverFormStateById(db, authzOf({ role: "admin" }), row.id),
      ).toMatchObject({ ok: false, code: "SECTOR_INACTIVE" });
    });
  });
});
