import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Authz } from "@/features/authz/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertSector, insertShift } from "../../../test/fixtures";
import { listHandoverHistory } from "./history";
import { addDays } from "./saoPaulo";
import { hasShiftEnded } from "./shiftSuggestion";

// O "sem passagem" do histórico decide em SQL se o turno já terminou; a tela
// do formulário decide em JS (hasShiftEnded). Os dois têm de concordar em toda
// a grade abaixo: horários de borda, turnos que atravessam a meia-noite e a
// virada do dia em UTC (02:59Z e 03:00Z são 23:59 e 00:00 em São Paulo).
const DAY = "2026-11-21";
const OLD = new Date("2026-01-01T12:00:00.000Z");

const SHIFTS = [
  { name: "Manhã", startsAt: "06:00", endsAt: "14:00" },
  { name: "Tarde", startsAt: "14:00", endsAt: "22:00" },
  { name: "Noite", startsAt: "22:00", endsAt: "06:00" },
  { name: "Fim de tarde", startsAt: "18:00", endsAt: "00:00" },
  { name: "Madrugada", startsAt: "00:00", endsAt: "08:00" },
  { name: "Quase o dia todo", startsAt: "08:30", endsAt: "23:59" },
  { name: "Relâmpago", startsAt: "12:00", endsAt: "12:01" },
];

const CLOCKS = [
  "00:00",
  "00:01",
  "05:59",
  "06:00",
  "06:01",
  "07:59",
  "08:00",
  "12:00",
  "12:01",
  "13:59",
  "14:00",
  "14:01",
  "21:59",
  "22:00",
  "22:01",
  "23:58",
  "23:59",
];

const ADMIN: Authz = {
  userId: "admin-1",
  name: "Admin Teste",
  email: "admin@example.test",
  role: "admin",
  sectorId: null,
};

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

describe("paridade hasShiftEnded (JS) × SQL de pares encerrados", () => {
  it("concordam em todos os horários da grade, em três dias", async () => {
    await resetDb(client);
    const uld = await insertSector(db, "ULD");
    const created: { id: string; startsAt: string; endsAt: string }[] = [];
    for (const [index, shift] of SHIFTS.entries()) {
      created.push({
        ...shift,
        ...(await insertShift(db, {
          sectorId: uld.id,
          name: shift.name,
          startsAt: shift.startsAt,
          endsAt: shift.endsAt,
          sortOrder: index,
          createdAt: OLD,
        })),
      });
    }
    const days = [addDays(DAY, -1), DAY, addDays(DAY, 1)];

    const instants = [
      ...CLOCKS.map((clock) => spDate(DAY, clock)),
      // segundos não mudam o resultado: o fim do turno é sempre minuto cheio
      new Date(spDate(DAY, "14:00").getTime() + 30_000),
      new Date(spDate(DAY, "13:59").getTime() + 59_000),
      new Date("2026-11-21T02:59:00.000Z"),
      new Date("2026-11-21T03:00:00.000Z"),
    ];

    for (const now of instants) {
      const page = await listHandoverHistory(
        db,
        ADMIN,
        {
          filters: {
            period: "range",
            from: days[0] ?? DAY,
            to: days[2] ?? DAY,
            shiftId: null,
            situation: "missing",
            itemId: null,
          },
          sectorId: uld.id,
          page: 1,
        },
        now,
      );
      const fromSql = page.rows
        .map((row) => `${row.operationalDate}|${row.shiftId}`)
        .sort();
      const fromJs = days
        .flatMap((day) =>
          created
            .filter((shift) => hasShiftEnded(day, shift, now))
            .map((shift) => `${day}|${shift.id}`),
        )
        .sort();

      expect(fromSql, `agora = ${now.toISOString()}`).toEqual(fromJs);
    }
  });
});
