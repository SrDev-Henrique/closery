import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { request } from "@/db/schema/requests";
import { REQUEST_STATUSES } from "@/lib/requestStatuses";

import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertRequest,
  insertSector,
  insertUser,
} from "../../../test/fixtures";
import { daysInStatusSql, staleSql } from "./sql";
import { daysInStatus, isStale } from "./stale";

// "Parada" e "dias no status" são calculados no SQL (contagens, ordem, status
// na entrega) e no JS (stale.ts, telas). Os dois têm de concordar em toda a
// grade abaixo, nas bordas de 72 h.
const NOW = new Date("2026-11-21T15:00:00.000Z");
const HOUR = 3_600_000;
const MINUTE = 60_000;

// Quanto tempo antes de NOW o status mudou (negativo = no futuro).
const AGES: readonly [string, number][] = [
  ["1 h no futuro", -HOUR],
  ["agora", 0],
  ["1 ms", 1],
  ["23 h 59", 24 * HOUR - MINUTE],
  ["24 h", 24 * HOUR],
  ["71 h 59", 72 * HOUR - MINUTE],
  ["72 h exatas", 72 * HOUR],
  ["72 h + 1 ms", 72 * HOUR + 1],
  ["96 h", 96 * HOUR],
  ["30 dias", 30 * 24 * HOUR],
];

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

describe("paridade stale.ts × SQL", () => {
  it("daysInStatusSql e staleSql batem com daysInStatus e isStale em toda a grade", async () => {
    await resetDb(client);
    const sector = await insertSector(db);
    const author = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
    });

    const cases: {
      id: string;
      label: string;
      status: (typeof REQUEST_STATUSES)[number];
      changedAt: Date;
    }[] = [];
    for (const status of REQUEST_STATUSES) {
      for (const [label, age] of AGES) {
        const changedAt = new Date(NOW.getTime() - age);
        const { id } = await insertRequest(db, {
          sectorId: sector.id,
          createdBy: author.id,
          status,
          createdAt: changedAt,
          statusChangedAt: changedAt,
          events: false,
        });
        cases.push({ id, label, status, changedAt });
      }
    }
    expect(cases).toHaveLength(REQUEST_STATUSES.length * AGES.length);

    for (const { id, label, status, changedAt } of cases) {
      const [row] = await db
        .select({
          days: daysInStatusSql(NOW, request.statusChangedAt),
          stale: staleSql(NOW, request.status, request.statusChangedAt),
        })
        .from(request)
        .where(eq(request.id, id));
      expect(row, `${status} / ${label}`).toEqual({
        days: daysInStatus(changedAt, NOW),
        stale: isStale(status, changedAt, NOW),
      });
    }
  });

  it("as bordas conhecidas: 72 h exatas não é parada (3 dias); 72 h + 1 ms é; futuro é 0 dia", async () => {
    await resetDb(client);
    const sector = await insertSector(db);
    const author = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
    });
    const at = (age: number) => new Date(NOW.getTime() - age);
    const exact = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: author.id,
      createdAt: at(72 * HOUR),
      events: false,
    });
    const over = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: author.id,
      createdAt: at(72 * HOUR + 1),
      events: false,
    });
    const future = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: author.id,
      createdAt: at(-HOUR),
      events: false,
    });

    const read = async (id: string) => {
      const [row] = await db
        .select({
          days: daysInStatusSql(NOW, request.statusChangedAt),
          stale: staleSql(NOW, request.status, request.statusChangedAt),
        })
        .from(request)
        .where(eq(request.id, id));
      return row;
    };
    expect(await read(exact.id)).toEqual({ days: 3, stale: false });
    expect(await read(over.id)).toEqual({ days: 3, stale: true });
    expect(await read(future.id)).toEqual({ days: 0, stale: false });
  });
});
