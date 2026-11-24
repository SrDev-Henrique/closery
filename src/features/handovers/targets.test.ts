import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertSector, insertShift } from "../../../test/fixtures";
import { listActiveShifts } from "./targets";

describe("listActiveShifts", () => {
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

  it("devolve só turnos ativos do setor, na ordem da lista, com horário HH:mm", async () => {
    const sector = await insertSector(db, "ULD");
    const other = await insertSector(db, "Outro");
    await insertShift(db, {
      sectorId: sector.id,
      name: "Tarde",
      startsAt: "14:00",
      endsAt: "22:00",
      sortOrder: 2,
    });
    await insertShift(db, {
      sectorId: sector.id,
      name: "Manhã",
      startsAt: "06:00",
      endsAt: "14:00",
      sortOrder: 1,
    });
    await insertShift(db, {
      sectorId: sector.id,
      name: "Noite",
      startsAt: "22:00",
      endsAt: "06:00",
      sortOrder: 3,
      active: false,
    });
    await insertShift(db, { sectorId: other.id, name: "De outro setor" });

    const shifts = await listActiveShifts(db, sector.id);

    expect(shifts.map((row) => row.name)).toEqual(["Manhã", "Tarde"]);
    expect(shifts[0]).toMatchObject({ startsAt: "06:00", endsAt: "14:00" });
    expect(shifts[1]).toMatchObject({ startsAt: "14:00", endsAt: "22:00" });
  });

  it("empate de sort_order desempata por created_at e depois por id", async () => {
    const sector = await insertSector(db);
    await insertShift(db, {
      sectorId: sector.id,
      name: "B",
      sortOrder: 1,
      createdAt: new Date("2026-01-02T00:00:00Z"),
    });
    await insertShift(db, {
      sectorId: sector.id,
      name: "A",
      sortOrder: 1,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

    const shifts = await listActiveShifts(db, sector.id);

    expect(shifts.map((row) => row.name)).toEqual(["A", "B"]);
  });

  it("setor inativo (P26): nenhum turno, mesmo ativo", async () => {
    const sector = await insertSector(db, "Antigo", { active: false });
    await insertShift(db, { sectorId: sector.id });

    expect(await listActiveShifts(db, sector.id)).toEqual([]);
  });

  it("setor sem turnos ou inexistente: lista vazia", async () => {
    const sector = await insertSector(db);

    expect(await listActiveShifts(db, sector.id)).toEqual([]);
    expect(
      await listActiveShifts(db, "00000000-0000-4000-8000-000000000000"),
    ).toEqual([]);
  });

  it("turno que atravessa a meia-noite mantém os dois horários", async () => {
    const sector = await insertSector(db);
    await insertShift(db, {
      sectorId: sector.id,
      startsAt: "22:00",
      endsAt: "06:00",
    });

    expect((await listActiveShifts(db, sector.id))[0]).toMatchObject({
      startsAt: "22:00",
      endsAt: "06:00",
    });
  });
});
