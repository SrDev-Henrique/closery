import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { request, requestStatusEvent } from "@/db/schema/requests";
import { saoPauloParts } from "@/features/handovers/saoPaulo";
import type { RequestStatus } from "@/lib/requestStatuses";

import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertRequest,
  insertRequestEvent,
  insertSector,
  insertUser,
} from "../../../test/fixtures";
import { deliveredBetweenSql, firstDeliveredAtSql } from "./sql";

// "Entregue no período" olha a PRIMEIRA vez que a solicitação virou entregue,
// no dia de São Paulo. A regra existe duas vezes (SQL e esta função JS sobre
// os eventos crus) e as duas têm de concordar em toda a grade abaixo.
const FROM = "2026-11-10";
const TO = "2026-11-12";

type Event = { toStatus: RequestStatus; at: Date };

function firstDeliveredAt(events: readonly Event[]): Date | null {
  const times = events
    .filter((event) => event.toStatus === "delivered")
    .map((event) => event.at.getTime());
  return times.length === 0 ? null : new Date(Math.min(...times));
}

function deliveredInPeriod(events: readonly Event[]): boolean {
  const first = firstDeliveredAt(events);
  if (first === null) return false;
  const day = saoPauloParts(first).date;
  return day >= FROM && day <= TO;
}

const CASES: readonly { label: string; events: readonly Event[] }[] = [
  {
    label: "23:59:59.999 do último dia (02:59:59.999Z do dia seguinte)",
    events: [
      {
        toStatus: "delivered",
        at: new Date(spDate("2026-11-12", "23:59").getTime() + 59_999),
      },
    ],
  },
  {
    label: "00:00 do dia seguinte ao fim",
    events: [{ toStatus: "delivered", at: spDate("2026-11-13", "00:00") }],
  },
  {
    label: "00:00 do primeiro dia",
    events: [{ toStatus: "delivered", at: spDate("2026-11-10", "00:00") }],
  },
  {
    label: "23:59:59.999 da véspera do início",
    events: [
      {
        toStatus: "delivered",
        at: new Date(spDate("2026-11-09", "23:59").getTime() + 59_999),
      },
    ],
  },
  {
    label: "reaberta: a 1ª entrega foi antes do período, a 2ª dentro (fora)",
    events: [
      { toStatus: "delivered", at: spDate("2026-11-08", "09:00") },
      { toStatus: "in_transit", at: spDate("2026-11-09", "09:00") },
      { toStatus: "delivered", at: spDate("2026-11-11", "09:00") },
    ],
  },
  {
    label: "reaberta e reentregue dentro do período (conta uma vez)",
    events: [
      { toStatus: "delivered", at: spDate("2026-11-11", "09:00") },
      { toStatus: "in_transit", at: spDate("2026-11-11", "10:00") },
      { toStatus: "delivered", at: spDate("2026-11-12", "10:00") },
    ],
  },
  {
    label: "cancelada depois de entregue (a entrega vale)",
    events: [
      { toStatus: "delivered", at: spDate("2026-11-11", "09:00") },
      { toStatus: "cancelled", at: spDate("2026-11-11", "12:00") },
    ],
  },
  {
    label: "cancelada sem nunca ter sido entregue",
    events: [{ toStatus: "cancelled", at: spDate("2026-11-11", "09:00") }],
  },
  {
    label: "em trânsito, sem entrega",
    events: [{ toStatus: "in_transit", at: spDate("2026-11-11", "09:00") }],
  },
  {
    label: "sem nenhum evento",
    events: [],
  },
];

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

describe("paridade deliveredBetweenSql × 1ª entrega em JS", () => {
  it("a grade inteira bate: pertencimento ao período e o instante da 1ª entrega", async () => {
    await resetDb(client);
    const sector = await insertSector(db);
    const author = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
    });

    const seeded: { id: string; label: string; events: readonly Event[] }[] =
      [];
    for (const { label, events } of CASES) {
      const { id } = await insertRequest(db, {
        sectorId: sector.id,
        createdBy: author.id,
        createdAt: spDate("2026-11-01", "08:00"),
        status: "requested",
        events: false,
      });
      // Inseridos fora de ordem de propósito: o menor changed_at vence, não o primeiro inserido.
      for (const event of [...events].reverse()) {
        await insertRequestEvent(db, {
          requestId: id,
          fromStatus: "requested",
          toStatus: event.toStatus,
          changedBy: author.id,
          changedAt: event.at,
        });
      }
      seeded.push({ id, label, events });
    }
    expect(seeded).toHaveLength(CASES.length);

    const inPeriod = await db
      .select({ id: request.id })
      .from(request)
      .where(deliveredBetweenSql(FROM, TO));
    const inPeriodIds = inPeriod.map((row) => row.id);
    const instants = await db
      .select({
        id: request.id,
        first: firstDeliveredAtSql().mapWith(requestStatusEvent.changedAt),
      })
      .from(request);
    const firstById = new Map(instants.map((row) => [row.id, row.first]));

    for (const { id, label, events } of seeded) {
      expect(inPeriodIds.includes(id), label).toBe(deliveredInPeriod(events));
      expect(firstById.get(id)?.getTime() ?? null, label).toBe(
        firstDeliveredAt(events)?.getTime() ?? null,
      );
    }
    // Cada solicitação aparece no máximo uma vez (a reentregue não duplica).
    expect(new Set(inPeriodIds).size).toBe(inPeriodIds.length);
    // A grade tem de ter dentro e fora, senão a paridade não prova nada.
    const expected = seeded.filter((entry) => deliveredInPeriod(entry.events));
    expect(expected.length).toBeGreaterThan(2);
    expect(expected.length).toBeLessThan(seeded.length - 2);
  });

  it("um dia só (de = ate) e o fuso: 02:59Z do dia 11 ainda é o dia 10 em São Paulo", async () => {
    await resetDb(client);
    const sector = await insertSector(db);
    const author = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
    });
    const late = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: author.id,
      createdAt: spDate("2026-11-01", "08:00"),
      events: false,
    });
    await insertRequestEvent(db, {
      requestId: late.id,
      fromStatus: "requested",
      toStatus: "delivered",
      changedBy: author.id,
      changedAt: new Date("2026-11-11T02:59:00Z"),
    });
    const early = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: author.id,
      createdAt: spDate("2026-11-01", "08:00"),
      events: false,
    });
    await insertRequestEvent(db, {
      requestId: early.id,
      fromStatus: "requested",
      toStatus: "delivered",
      changedBy: author.id,
      changedAt: new Date("2026-11-11T03:00:00Z"),
    });

    const ids = async (day: string) =>
      (
        await db
          .select({ id: request.id })
          .from(request)
          .where(deliveredBetweenSql(day, day))
      ).map((row) => row.id);

    expect(await ids("2026-11-10")).toEqual([late.id]);
    expect(await ids("2026-11-11")).toEqual([early.id]);
  });
});
