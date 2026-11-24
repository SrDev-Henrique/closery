import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { authzOf } from "../../../test/authz";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import {
  findHandoverById,
  findHandoverByRef,
  loadSector,
  lockHandover,
  userNames,
} from "./loaders";

const NIL_ID = "00000000-0000-4000-8000-000000000000";

describe("loaders da passagem", () => {
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

  describe("loadSector", () => {
    it("admin lê qualquer setor, ativo ou não", async () => {
      const active = await insertSector(db, "ULD");
      const inactive = await insertSector(db, "Antigo", { active: false });
      const admin = authzOf({ role: "admin" });

      expect(await loadSector(db, admin, active.id)).toEqual({
        id: active.id,
        name: "ULD",
        active: true,
      });
      expect(await loadSector(db, admin, inactive.id)).toMatchObject({
        active: false,
      });
    });

    it("operador lê só o próprio setor; outro setor e setor inexistente dão a mesma resposta (null)", async () => {
      const own = await insertSector(db, "ULD");
      const other = await insertSector(db, "Outro");
      const operator = authzOf({ role: "operator", sectorId: own.id });

      expect(await loadSector(db, operator, own.id)).toMatchObject({
        id: own.id,
      });
      expect(await loadSector(db, operator, other.id)).toBeNull();
      expect(await loadSector(db, operator, NIL_ID)).toBeNull();
    });
  });

  describe("findHandoverByRef / findHandoverById / lockHandover", () => {
    it("acham pela tripla e pelo id; ausência vira null", async () => {
      const sector = await insertSector(db);
      const turno = await insertShift(db, { sectorId: sector.id });
      const created = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
      });
      const ref = {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: "2026-11-20",
      };
      const admin = authzOf({ role: "admin" });

      expect(await findHandoverByRef(db, ref)).toMatchObject({
        id: created.id,
        operationalDate: "2026-11-20",
      });
      expect(
        await findHandoverByRef(db, { ...ref, operationalDate: "2026-11-19" }),
      ).toBeNull();
      expect(await findHandoverById(db, admin, created.id)).toMatchObject({
        id: created.id,
      });
      expect(await findHandoverById(db, admin, NIL_ID)).toBeNull();
      expect(await lockHandover(db, created.id)).toMatchObject({
        id: created.id,
      });
      expect(await lockHandover(db, NIL_ID)).toBeNull();
    });

    it("findHandoverById: operador de outro setor recebe null", async () => {
      const sector = await insertSector(db);
      const other = await insertSector(db);
      const turno = await insertShift(db, { sectorId: sector.id });
      const created = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
      });

      expect(
        await findHandoverById(
          db,
          authzOf({ role: "operator", sectorId: other.id }),
          created.id,
        ),
      ).toBeNull();
      expect(
        await findHandoverById(
          db,
          authzOf({ role: "operator", sectorId: sector.id }),
          created.id,
        ),
      ).toMatchObject({ id: created.id });
    });
  });

  describe("userNames", () => {
    it("mapeia id → nome, sem repetir consulta de id repetido", async () => {
      const ana = await insertUser(db, {
        role: "admin",
        sectorId: null,
        name: "Ana Teste",
      });
      const bia = await insertUser(db, {
        role: "admin",
        sectorId: null,
        name: "Bia Teste",
      });

      const names = await userNames(db, [ana.id, bia.id, ana.id]);
      expect(names.get(ana.id)).toBe("Ana Teste");
      expect(names.get(bia.id)).toBe("Bia Teste");
      expect(names.size).toBe(2);
    });

    it("lista vazia devolve mapa vazio sem consultar; id desconhecido fica de fora", async () => {
      expect((await userNames(db, [])).size).toBe(0);
      expect((await userNames(db, ["nao-existe"])).size).toBe(0);
    });
  });
});
