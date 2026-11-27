import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

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
        color: "lilac",
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

  describe("loadSector com lock: share", () => {
    it("dentro da transação devolve o mesmo que sem lock", async () => {
      const own = await insertSector(db, "ULD");
      const admin = authzOf({ role: "admin" });
      const operator = authzOf({ role: "operator", sectorId: own.id });

      const plain = await loadSector(db, admin, own.id);
      const locked = await db.transaction((tx) =>
        loadSector(tx, admin, own.id, { lock: "share" }),
      );
      const lockedOperator = await db.transaction((tx) =>
        loadSector(tx, operator, own.id, { lock: "share" }),
      );

      expect(locked).toEqual(plain);
      expect(lockedOperator).toEqual(plain);
    });

    it("setor inativo continua legível, com active falso", async () => {
      const parado = await insertSector(db, "Parado", { active: false });
      const admin = authzOf({ role: "admin" });

      const locked = await db.transaction((tx) =>
        loadSector(tx, admin, parado.id, { lock: "share" }),
      );

      expect(locked).toMatchObject({ id: parado.id, active: false });
    });

    it("fora do escopo do operador e setor inexistente: null, como sem lock", async () => {
      const own = await insertSector(db, "ULD");
      const other = await insertSector(db, "Outro");
      const operator = authzOf({ role: "operator", sectorId: own.id });

      const [outside, missing] = await db.transaction(async (tx) => [
        await loadSector(tx, operator, other.id, { lock: "share" }),
        await loadSector(tx, operator, NIL_ID, { lock: "share" }),
      ]);

      expect(outside).toBeNull();
      expect(missing).toBeNull();
    });

    it("o lock é um FOR SHARE no SQL; sem lock, nenhum", async () => {
      const own = await insertSector(db, "ULD");
      const admin = authzOf({ role: "admin" });
      const queries: string[] = [];
      const logged = drizzle(client, {
        schema,
        logger: { logQuery: (query) => queries.push(query) },
      });

      await logged.transaction((tx) =>
        loadSector(tx, admin, own.id, { lock: "share" }),
      );
      await loadSector(logged, admin, own.id);

      const selects = queries.filter((query) =>
        query.startsWith(
          'select "id", "name", "active", "color" from "sector"',
        ),
      );
      expect(selects).toHaveLength(2);
      expect(selects[0]).toMatch(/ for share$/);
      expect(selects[1]).not.toMatch(/for share/);
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
