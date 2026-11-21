import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertDestination,
  insertInvite,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { getAdminOverviewCounts } from "./overview";

const NOW = new Date("2026-11-21T12:00:00.000Z");
const ONE_DAY = 24 * 60 * 60 * 1000;

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

describe("getAdminOverviewCounts", () => {
  it("banco vazio: tudo zero, sem erro e sem null", async () => {
    expect(await getAdminOverviewCounts(db, NOW)).toEqual({
      sectors: 0,
      shifts: 0,
      items: 0,
      destinations: 0,
      people: 0,
      pendingInvites: 0,
    });
  });

  it("conta só ativos: setor, turno, item, destino e pessoa inativos ficam de fora, e turnos e itens de setor inativo também (P26)", async () => {
    const uld = await insertSector(db, "ULD");
    const closed = await insertSector(db, "Fechado", { active: false });
    await insertShift(db, { sectorId: uld.id });
    await insertShift(db, { sectorId: uld.id });
    await insertShift(db, { sectorId: uld.id, active: false });
    await insertShift(db, { sectorId: closed.id });
    await insertItem(db, { sectorId: uld.id });
    await insertItem(db, { sectorId: uld.id, active: false });
    await insertItem(db, { sectorId: closed.id });
    await insertDestination(db);
    await insertDestination(db);
    await insertDestination(db, { active: false });
    await insertUser(db, { role: "admin", sectorId: null });
    await insertUser(db, { role: "operator", sectorId: uld.id });
    await insertUser(db, {
      role: "operator",
      sectorId: uld.id,
      deactivatedAt: NOW,
    });

    expect(await getAdminOverviewCounts(db, NOW)).toEqual({
      sectors: 1,
      shifts: 2,
      items: 1,
      destinations: 2,
      people: 2,
      pendingInvites: 0,
    });
  });

  it("convite pendente é só o válido: usado, cancelado e expirado não contam", async () => {
    const sector = await insertSector(db);
    const base = { role: "operator", sectorId: sector.id, now: NOW } as const;
    await insertInvite(db, base);
    await insertInvite(db, base);
    await insertInvite(db, { ...base, usedAt: NOW });
    await insertInvite(db, { ...base, cancelledAt: NOW });
    await insertInvite(db, { ...base, expiresAt: new Date(NOW.getTime() - 1) });
    // Expira exatamente agora: já conta como expirado (expires_at > now).
    await insertInvite(db, { ...base, expiresAt: NOW });
    await insertInvite(db, {
      ...base,
      expiresAt: new Date(NOW.getTime() + ONE_DAY),
    });

    const counts = await getAdminOverviewCounts(db, NOW);

    expect(counts.pendingInvites).toBe(3);
  });

  it("a hora decide: o mesmo convite deixa de contar depois de expirar", async () => {
    const sector = await insertSector(db);
    await insertInvite(db, {
      role: "operator",
      sectorId: sector.id,
      expiresAt: new Date(NOW.getTime() + ONE_DAY),
      now: NOW,
    });

    const before = await getAdminOverviewCounts(db, NOW);
    const after = await getAdminOverviewCounts(
      db,
      new Date(NOW.getTime() + ONE_DAY),
    );

    expect([before.pendingInvites, after.pendingInvites]).toEqual([1, 0]);
  });
});
