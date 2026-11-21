import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { sector } from "@/db/schema";

import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertSector } from "../../../test/fixtures";
import type { Authz } from "./authz";
import { scopeToSector } from "./sectorScope";

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

function authzOf(role: Authz["role"], sectorId: string | null): Authz {
  return {
    userId: "u1",
    name: "Pessoa",
    email: "p@example.com",
    role,
    sectorId,
  };
}

async function visibleSectorNames(authz: Authz): Promise<string[]> {
  const rows = await db
    .select({ name: sector.name })
    .from(sector)
    .where(scopeToSector(authz, sector.id))
    .orderBy(sector.name);
  return rows.map((row) => row.name);
}

describe("scopeToSector (PGlite, query real em sector)", () => {
  it("operador só vê o próprio setor", async () => {
    const own = await insertSector(db, "Alfa");
    await insertSector(db, "Beta");
    await insertSector(db, "Gama");

    expect(await visibleSectorNames(authzOf("operator", own.id))).toEqual([
      "Alfa",
    ]);
  });

  it("admin vê todos os setores", async () => {
    await insertSector(db, "Alfa");
    await insertSector(db, "Beta");

    expect(await visibleSectorNames(authzOf("admin", null))).toEqual([
      "Alfa",
      "Beta",
    ]);
  });

  it("admin não gera condição (undefined), operador gera", () => {
    expect(scopeToSector(authzOf("admin", null), sector.id)).toBeUndefined();
    expect(
      scopeToSector(
        authzOf("operator", "11111111-1111-4111-8111-111111111111"),
        sector.id,
      ),
    ).toBeDefined();
  });

  it("operador de um setor que não existe não vê nada", async () => {
    await insertSector(db, "Alfa");

    expect(
      await visibleSectorNames(
        authzOf("operator", "99999999-9999-4999-8999-999999999999"),
      ),
    ).toEqual([]);
  });

  it("operador sem setor (estado inválido) não vê nada, em vez de ver tudo", async () => {
    await insertSector(db, "Alfa");

    expect(await visibleSectorNames(authzOf("operator", null))).toEqual([]);
  });

  it("sem nenhum setor cadastrado, ninguém vê nada", async () => {
    expect(await visibleSectorNames(authzOf("admin", null))).toEqual([]);
  });
});
