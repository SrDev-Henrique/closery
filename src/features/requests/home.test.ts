import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Authz } from "@/features/authz/authz";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertDestination,
  insertRequest,
  insertSector,
  insertUser,
} from "../../../test/fixtures";
import { getHomeRequests } from "./home";
import { HOME_STALE_LIMIT } from "./limits";

const NOW = spDate("2026-11-21", "12:00");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

let client: PGlite;
let db: TestDb;
let sectorId: string;
let otherId: string;
let anaId: string;
let docaId: string;
let operator: Authz;
let admin: Authz;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
  sectorId = (await insertSector(db)).id;
  otherId = (await insertSector(db)).id;
  anaId = (await insertUser(db, { role: "operator", sectorId })).id;
  docaId = (await insertDestination(db, { name: "Doca 3" })).id;
  operator = authzOf({ role: "operator", userId: anaId, sectorId });
  admin = authzOf({ role: "admin" });
});

function seed(overrides: Partial<Parameters<typeof insertRequest>[1]> = {}) {
  return insertRequest(db, {
    sectorId,
    createdBy: anaId,
    destinationId: docaId,
    createdAt: ago(HOUR),
    ...overrides,
  });
}

describe("getHomeRequests", () => {
  it("sem solicitações: zeros", async () => {
    expect(await getHomeRequests(db, operator, sectorId, NOW)).toEqual({
      openCount: 0,
      staleCount: 0,
      stale: [],
    });
  });

  it("conta as abertas e as paradas; fechadas não entram", async () => {
    await seed({ description: "recente" });
    const stale = await seed({
      description: "parada",
      status: "in_transit",
      createdAt: ago(6 * DAY),
      statusChangedAt: ago(4 * DAY),
    });
    await seed({
      status: "delivered",
      createdAt: ago(9 * DAY),
      statusChangedAt: ago(8 * DAY),
    });
    await seed({
      status: "cancelled",
      createdAt: ago(9 * DAY),
      statusChangedAt: ago(8 * DAY),
    });

    const result = await getHomeRequests(db, operator, sectorId, NOW);

    expect(result.openCount).toBe(2);
    expect(result.staleCount).toBe(1);
    expect(result.stale).toEqual([
      {
        id: stale.id,
        description: "parada",
        destinationName: "Doca 3",
        status: "in_transit",
        daysInStatus: 4,
        stale: true,
      },
    ]);
  });

  it("até 5 paradas, as mais antigas no status primeiro; a contagem é de todas", async () => {
    for (let i = 0; i < HOME_STALE_LIMIT + 3; i++) {
      await seed({
        description: `Parada ${i}`,
        createdAt: ago(10 * DAY - i * HOUR),
        events: false,
      });
    }

    const result = await getHomeRequests(db, operator, sectorId, NOW);

    expect(result.openCount).toBe(8);
    expect(result.staleCount).toBe(8);
    expect(result.stale).toHaveLength(HOME_STALE_LIMIT);
    expect(result.stale.map((row) => row.description)).toEqual([
      "Parada 0",
      "Parada 1",
      "Parada 2",
      "Parada 3",
      "Parada 4",
    ]);
  });

  it("72 h exatas não é parada; 72 h + 1 ms é", async () => {
    await seed({ createdAt: ago(72 * HOUR), events: false });
    expect(
      (await getHomeRequests(db, operator, sectorId, NOW)).staleCount,
    ).toBe(0);

    await seed({ createdAt: ago(72 * HOUR + 1), events: false });
    expect(
      (await getHomeRequests(db, operator, sectorId, NOW)).staleCount,
    ).toBe(1);
  });

  it("só o setor pedido; operador de outro setor recebe zeros; admin lê qualquer um", async () => {
    await seed();
    await insertRequest(db, {
      sectorId: otherId,
      createdBy: anaId,
      destinationOther: "Em outro setor",
      createdAt: ago(HOUR),
    });

    expect((await getHomeRequests(db, operator, sectorId, NOW)).openCount).toBe(
      1,
    );
    expect(await getHomeRequests(db, operator, otherId, NOW)).toEqual({
      openCount: 0,
      staleCount: 0,
      stale: [],
    });
    expect((await getHomeRequests(db, admin, otherId, NOW)).openCount).toBe(1);
  });

  it("setor inativo: zeros", async () => {
    const inactive = await insertSector(db, "Inativo", { active: false });
    await insertRequest(db, {
      sectorId: inactive.id,
      createdBy: anaId,
      destinationOther: "Qualquer",
      createdAt: ago(HOUR),
    });

    expect(await getHomeRequests(db, admin, inactive.id, NOW)).toEqual({
      openCount: 0,
      staleCount: 0,
      stale: [],
    });
  });
});
