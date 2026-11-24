import type { PGlite } from "@electric-sql/pglite";
import { count } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { handover } from "@/db/schema/handovers";
import { ensureHandover } from "@/features/handovers/ensureHandover";

import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertSector, insertShift } from "../../../test/fixtures";
import { ok } from "./result";
import { runInTransaction } from "./transaction";

const NOW = spDate("2026-11-21", "14:05");

describe("runInTransaction", () => {
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

  async function rowCount(): Promise<number> {
    const [row] = await db.select({ total: count() }).from(handover);
    return row?.total ?? 0;
  }

  it("sucesso confirma a escrita", async () => {
    const sector = await insertSector(db);
    const turno = await insertShift(db, { sectorId: sector.id });
    const operator = authzOf({ role: "operator", sectorId: sector.id });

    const result = await runInTransaction(db, async (tx) => {
      const ensured = await ensureHandover(
        tx,
        operator,
        {
          sectorId: sector.id,
          shiftId: turno.id,
          operationalDate: "2026-11-21",
        },
        NOW,
      );
      return ensured.ok ? ok({ id: ensured.row.id }) : ensured;
    });

    expect(result.ok).toBe(true);
    expect(await rowCount()).toBe(1);
  });

  it("falha esperada desfaz o que foi escrito antes dela e devolve a falha intacta", async () => {
    const sector = await insertSector(db);
    const turno = await insertShift(db, { sectorId: sector.id });
    const operator = authzOf({ role: "operator", sectorId: sector.id });

    const result = await runInTransaction(db, async (tx) => {
      await ensureHandover(
        tx,
        operator,
        {
          sectorId: sector.id,
          shiftId: turno.id,
          operationalDate: "2026-11-21",
        },
        NOW,
      );
      return { ok: false as const, code: "FORBIDDEN" as const, message: "x" };
    });

    expect(result).toEqual({ ok: false, code: "FORBIDDEN", message: "x" });
    expect(await rowCount()).toBe(0);
  });

  it("exceção inesperada passa adiante e também desfaz", async () => {
    const sector = await insertSector(db);
    const turno = await insertShift(db, { sectorId: sector.id });
    const operator = authzOf({ role: "operator", sectorId: sector.id });

    await expect(
      runInTransaction(db, async (tx) => {
        await ensureHandover(
          tx,
          operator,
          {
            sectorId: sector.id,
            shiftId: turno.id,
            operationalDate: "2026-11-21",
          },
          NOW,
        );
        throw new Error("falha interna");
      }),
    ).rejects.toThrow("falha interna");
    expect(await rowCount()).toBe(0);
  });
});
