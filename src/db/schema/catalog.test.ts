import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ITEM_KINDS } from "@/lib/itemKinds";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertDestination,
  insertItem,
  insertSector,
  insertSession,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { sqlErrorOf } from "../../../test/sqlError";
import { session, user } from "./auth";
import { destination, item, shift } from "./catalog";
import { invite } from "./invites";
import { sector } from "./sectors";

describe("tabelas do cadastro", () => {
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

  describe("shift", () => {
    it("grava e devolve o horário como texto HH:mm:ss", async () => {
      const setor = await insertSector(db, "ULD");
      const [row] = await db
        .insert(shift)
        .values({
          sectorId: setor.id,
          name: "Turno Noite",
          startsAt: "22:00",
          endsAt: "06:00",
          sortOrder: 1,
        })
        .returning();
      expect(row?.startsAt).toBe("22:00:00");
      expect(row?.endsAt).toBe("06:00:00");
      expect(row?.active).toBe(true);
    });

    it("aceita atravessar a meia-noite (fim menor que o início)", async () => {
      const setor = await insertSector(db);
      const created = await insertShift(db, {
        sectorId: setor.id,
        startsAt: "23:30",
        endsAt: "00:30",
      });
      expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("recusa início igual ao fim com 23514 (shift_starts_ne_ends)", async () => {
      const setor = await insertSector(db);
      const failure = await sqlErrorOf(
        insertShift(db, {
          sectorId: setor.id,
          startsAt: "06:00",
          endsAt: "06:00",
        }),
      );
      expect(failure).toEqual({
        code: "23514",
        constraint: "shift_starts_ne_ends",
      });
    });

    it("recusa nome repetido no mesmo setor, sem diferença de caixa (23505)", async () => {
      const setor = await insertSector(db);
      await insertShift(db, { sectorId: setor.id, name: "Manhã" });
      const failure = await sqlErrorOf(
        insertShift(db, { sectorId: setor.id, name: "MANHÃ" }),
      );
      expect(failure).toEqual({
        code: "23505",
        constraint: "shift_sector_name_lower_uq",
      });
    });

    it("aceita o mesmo nome em setores diferentes", async () => {
      const a = await insertSector(db, "Setor A");
      const b = await insertSector(db, "Setor B");
      await insertShift(db, { sectorId: a.id, name: "Manhã" });
      const outro = await insertShift(db, { sectorId: b.id, name: "Manhã" });
      expect(outro.name).toBe("Manhã");
    });

    it("recusa setor inexistente com 23503 (FK)", async () => {
      const failure = await sqlErrorOf(
        insertShift(db, { sectorId: "00000000-0000-4000-8000-000000000000" }),
      );
      expect(failure.code).toBe("23503");
    });

    it("recusa apagar o setor que tem turno com 23001 (restrict)", async () => {
      const setor = await insertSector(db);
      await insertShift(db, { sectorId: setor.id });
      const failure = await sqlErrorOf(
        client.query("DELETE FROM sector WHERE id = $1", [setor.id]),
      );
      expect(failure.code).toBe("23001");
    });

    it("a fixture numera a ordem como o maior do setor + 1", async () => {
      const setor = await insertSector(db);
      const outro = await insertSector(db);
      await insertShift(db, { sectorId: setor.id });
      await insertShift(db, { sectorId: setor.id });
      await insertShift(db, { sectorId: outro.id });
      const rows = await db.select().from(shift);
      const orders = (id: string) =>
        rows
          .filter((row) => row.sectorId === id)
          .map((row) => row.sortOrder)
          .sort();
      expect(orders(setor.id)).toEqual([1, 2]);
      expect(orders(outro.id)).toEqual([1]);
    });
  });

  describe("item", () => {
    it("grava com os padrões da fixture", async () => {
      const setor = await insertSector(db);
      const created = await insertItem(db, { sectorId: setor.id });
      const [row] = await db.select().from(item);
      expect(row?.id).toBe(created.id);
      expect(row?.unit).toBe("unidade");
      expect(row?.kind).toBe("control");
      expect(row?.sortOrder).toBe(1);
      expect(row?.active).toBe(true);
    });

    it("aceita todos os tipos de ITEM_KINDS (a CHECK acompanha a lista)", async () => {
      const setor = await insertSector(db);
      for (const kind of ITEM_KINDS) {
        await insertItem(db, { sectorId: setor.id, kind });
      }
      const rows = await db.select({ kind: item.kind }).from(item);
      expect(rows.map((row) => row.kind).sort()).toEqual(
        [...ITEM_KINDS].sort(),
      );
    });

    it("recusa tipo fora de control/stock com 23514 (item_kind_valid)", async () => {
      const setor = await insertSector(db);
      const failure = await sqlErrorOf(
        client.query(
          "INSERT INTO item (sector_id, name, unit, kind, sort_order) VALUES ($1, 'Rede', 'unidade', 'outro', 1)",
          [setor.id],
        ),
      );
      expect(failure).toEqual({ code: "23514", constraint: "item_kind_valid" });
    });

    it("recusa nome repetido no mesmo setor, com acento e caixa diferentes (23505)", async () => {
      const setor = await insertSector(db);
      await insertItem(db, { sectorId: setor.id, name: "Água" });
      const failure = await sqlErrorOf(
        insertItem(db, { sectorId: setor.id, name: "ÁGUA" }),
      );
      expect(failure).toEqual({
        code: "23505",
        constraint: "item_sector_name_lower_uq",
      });
    });

    it("aceita o mesmo nome em setores diferentes", async () => {
      const a = await insertSector(db, "Setor A");
      const b = await insertSector(db, "Setor B");
      await insertItem(db, { sectorId: a.id, name: "Rede de proteção" });
      const outro = await insertItem(db, {
        sectorId: b.id,
        name: "Rede de proteção",
      });
      expect(outro.name).toBe("Rede de proteção");
    });

    it("recusa unidade nula (23502)", async () => {
      const setor = await insertSector(db);
      const failure = await sqlErrorOf(
        client.query(
          "INSERT INTO item (sector_id, name, unit, kind, sort_order) VALUES ($1, 'Rede', NULL, 'control', 1)",
          [setor.id],
        ),
      );
      expect(failure.code).toBe("23502");
    });
  });

  describe("destination", () => {
    it("grava com id, active=true e createdAt", async () => {
      const created = await insertDestination(db, { name: "Almoxarifado" });
      const [row] = await db.select().from(destination);
      expect(row?.id).toBe(created.id);
      expect(row?.active).toBe(true);
      expect(row?.createdAt).toBeInstanceOf(Date);
    });

    it("recusa nome repetido sem diferença de caixa (23505)", async () => {
      await insertDestination(db, { name: "Almoxarifado" });
      const failure = await sqlErrorOf(
        insertDestination(db, { name: "ALMOXARIFADO" }),
      );
      expect(failure).toEqual({
        code: "23505",
        constraint: "destination_name_lower_uq",
      });
    });

    it("a fixture respeita active=false", async () => {
      await insertDestination(db, { active: false });
      const [row] = await db.select().from(destination);
      expect(row?.active).toBe(false);
    });
  });

  describe("sector (índice em lower(name))", () => {
    it('recusa "Uld" depois de "ULD" (23505, sector_name_lower_uq)', async () => {
      await insertSector(db, "ULD");
      const failure = await sqlErrorOf(insertSector(db, "Uld"));
      expect(failure).toEqual({
        code: "23505",
        constraint: "sector_name_lower_uq",
      });
    });

    it('recusa "Água" depois de "ÁGUA" (acento em UTF-8)', async () => {
      await insertSector(db, "ÁGUA");
      const failure = await sqlErrorOf(insertSector(db, "Água"));
      expect(failure.code).toBe("23505");
    });

    it("aceita nomes diferentes", async () => {
      await insertSector(db, "ULD");
      const outro = await insertSector(db, "Carga geral");
      expect(outro.name).toBe("Carga geral");
    });

    it("a fixture cria setor inativo com options.active=false", async () => {
      const setor = await insertSector(db, "Inativo", { active: false });
      const [row] = await db.select().from(sector);
      expect(row?.id).toBe(setor.id);
      expect(row?.active).toBe(false);
    });
  });

  describe("CHECK de papel (P18)", () => {
    it("user recusa papel desconhecido com 23514 (user_role_valid)", async () => {
      const setor = await insertSector(db);
      const failure = await sqlErrorOf(
        client.query(
          `INSERT INTO "user" (id, name, email, role, sector_id) VALUES ('u1', 'Pessoa', 'u1@example.test', 'gerente', $1)`,
          [setor.id],
        ),
      );
      expect(failure).toEqual({ code: "23514", constraint: "user_role_valid" });
    });

    it("user recusa mudar o papel para valor desconhecido", async () => {
      const setor = await insertSector(db);
      const pessoa = await insertUser(db, {
        role: "operator",
        sectorId: setor.id,
      });
      const failure = await sqlErrorOf(
        client.query(`UPDATE "user" SET role = 'root' WHERE id = $1`, [
          pessoa.id,
        ]),
      );
      expect(failure.code).toBe("23514");
    });

    it("user aceita admin e operator", async () => {
      const setor = await insertSector(db);
      await insertUser(db, { role: "admin", sectorId: null });
      await insertUser(db, { role: "operator", sectorId: setor.id });
      const rows = await db.select({ role: user.role }).from(user);
      expect(rows.map((row) => row.role).sort()).toEqual(["admin", "operator"]);
    });

    it("invite recusa papel desconhecido com 23514 (invite_role_valid)", async () => {
      const setor = await insertSector(db);
      const failure = await sqlErrorOf(
        client.query(
          `INSERT INTO invite (token_hash, role, sector_id, expires_at) VALUES ('h1', 'gerente', $1, now())`,
          [setor.id],
        ),
      );
      expect(failure).toEqual({
        code: "23514",
        constraint: "invite_role_valid",
      });
    });

    it("invite aceita admin sem setor", async () => {
      await client.query(
        `INSERT INTO invite (token_hash, role, expires_at) VALUES ('h2', 'admin', now())`,
      );
      const rows = await db.select().from(invite);
      expect(rows).toHaveLength(1);
    });
  });

  describe("insertSession", () => {
    it("cria sessão com updatedAt preenchido e validade de 7 dias", async () => {
      const pessoa = await insertUser(db, { role: "admin", sectorId: null });
      const antes = Date.now();
      const created = await insertSession(db, { userId: pessoa.id });
      const [row] = await db
        .select()
        .from(session)
        .where(eq(session.id, created.id));
      expect(row?.updatedAt).toBeInstanceOf(Date);
      const dias = ((row?.expiresAt.getTime() ?? 0) - antes) / 86_400_000;
      expect(dias).toBeGreaterThan(6.99);
      expect(dias).toBeLessThan(7.01);
    });

    it("respeita expiresAt informado e recusa usuário inexistente", async () => {
      const pessoa = await insertUser(db, { role: "admin", sectorId: null });
      const expiresAt = new Date("2030-01-01T00:00:00Z");
      const created = await insertSession(db, { userId: pessoa.id, expiresAt });
      const [row] = await db
        .select()
        .from(session)
        .where(eq(session.id, created.id));
      expect(row?.expiresAt.getTime()).toBe(expiresAt.getTime());

      const failure = await sqlErrorOf(
        insertSession(db, { userId: "fantasma" }),
      );
      expect(failure.code).toBe("23503");
    });
  });
});
