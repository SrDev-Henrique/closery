import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { destination } from "@/db/schema/catalog";
import { request } from "@/db/schema/requests";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertDestination,
  insertRequest,
  insertSector,
  insertUser,
} from "../../../test/fixtures";
import { destinationNameSql } from "./sql";

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

// A mesma forma das leituras: `request` com o leftJoin em `destination`.
async function nameOf(requestId: string): Promise<string | undefined> {
  const [row] = await db
    .select({ name: destinationNameSql() })
    .from(request)
    .leftJoin(destination, eq(destination.id, request.destinationId))
    .where(eq(request.id, requestId));
  return row?.name;
}

describe("destinationNameSql", () => {
  async function setup() {
    const uld = await insertSector(db);
    const ana = await insertUser(db, {
      role: "operator",
      sectorId: uld.id,
      name: "Ana Teste",
    });
    return { uld, ana };
  }

  it("destino da lista: o nome do cadastro", async () => {
    const { uld, ana } = await setup();
    const doca = await insertDestination(db, { name: "Doca 3" });
    const created = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
      destinationId: doca.id,
    });

    expect(await nameOf(created.id)).toBe("Doca 3");
  });

  it('"Outro": o texto livre da solicitação', async () => {
    const { uld, ana } = await setup();
    const created = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
      destinationOther: "Câmara Teste",
    });

    expect(await nameOf(created.id)).toBe("Câmara Teste");
  });

  it("destino inativo mantém o nome", async () => {
    const { uld, ana } = await setup();
    const antiga = await insertDestination(db, {
      name: "Doca Antiga",
      active: false,
    });
    const created = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
      destinationId: antiga.id,
    });

    expect(await nameOf(created.id)).toBe("Doca Antiga");
  });

  it("texto livre com acento e emoji passa inteiro", async () => {
    const { uld, ana } = await setup();
    const created = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
      destinationOther: "Pátio 🚚 São José",
    });

    expect(await nameOf(created.id)).toBe("Pátio 🚚 São José");
  });
});
