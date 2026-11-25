import type { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import {
  endsLocalSql,
  type HistorySourceInput,
  historyPairsSql,
  historySource,
  nowLocalSql,
} from "./history";

const OLD = new Date("2026-01-01T12:00:00.000Z");
const NOW = spDate("2026-11-20", "15:00");

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

function input(
  overrides: Partial<HistorySourceInput> = {},
): HistorySourceInput {
  return { from: "2026-11-18", to: "2026-11-20", shiftId: null, ...overrides };
}

// ULD Teste: Manhã (06–14) e Noite (22–06, atravessa a meia-noite) antigas,
// Tarde (14–22) criada às 12:00 de 19/11 (só vale de 19/11 em diante) e o
// "Turno Antigo" inativo. Câmara Teste (ativa) tem uma Manhã; "Setor Parado"
// (inativo) tem um turno ativo que nunca aparece.
async function seed() {
  const uld = await insertSector(db, "ULD Teste");
  const camara = await insertSector(db, "Câmara Teste");
  const parado = await insertSector(db, "Setor Parado", { active: false });
  const manha = await insertShift(db, {
    sectorId: uld.id,
    name: "Manhã",
    startsAt: "06:00",
    endsAt: "14:00",
    createdAt: OLD,
  });
  const noite = await insertShift(db, {
    sectorId: uld.id,
    name: "Noite",
    startsAt: "22:00",
    endsAt: "06:00",
    createdAt: OLD,
  });
  const tarde = await insertShift(db, {
    sectorId: uld.id,
    name: "Tarde",
    startsAt: "14:00",
    endsAt: "22:00",
    createdAt: spDate("2026-11-19", "12:00"),
  });
  await insertShift(db, {
    sectorId: uld.id,
    name: "Turno Antigo",
    startsAt: "00:00",
    endsAt: "06:00",
    active: false,
    createdAt: OLD,
  });
  const camaraManha = await insertShift(db, {
    sectorId: camara.id,
    name: "Manhã Câmara",
    startsAt: "06:00",
    endsAt: "14:00",
    createdAt: OLD,
  });
  await insertShift(db, {
    sectorId: parado.id,
    name: "Manhã Parado",
    startsAt: "06:00",
    endsAt: "14:00",
    createdAt: OLD,
  });
  return { uld, camara, parado, manha, noite, tarde, camaraManha };
}

async function pairs(
  filters: HistorySourceInput,
  sectorId: string | null,
): Promise<string[]> {
  const rows = await db
    .select({
      day: sql<string>`p.operational_date::text`,
      sector: sql<string>`p.sector_name`,
      shift: sql<string>`p.shift_name`,
      endsLocal: sql<string>`p.ends_local::text`,
    })
    .from(sql`(${historyPairsSql(filters, sectorId)}) as p`)
    .orderBy(
      sql`p.operational_date`,
      sql`lower(p.sector_name)`,
      sql`p.shift_order`,
    );
  return rows.map(
    (row) => `${row.day} ${row.sector} ${row.shift} → ${row.endsLocal}`,
  );
}

describe("historyPairsSql", () => {
  it("a grade do setor: 3 dias × turnos ativos, o criado no meio só dali em diante, o inativo nunca", async () => {
    const { uld } = await seed();

    expect(await pairs(input(), uld.id)).toEqual([
      "2026-11-18 ULD Teste Manhã → 2026-11-18 14:00:00",
      "2026-11-18 ULD Teste Noite → 2026-11-19 06:00:00",
      "2026-11-19 ULD Teste Manhã → 2026-11-19 14:00:00",
      "2026-11-19 ULD Teste Noite → 2026-11-20 06:00:00",
      "2026-11-19 ULD Teste Tarde → 2026-11-19 22:00:00",
      "2026-11-20 ULD Teste Manhã → 2026-11-20 14:00:00",
      "2026-11-20 ULD Teste Noite → 2026-11-21 06:00:00",
      "2026-11-20 ULD Teste Tarde → 2026-11-20 22:00:00",
    ]);
  });

  it("a Noite (22:00–06:00) termina no dia seguinte ao dia operacional", async () => {
    const { uld, noite } = await seed();

    expect(
      await pairs(
        input({ from: "2026-11-20", to: "2026-11-20", shiftId: noite.id }),
        uld.id,
      ),
    ).toEqual(["2026-11-20 ULD Teste Noite → 2026-11-21 06:00:00"]);
  });

  it("sem setor (todos): os setores ativos, nunca o inativo", async () => {
    await seed();

    const all = await pairs(
      input({ from: "2026-11-20", to: "2026-11-20" }),
      null,
    );

    expect(all.some((line) => line.includes("Câmara Teste"))).toBe(true);
    expect(all.some((line) => line.includes("ULD Teste"))).toBe(true);
    expect(all.some((line) => line.includes("Setor Parado"))).toBe(false);
    // ULD: Manhã, Noite e Tarde (criada em 19/11); Câmara: a Manhã.
    expect(all).toHaveLength(4);
  });

  it("o filtro de turno restringe a um turno só", async () => {
    const { uld, manha } = await seed();

    expect(await pairs(input({ shiftId: manha.id }), uld.id)).toEqual([
      "2026-11-18 ULD Teste Manhã → 2026-11-18 14:00:00",
      "2026-11-19 ULD Teste Manhã → 2026-11-19 14:00:00",
      "2026-11-20 ULD Teste Manhã → 2026-11-20 14:00:00",
    ]);
  });

  it("setor inativo pedido por id: nenhum par", async () => {
    const { parado } = await seed();

    expect(await pairs(input(), parado.id)).toEqual([]);
  });

  it("um dia só e um período sem turnos criados ainda", async () => {
    const { uld } = await seed();

    expect(
      await pairs(input({ from: "2026-11-19", to: "2026-11-19" }), uld.id),
    ).toHaveLength(3);
    expect(
      await pairs(input({ from: "2026-11-01", to: "2026-11-01" }), uld.id),
    ).toHaveLength(2);
  });
});

describe("nowLocalSql", () => {
  async function localText(now: Date): Promise<string | undefined> {
    const [row] = await db
      .select({ value: sql<string>`(${nowLocalSql(now)})::text` })
      .from(sql`(select 1) as t`);
    return row?.value;
  }

  it("é a hora de parede de São Paulo, não a de UTC", async () => {
    expect(await localText(new Date("2026-11-21T02:59:00Z"))).toBe(
      "2026-11-20 23:59:00",
    );
    expect(await localText(new Date("2026-11-21T03:00:00Z"))).toBe(
      "2026-11-21 00:00:00",
    );
  });
});

describe("endsLocalSql", () => {
  it("soma o dia ao fim do turno e um dia a mais se o turno atravessa a meia-noite", async () => {
    const { uld } = await seed();

    const rows = await db
      .select({
        name: sql<string>`s.name`,
        endsLocal: sql<string>`(${endsLocalSql(sql`date '2026-11-20'`)})::text`,
      })
      .from(sql`shift s`)
      .where(sql`s.sector_id = ${uld.id} and s.active`)
      .orderBy(sql`s.sort_order`);

    expect(rows).toEqual([
      { name: "Manhã", endsLocal: "2026-11-20 14:00:00" },
      { name: "Noite", endsLocal: "2026-11-21 06:00:00" },
      { name: "Tarde", endsLocal: "2026-11-20 22:00:00" },
    ]);
  });
});

describe("historySource", () => {
  it("só os pares já encerrados viram 'sem passagem'; a passagem entregue ocupa o lugar do par", async () => {
    const { uld, manha } = await seed();
    const ana = await insertUser(db, {
      role: "operator",
      sectorId: uld.id,
      name: "Ana Teste",
    });
    await insertHandover(db, {
      sectorId: uld.id,
      shiftId: manha.id,
      operationalDate: "2026-11-19",
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: spDate("2026-11-19", "14:05"),
    });

    const rows = await db
      .select({
        day: sql<string>`u.operational_date::text`,
        shift: sql<string>`u.shift_name`,
        situation: sql<string>`u.situation`,
      })
      .from(historySource(input(), uld.id, NOW))
      .orderBy(sql`u.operational_date`, sql`u.ends_local`, sql`u.shift_order`);

    expect(
      rows.map((row) => `${row.day} ${row.shift} ${row.situation}`),
    ).toEqual([
      "2026-11-18 Manhã missing",
      "2026-11-18 Noite missing",
      "2026-11-19 Manhã awaiting",
      "2026-11-19 Tarde missing",
      "2026-11-19 Noite missing",
      "2026-11-20 Manhã missing",
    ]);
  });

  it("fim do turno igual a agora conta como encerrado; um minuto antes, não", async () => {
    const { uld } = await seed();
    const range = input({ from: "2026-11-20", to: "2026-11-20" });

    async function missingAt(now: Date): Promise<number> {
      const [row] = await db
        .select({ total: sql<number>`count(*)`.mapWith(Number) })
        .from(historySource(range, uld.id, now));
      return row?.total ?? 0;
    }

    expect(await missingAt(spDate("2026-11-20", "14:00"))).toBe(1);
    expect(await missingAt(spDate("2026-11-20", "13:59"))).toBe(0);
  });
});
