import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { sector } from "@/db/schema/sectors";
import { createTestDb, resetDb, type TestDb } from "./db";
import { deactivateSector, insertSector } from "./fixtures";

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

async function activeOf(sectorId: string): Promise<boolean | undefined> {
  const [row] = await db
    .select({ active: sector.active })
    .from(sector)
    .where(eq(sector.id, sectorId));
  return row?.active;
}

describe("deactivateSector", () => {
  it("desativa o setor e deixa os outros como estavam", async () => {
    const uld = await insertSector(db, "ULD Teste");
    const camara = await insertSector(db, "Câmara Teste");

    await deactivateSector(db, uld.id);

    expect(await activeOf(uld.id)).toBe(false);
    expect(await activeOf(camara.id)).toBe(true);
  });

  it("setor já inativo continua inativo (idempotente)", async () => {
    const parado = await insertSector(db, "Setor Parado", { active: false });

    await deactivateSector(db, parado.id);

    expect(await activeOf(parado.id)).toBe(false);
  });

  it("id inexistente lança, para o teste nunca passar em silêncio", async () => {
    await expect(deactivateSector(db, NIL_ID)).rejects.toThrow(
      "fixture: setor inexistente",
    );
  });
});
