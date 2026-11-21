import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertSector, insertShift } from "../../../test/fixtures";
import { PAGE_SIZE } from "./pagination";
import {
  createShift,
  getShiftFormDefaults,
  listShifts,
  moveShift,
  setShiftActive,
  updateShift,
} from "./shifts";

const NIL_ID = "00000000-0000-4000-8000-000000000000";

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("valor ausente no teste");
  return value;
}

describe("turnos (domínio)", () => {
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

  async function orderOf(sectorId: string): Promise<string[]> {
    const page = await listShifts(db, { sectorId, page: 1 });
    return page.rows.map((row) => row.name);
  }

  describe("listShifts", () => {
    it("lista só o setor pedido, por ordem, com horário em HH:mm", async () => {
      const uld = await insertSector(db, "ULD");
      const other = await insertSector(db, "Outro");
      await insertShift(db, {
        sectorId: uld.id,
        name: "Tarde",
        startsAt: "14:00",
        endsAt: "22:00",
      });
      await insertShift(db, {
        sectorId: uld.id,
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
        sortOrder: 0,
      });
      await insertShift(db, { sectorId: other.id, name: "Alheio" });

      const page = await listShifts(db, { sectorId: uld.id, page: 1 });

      expect(page.total).toBe(2);
      expect(page.rows.map((row) => row.name)).toEqual(["Manhã", "Tarde"]);
      expect(page.rows[0]).toMatchObject({
        startsAt: "06:00",
        endsAt: "14:00",
        crossesMidnight: false,
        active: true,
      });
    });

    it("setor sem turnos devolve página vazia com pageCount 1", async () => {
      const uld = await insertSector(db, "ULD");
      const page = await listShifts(db, { sectorId: uld.id, page: 1 });
      expect(page).toMatchObject({ rows: [], total: 0, page: 1, pageCount: 1 });
    });

    it("marca o turno que atravessa a meia-noite", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, {
        sectorId: uld.id,
        name: "Noite",
        startsAt: "22:00",
        endsAt: "06:00",
      });
      const page = await listShifts(db, { sectorId: uld.id, page: 1 });
      expect(page.rows[0]?.crossesMidnight).toBe(true);
    });

    it("sobreposição só entre ativos: aviso nos dois lados, inativo sem aviso", async () => {
      const uld = await insertSector(db, "ULD");
      const noite = await insertShift(db, {
        sectorId: uld.id,
        name: "Noite",
        startsAt: "22:00",
        endsAt: "06:00",
      });
      const madrugada = await insertShift(db, {
        sectorId: uld.id,
        name: "Madrugada",
        startsAt: "05:00",
        endsAt: "07:00",
      });
      await insertShift(db, {
        sectorId: uld.id,
        name: "Dia",
        startsAt: "06:00",
        endsAt: "14:00",
        active: false,
      });

      const page = await listShifts(db, { sectorId: uld.id, page: 1 });
      const byName = new Map(page.rows.map((row) => [row.name, row]));

      expect(byName.get("Noite")?.overlaps).toEqual([
        {
          shiftId: madrugada.id,
          name: "Madrugada",
          startsAt: "05:00",
          endsAt: "07:00",
        },
      ]);
      expect(byName.get("Madrugada")?.overlaps).toEqual([
        {
          shiftId: noite.id,
          name: "Noite",
          startsAt: "22:00",
          endsAt: "06:00",
        },
      ]);
      expect(byName.get("Dia")?.overlaps).toEqual([]);
    });

    it("turnos que só se encostam não geram aviso", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, {
        sectorId: uld.id,
        startsAt: "06:00",
        endsAt: "14:00",
      });
      await insertShift(db, {
        sectorId: uld.id,
        startsAt: "14:00",
        endsAt: "22:00",
      });
      const page = await listShifts(db, { sectorId: uld.id, page: 1 });
      expect(page.rows.every((row) => row.overlaps.length === 0)).toBe(true);
    });

    it("canMoveUp/canMoveDown valem para a lista inteira, não para a página", async () => {
      const uld = await insertSector(db, "ULD");
      for (let n = 1; n <= PAGE_SIZE + 2; n += 1) {
        await insertShift(db, {
          sectorId: uld.id,
          name: `T${String(n).padStart(3, "0")}`,
          startsAt: "06:00",
          endsAt: "07:00",
        });
      }

      const first = await listShifts(db, { sectorId: uld.id, page: 1 });
      const second = await listShifts(db, { sectorId: uld.id, page: 2 });

      expect(first.rows).toHaveLength(PAGE_SIZE);
      expect(second.rows).toHaveLength(2);
      expect(first.pageCount).toBe(2);
      expect(first.rows[0]).toMatchObject({
        canMoveUp: false,
        canMoveDown: true,
      });
      expect(first.rows.at(-1)).toMatchObject({
        canMoveUp: true,
        canMoveDown: true,
      });
      expect(second.rows[0]).toMatchObject({
        canMoveUp: true,
        canMoveDown: true,
      });
      expect(second.rows.at(-1)).toMatchObject({
        canMoveUp: true,
        canMoveDown: false,
      });
    });

    it("turno único não sobe nem desce", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, { sectorId: uld.id });
      const page = await listShifts(db, { sectorId: uld.id, page: 1 });
      expect(page.rows[0]).toMatchObject({
        canMoveUp: false,
        canMoveDown: false,
      });
    });

    it("página além do fim é clampada para a última", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, { sectorId: uld.id });
      const page = await listShifts(db, { sectorId: uld.id, page: 99 });
      expect(page.page).toBe(1);
      expect(page.rows).toHaveLength(1);
    });
  });

  describe("getShiftFormDefaults", () => {
    it("setor sem turnos: Turno 1, 06:00–14:00", async () => {
      const uld = await insertSector(db, "ULD");
      expect(await getShiftFormDefaults(db, uld.id)).toEqual({
        name: "Turno 1",
        startsAt: "06:00",
        endsAt: "14:00",
      });
    });

    it("começa no fim do último turno ativo e dura 8 horas", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, {
        sectorId: uld.id,
        startsAt: "06:00",
        endsAt: "14:00",
      });
      await insertShift(db, {
        sectorId: uld.id,
        startsAt: "14:00",
        endsAt: "22:00",
      });
      expect(await getShiftFormDefaults(db, uld.id)).toEqual({
        name: "Turno 3",
        startsAt: "22:00",
        endsAt: "06:00",
      });
    });

    it("ignora turno inativo no horário, mas não no nome", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, {
        sectorId: uld.id,
        startsAt: "06:00",
        endsAt: "14:00",
      });
      await insertShift(db, {
        sectorId: uld.id,
        name: "Turno 2",
        startsAt: "14:00",
        endsAt: "22:00",
        active: false,
      });
      expect(await getShiftFormDefaults(db, uld.id)).toEqual({
        name: "Turno 3",
        startsAt: "14:00",
        endsAt: "22:00",
      });
    });

    it("pula um nome sugerido que já existe", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, { sectorId: uld.id, name: "Manhã" });
      await insertShift(db, { sectorId: uld.id, name: "TURNO 2" });
      expect((await getShiftFormDefaults(db, uld.id)).name).toBe("Turno 3");
    });
  });

  describe("createShift", () => {
    it("cria no fim da ordem e devolve id e warnings vazios", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, { sectorId: uld.id, name: "Manhã" });

      const result = await createShift(db, {
        sectorId: uld.id,
        name: "Tarde",
        startsAt: "14:00",
        endsAt: "22:00",
      });

      expect(result).toMatchObject({ ok: true, warnings: [] });
      expect(await orderOf(uld.id)).toEqual(["Manhã", "Tarde"]);
    });

    it("o primeiro turno do setor recebe sortOrder 1; a ordem é por setor", async () => {
      const uld = await insertSector(db, "ULD");
      const other = await insertSector(db, "Outro");
      await insertShift(db, { sectorId: other.id, sortOrder: 7 });
      await createShift(db, {
        sectorId: uld.id,
        name: "A",
        startsAt: "06:00",
        endsAt: "07:00",
      });
      const page = await listShifts(db, { sectorId: uld.id, page: 1 });
      expect(page.rows[0]?.sortOrder).toBe(1);
    });

    it("grava turno que atravessa a meia-noite", async () => {
      const uld = await insertSector(db, "ULD");
      await createShift(db, {
        sectorId: uld.id,
        name: "Noite",
        startsAt: "22:00",
        endsAt: "06:00",
      });
      const page = await listShifts(db, { sectorId: uld.id, page: 1 });
      expect(page.rows[0]).toMatchObject({
        startsAt: "22:00",
        endsAt: "06:00",
        crossesMidnight: true,
      });
    });

    it("avisa a sobreposição com turno ativo, sem bloquear", async () => {
      const uld = await insertSector(db, "ULD");
      const manha = await insertShift(db, {
        sectorId: uld.id,
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      await insertShift(db, {
        sectorId: uld.id,
        name: "Antigo",
        startsAt: "10:00",
        endsAt: "12:00",
        active: false,
      });

      const result = await createShift(db, {
        sectorId: uld.id,
        name: "Extra",
        startsAt: "13:00",
        endsAt: "15:00",
      });

      expect(result).toMatchObject({ ok: true });
      if (!result.ok) return;
      expect(result.warnings).toEqual([
        {
          shiftId: manha.id,
          name: "Manhã",
          startsAt: "06:00",
          endsAt: "14:00",
        },
      ]);
    });

    it("avisa sobreposição que só existe por causa da meia-noite", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, {
        sectorId: uld.id,
        name: "Noite",
        startsAt: "23:00",
        endsAt: "01:00",
      });
      const result = await createShift(db, {
        sectorId: uld.id,
        name: "Virada",
        startsAt: "00:00",
        endsAt: "02:00",
      });
      expect(result.ok && result.warnings.map((w) => w.name)).toEqual([
        "Noite",
      ]);
    });

    it("normaliza o nome (espaços e Unicode)", async () => {
      const uld = await insertSector(db, "ULD");
      await createShift(db, {
        sectorId: uld.id,
        name: "  Turno   Manhã ",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      expect(await orderOf(uld.id)).toEqual(["Turno Manhã"]);
    });

    it("início igual ao fim vira INVALID_INPUT no campo endsAt", async () => {
      const uld = await insertSector(db, "ULD");
      const result = await createShift(db, {
        sectorId: uld.id,
        name: "X",
        startsAt: "06:00",
        endsAt: "06:00",
      });
      expect(result).toEqual({
        ok: false,
        code: "INVALID_INPUT",
        message: "O início e o fim não podem ser iguais.",
        fieldErrors: { endsAt: "O início e o fim não podem ser iguais." },
      });
    });

    it.each([
      ["24:00"],
      ["6:00"],
      ["06:00:30"],
      [""],
    ])("horário inválido %j vira INVALID_INPUT", async (bad) => {
      const uld = await insertSector(db, "ULD");
      const result = await createShift(db, {
        sectorId: uld.id,
        name: "X",
        startsAt: bad,
        endsAt: "14:00",
      });
      expect(result).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { startsAt: "Informe um horário válido, como 06:00." },
      });
    });

    it("nome vazio e nome longo viram INVALID_INPUT no campo name", async () => {
      const uld = await insertSector(db, "ULD");
      const empty = await createShift(db, {
        sectorId: uld.id,
        name: "   ",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      const long = await createShift(db, {
        sectorId: uld.id,
        name: "x".repeat(61),
        startsAt: "06:00",
        endsAt: "14:00",
      });
      expect(empty).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { name: "Informe o nome." },
      });
      expect(long).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { name: "O nome pode ter no máximo 60 caracteres." },
      });
    });

    it("setor inexistente é NOT_FOUND", async () => {
      const result = await createShift(db, {
        sectorId: NIL_ID,
        name: "X",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      expect(result).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
        message: "Setor não encontrado. Atualize a página.",
      });
    });

    it("setor inativo é SECTOR_INACTIVE e nada é gravado", async () => {
      const off = await insertSector(db, "Parado", { active: false });
      const result = await createShift(db, {
        sectorId: off.id,
        name: "X",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      expect(result).toMatchObject({
        ok: false,
        code: "SECTOR_INACTIVE",
        message: "Este setor está inativo. Reative-o para cadastrar turnos.",
      });
      expect((await listShifts(db, { sectorId: off.id, page: 1 })).total).toBe(
        0,
      );
    });

    it("nome repetido no setor (outra caixa) é NAME_TAKEN", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, { sectorId: uld.id, name: "Água" });
      const result = await createShift(db, {
        sectorId: uld.id,
        name: "ÁGUA",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      expect(result).toEqual({
        ok: false,
        code: "NAME_TAKEN",
        message: "Já existe um turno com este nome neste setor.",
        fieldErrors: { name: "Já existe um turno com este nome neste setor." },
      });
    });

    it("avisa quando o nome repetido é de um turno inativo", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, { sectorId: uld.id, name: "Manhã", active: false });
      const result = await createShift(db, {
        sectorId: uld.id,
        name: "manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      expect(result).toMatchObject({
        ok: false,
        code: "NAME_TAKEN",
        message:
          "Já existe um turno com este nome neste setor. Ele está inativo: reative-o na lista.",
      });
    });

    it("o mesmo nome em outro setor passa", async () => {
      const uld = await insertSector(db, "ULD");
      const other = await insertSector(db, "Outro");
      await insertShift(db, { sectorId: other.id, name: "Manhã" });
      const result = await createShift(db, {
        sectorId: uld.id,
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      expect(result.ok).toBe(true);
    });
  });

  describe("updateShift", () => {
    it("altera nome e horários e não avisa de si mesmo", async () => {
      const uld = await insertSector(db, "ULD");
      const manha = await insertShift(db, {
        sectorId: uld.id,
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      });

      const result = await updateShift(db, {
        id: manha.id,
        name: "Manhã longa",
        startsAt: "06:00",
        endsAt: "15:00",
      });

      expect(result).toEqual({ ok: true, warnings: [] });
      const page = await listShifts(db, { sectorId: uld.id, page: 1 });
      expect(page.rows[0]).toMatchObject({
        name: "Manhã longa",
        endsAt: "15:00",
      });
    });

    it("avisa sobreposição criada pela edição", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, {
        sectorId: uld.id,
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      const tarde = await insertShift(db, {
        sectorId: uld.id,
        name: "Tarde",
        startsAt: "14:00",
        endsAt: "22:00",
      });

      const result = await updateShift(db, {
        id: tarde.id,
        name: "Tarde",
        startsAt: "13:00",
        endsAt: "22:00",
      });

      expect(result.ok && result.warnings.map((w) => w.name)).toEqual([
        "Manhã",
      ]);
    });

    it("editar um turno inativo não avisa", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, {
        sectorId: uld.id,
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      const antigo = await insertShift(db, {
        sectorId: uld.id,
        name: "Antigo",
        startsAt: "07:00",
        endsAt: "09:00",
        active: false,
      });
      const result = await updateShift(db, {
        id: antigo.id,
        name: "Antigo",
        startsAt: "07:00",
        endsAt: "10:00",
      });
      expect(result).toEqual({ ok: true, warnings: [] });
    });

    it("trocar só a caixa do próprio nome é permitido", async () => {
      const uld = await insertSector(db, "ULD");
      const manha = await insertShift(db, { sectorId: uld.id, name: "manhã" });
      const result = await updateShift(db, {
        id: manha.id,
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      expect(result.ok).toBe(true);
    });

    it("nome de outro turno do setor é NAME_TAKEN", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, { sectorId: uld.id, name: "Manhã" });
      const tarde = await insertShift(db, { sectorId: uld.id, name: "Tarde" });
      const result = await updateShift(db, {
        id: tarde.id,
        name: "MANHÃ",
        startsAt: "14:00",
        endsAt: "22:00",
      });
      expect(result).toMatchObject({ ok: false, code: "NAME_TAKEN" });
    });

    it("id inexistente é NOT_FOUND", async () => {
      const result = await updateShift(db, {
        id: NIL_ID,
        name: "X",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      expect(result).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
        message: "Turno não encontrado. Atualize a página.",
      });
    });

    it("início igual ao fim é recusado e o turno não muda", async () => {
      const uld = await insertSector(db, "ULD");
      const manha = await insertShift(db, {
        sectorId: uld.id,
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      const result = await updateShift(db, {
        id: manha.id,
        name: "Manhã",
        startsAt: "08:00",
        endsAt: "08:00",
      });
      expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
      const page = await listShifts(db, { sectorId: uld.id, page: 1 });
      expect(page.rows[0]).toMatchObject({
        startsAt: "06:00",
        endsAt: "14:00",
      });
    });
  });

  describe("setShiftActive", () => {
    it("desativar e reativar; reativar avisa a sobreposição", async () => {
      const uld = await insertSector(db, "ULD");
      const manha = await insertShift(db, {
        sectorId: uld.id,
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      await insertShift(db, {
        sectorId: uld.id,
        name: "Extra",
        startsAt: "10:00",
        endsAt: "12:00",
      });

      expect(await setShiftActive(db, { id: manha.id, active: false })).toEqual(
        { ok: true, warnings: [] },
      );
      const reactivated = await setShiftActive(db, {
        id: manha.id,
        active: true,
      });

      expect(reactivated.ok && reactivated.warnings.map((w) => w.name)).toEqual(
        ["Extra"],
      );
    });

    it("é idempotente: desativar de novo é sucesso sem mudança", async () => {
      const uld = await insertSector(db, "ULD");
      const manha = await insertShift(db, { sectorId: uld.id, active: false });
      expect(await setShiftActive(db, { id: manha.id, active: false })).toEqual(
        { ok: true, warnings: [] },
      );
    });

    it("id inexistente é NOT_FOUND", async () => {
      expect(
        await setShiftActive(db, { id: NIL_ID, active: true }),
      ).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
      });
    });
  });

  describe("moveShift", () => {
    async function seed(names: string[]) {
      const uld = await insertSector(db, "ULD");
      const ids: string[] = [];
      for (const name of names) {
        ids.push((await insertShift(db, { sectorId: uld.id, name })).id);
      }
      return { sectorId: uld.id, ids };
    }

    it("sobe e desce trocando com o vizinho", async () => {
      const { sectorId, ids } = await seed(["A", "B", "C"]);
      await moveShift(db, { id: must(ids[2]), direction: "up" });
      expect(await orderOf(sectorId)).toEqual(["A", "C", "B"]);
      await moveShift(db, { id: must(ids[0]), direction: "down" });
      expect(await orderOf(sectorId)).toEqual(["C", "A", "B"]);
    });

    it("no topo ou no fim é sucesso sem mudança", async () => {
      const { sectorId, ids } = await seed(["A", "B"]);
      expect(
        await moveShift(db, { id: must(ids[0]), direction: "up" }),
      ).toEqual({ ok: true });
      expect(
        await moveShift(db, { id: must(ids[1]), direction: "down" }),
      ).toEqual({ ok: true });
      expect(await orderOf(sectorId)).toEqual(["A", "B"]);
    });

    it("com sortOrder duplicado renumera 1..n e move", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, {
        sectorId: uld.id,
        name: "A",
        sortOrder: 1,
      });
      const b = await insertShift(db, {
        sectorId: uld.id,
        name: "B",
        sortOrder: 1,
      });
      await insertShift(db, { sectorId: uld.id, name: "C", sortOrder: 2 });

      await moveShift(db, { id: b.id, direction: "up" });

      const page = await listShifts(db, { sectorId: uld.id, page: 1 });
      expect(page.rows.map((row) => [row.name, row.sortOrder])).toEqual([
        ["B", 1],
        ["A", 2],
        ["C", 3],
      ]);
    });

    it("não mexe na ordem de outro setor", async () => {
      const { ids } = await seed(["A", "B"]);
      const other = await insertSector(db, "Outro");
      await insertShift(db, { sectorId: other.id, name: "X", sortOrder: 5 });
      await insertShift(db, { sectorId: other.id, name: "Y", sortOrder: 9 });
      await moveShift(db, { id: must(ids[1]), direction: "up" });
      const page = await listShifts(db, { sectorId: other.id, page: 1 });
      expect(page.rows.map((row) => [row.name, row.sortOrder])).toEqual([
        ["X", 5],
        ["Y", 9],
      ]);
    });

    it("id inexistente é NOT_FOUND", async () => {
      expect(
        await moveShift(db, { id: NIL_ID, direction: "up" }),
      ).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
        message: "Turno não encontrado. Atualize a página.",
      });
    });
  });
});
