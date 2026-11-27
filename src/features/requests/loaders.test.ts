import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertRequest,
  insertRequestEvent,
  insertSector,
  insertUser,
} from "../../../test/fixtures";
import {
  findRequestById,
  lastChange,
  lockRequest,
  lockSectorShare,
} from "./loaders";

const NIL_ID = "00000000-0000-4000-8000-000000000000";
const AT = spDate("2026-11-21", "14:05");

describe("carregadores das solicitações", () => {
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

  async function setup() {
    const uld = await insertSector(db, "ULD");
    const outro = await insertSector(db, "Rede de proteção");
    const ana = await insertUser(db, {
      role: "operator",
      sectorId: uld.id,
      name: "Ana Teste",
    });
    const bia = await insertUser(db, {
      role: "operator",
      sectorId: outro.id,
      name: "Bia Teste",
    });
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    return {
      uld,
      outro,
      ana,
      bia,
      anaAuthz: authzOf({
        role: "operator",
        userId: ana.id,
        sectorId: uld.id,
        name: "Ana Teste",
      }),
      biaAuthz: authzOf({
        role: "operator",
        userId: bia.id,
        sectorId: outro.id,
      }),
      adminAuthz: authzOf({ role: "admin", userId: admin.id }),
    };
  }

  describe("findRequestById", () => {
    it("devolve a linha para quem é do setor e para o admin", async () => {
      const { uld, ana, anaAuthz, adminAuthz } = await setup();
      const created = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
      });

      expect(await findRequestById(db, anaAuthz, created.id)).toMatchObject({
        id: created.id,
        sectorId: uld.id,
        status: "requested",
      });
      expect(await findRequestById(db, adminAuthz, created.id)).toMatchObject({
        id: created.id,
      });
    });

    it("operador de outro setor e id inexistente recebem null (a mesma resposta)", async () => {
      const { uld, ana, biaAuthz, anaAuthz } = await setup();
      const created = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
      });

      expect(await findRequestById(db, biaAuthz, created.id)).toBeNull();
      expect(await findRequestById(db, anaAuthz, NIL_ID)).toBeNull();
    });
  });

  describe("lockRequest", () => {
    it("lê a linha dentro da transação e devolve null para id inexistente", async () => {
      const { uld, ana } = await setup();
      const created = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
      });

      const [found, missing] = await db.transaction(async (tx) => [
        await lockRequest(tx, created.id),
        await lockRequest(tx, NIL_ID),
      ]);

      expect(found).toMatchObject({ id: created.id });
      expect(missing).toBeNull();
    });
  });

  describe("lastChange", () => {
    it("sem eventos devolve null", async () => {
      const { uld, ana } = await setup();
      const created = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
        events: false,
      });

      expect(await lastChange(db, created.id)).toBeNull();
    });

    it("devolve o último evento com o nome de quem mudou", async () => {
      const { uld, ana, bia } = await setup();
      const created = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
        status: "in_transit",
        statusChangedAt: AT,
        statusChangedBy: bia.id,
      });

      expect(await lastChange(db, created.id)).toEqual({
        status: "in_transit",
        byName: "Bia Teste",
        at: AT,
      });
    });

    it("eventos no mesmo instante: vale a ordem de inserção (seq), nunca o id", async () => {
      const { uld, ana, bia } = await setup();
      // Dez solicitações: um desempate por uuid aleatório erraria em alguma.
      for (let round = 0; round < 10; round += 1) {
        const created = await insertRequest(db, {
          sectorId: uld.id,
          createdBy: ana.id,
          events: false,
        });
        await insertRequestEvent(db, {
          requestId: created.id,
          fromStatus: null,
          toStatus: "requested",
          changedBy: ana.id,
          changedAt: AT,
        });
        await insertRequestEvent(db, {
          requestId: created.id,
          fromStatus: "requested",
          toStatus: "in_transit",
          changedBy: bia.id,
          changedAt: AT,
        });

        expect(await lastChange(db, created.id)).toMatchObject({
          status: "in_transit",
          byName: "Bia Teste",
        });
      }
    });
  });

  describe("lockSectorShare", () => {
    it("devolve o setor com o active atual (admin vê o inativo)", async () => {
      const { adminAuthz } = await setup();
      const parado = await insertSector(db, "Setor parado", { active: false });

      const sector = await db.transaction((tx) =>
        lockSectorShare(tx, adminAuthz, parado.id),
      );

      expect(sector).toEqual({
        id: parado.id,
        name: "Setor parado",
        active: false,
        // O loadSector devolve a cor desde o visual novo (cor padrão do fixture).
        color: "lilac",
      });
    });

    it("operador de outro setor e setor inexistente recebem null", async () => {
      const { uld, biaAuthz, anaAuthz } = await setup();

      const [stranger, missing, own] = await db.transaction(async (tx) => [
        await lockSectorShare(tx, biaAuthz, uld.id),
        await lockSectorShare(tx, anaAuthz, NIL_ID),
        await lockSectorShare(tx, anaAuthz, uld.id),
      ]);

      expect(stranger).toBeNull();
      expect(missing).toBeNull();
      expect(own).toMatchObject({ id: uld.id, active: true });
    });
  });
});
