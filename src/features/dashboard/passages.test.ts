import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import type { Authz } from "@/features/authz/authz";
import { addDays } from "@/features/handovers/saoPaulo";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import {
  type DashboardWorld,
  seedDashboardWorld,
} from "../../../test/dashboardWorld";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { getPassagesData } from "./passages";
import type { DashboardQuery, PassagesData } from "./types";

const OLD = new Date("2026-01-01T12:00:00.000Z");
const ADMIN = authzOf({ role: "admin" });
const ZEROS: PassagesData = {
  expected: 0,
  delivered: 0,
  confirmed: 0,
  awaiting: 0,
  unconfirmed: 0,
  missing: 0,
  listed: 0,
};

function query(
  sectorId: string | null,
  from: string,
  to: string,
): DashboardQuery {
  return {
    sectorId,
    period: { from, to },
    previous: { from: addDays(from, -1), to: addDays(from, -1) },
  };
}

describe("getPassagesData sobre o mundo do critério de pronto", () => {
  let client: PGlite;
  let db: TestDb;
  let world: DashboardWorld;
  const logged: string[] = [];

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    world = await seedDashboardWorld(db);
  });

  afterAll(async () => {
    await client.close();
  });

  const worldQuery = (sectorId: string | null) =>
    query(sectorId, world.period.from, world.period.to);

  it("ULD: os números da tabela do mundo", async () => {
    expect(
      await getPassagesData(db, ADMIN, worldQuery(world.uld.id), world.now),
    ).toEqual({
      expected: 19,
      delivered: 10,
      confirmed: 7,
      awaiting: 1,
      unconfirmed: 2,
      missing: 11,
      listed: 21,
    });
  });

  it("invariantes: entregues = confirmadas + aguardando + não confirmadas; listed = entregues + sem passagem", async () => {
    for (const sectorId of [world.uld.id, world.camara.id, null]) {
      const data = await getPassagesData(
        db,
        ADMIN,
        worldQuery(sectorId),
        world.now,
      );
      expect(data.delivered).toBe(
        data.confirmed + data.awaiting + data.unconfirmed,
      );
      expect(data.listed).toBe(data.delivered + data.missing);
    }
  });

  it("entrega antecipada (20T) conta em entregues e fora de esperadas: um dia só", async () => {
    // 20/11 às 15:00: só a Manhã encerrou; a Tarde já foi entregue (antecipada).
    const data = await getPassagesData(
      db,
      ADMIN,
      query(world.uld.id, "2026-11-20", "2026-11-20"),
      world.now,
    );
    expect(data).toEqual({
      expected: 1,
      delivered: 2,
      confirmed: 1,
      awaiting: 1,
      unconfirmed: 0,
      missing: 0,
      listed: 2,
    });
    expect(data.expected - data.missing).toBeGreaterThanOrEqual(0);
  });

  it("a Noite de 19/11 (atravessa a meia-noite) pertence ao dia 19 e já encerrou às 06:00 de 20/11", async () => {
    const data = await getPassagesData(
      db,
      ADMIN,
      query(world.uld.id, "2026-11-19", "2026-11-19"),
      world.now,
    );
    // Manhã (entregue atrasada), Tarde (sem passagem) e Noite (confirmada).
    expect(data).toEqual({
      expected: 3,
      delivered: 2,
      confirmed: 1,
      awaiting: 0,
      unconfirmed: 1,
      missing: 1,
      listed: 3,
    });
  });

  it("turno inativo: a passagem do Turno Antigo (15/11) entra em entregues e fora de esperadas", async () => {
    const data = await getPassagesData(
      db,
      ADMIN,
      query(world.uld.id, "2026-11-15", "2026-11-15"),
      world.now,
    );
    // 15M (não confirmada) e 15A (confirmada, turno inativo) entregues;
    // esperadas = Manhã, Tarde (rascunho, sem passagem) e Noite (sem passagem).
    expect(data).toEqual({
      expected: 3,
      delivered: 2,
      confirmed: 1,
      awaiting: 0,
      unconfirmed: 1,
      missing: 2,
      listed: 4,
    });
  });

  it("a passagem corrigida (17T) continua confirmada", async () => {
    const data = await getPassagesData(
      db,
      ADMIN,
      query(world.uld.id, "2026-11-17", "2026-11-17"),
      world.now,
    );
    expect(data.confirmed).toBe(1);
    expect(data.delivered).toBe(1);
    expect(data.missing).toBe(2);
  });

  it("período de 1 dia sem nada entregue (turnos já encerrados) e de 93 dias", async () => {
    const quiet = await getPassagesData(
      db,
      ADMIN,
      query(world.uld.id, "2026-11-18", "2026-11-18"),
      world.now,
    );
    expect(quiet).toEqual({ ...ZEROS, expected: 3, missing: 3, listed: 3 });

    const long = await getPassagesData(
      db,
      ADMIN,
      query(world.uld.id, "2026-08-20", "2026-11-20"),
      world.now,
    );
    // 93 dias × 3 turnos ativos, menos Tarde e Noite de hoje (ainda abertas).
    expect(long.expected).toBe(93 * 3 - 2);
    // As 10 da semana mais A10M e A12N (as duas confirmadas do período anterior).
    expect(long.delivered).toBe(12);
    expect(long.missing).toBe(93 * 3 - 2 - 10);
  });

  it("admin em 'Todos os setores' soma os dois setores ativos e ignora o Setor Parado", async () => {
    expect(
      await getPassagesData(db, ADMIN, worldQuery(null), world.now),
    ).toEqual({
      expected: 25,
      delivered: 12,
      confirmed: 8,
      awaiting: 2,
      unconfirmed: 2,
      missing: 15,
      listed: 27,
    });
  });

  it("admin com o setor inativo: tudo zero, mesmo com a passagem P17 no período", async () => {
    expect(
      await getPassagesData(
        db,
        ADMIN,
        worldQuery(world.inactive.id),
        world.now,
      ),
    ).toEqual(ZEROS);
  });

  it("operador com sectorId de outro setor no input: vê o próprio setor", async () => {
    const own = await getPassagesData(
      db,
      world.people.ana,
      worldQuery(world.camara.id),
      world.now,
    );
    expect(own).toEqual(
      await getPassagesData(db, ADMIN, worldQuery(world.uld.id), world.now),
    );
    expect(own.expected).toBe(19);
    const cris = await getPassagesData(
      db,
      world.people.cris,
      worldQuery(world.uld.id),
      world.now,
    );
    expect(cris.expected).toBe(6);
  });

  it("operador de setor inativo: tudo zero", async () => {
    expect(
      await getPassagesData(
        db,
        world.people.duda,
        worldQuery(world.inactive.id),
        world.now,
      ),
    ).toEqual(ZEROS);
  });

  it("operador sem setor (estado que o toAuthz já recusa): nada", async () => {
    const orphan: Authz = {
      userId: "orphan",
      name: "Sem Setor",
      email: "orphan@example.test",
      role: "operator",
      sectorId: null,
    };
    expect(
      await getPassagesData(db, orphan, worldQuery(world.uld.id), world.now),
    ).toEqual(ZEROS);
  });

  it("uma consulta só ao banco, não uma por situação", async () => {
    const logging = drizzle(client, {
      schema,
      logger: { logQuery: (text) => void logged.push(text) },
    });
    logged.length = 0;
    await getPassagesData(logging, ADMIN, worldQuery(world.uld.id), world.now);
    expect(logged).toHaveLength(1);
  });
});

describe("getPassagesData em cenários próprios (fronteiras)", () => {
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

  async function setup(
    shift: { startsAt: string; endsAt: string; createdAt?: Date } = {
      startsAt: "06:00",
      endsAt: "14:00",
    },
  ) {
    const sector = await insertSector(db, "Setor Teste");
    const turn = await insertShift(db, {
      sectorId: sector.id,
      name: "Turno Teste",
      createdAt: OLD,
      ...shift,
    });
    const ana = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      name: "Ana Teste",
    });
    return { sector, turn, ana };
  }

  it("sem nenhum dado (setor sem turnos nem passagens): tudo zero", async () => {
    const sector = await insertSector(db, "Vazio Teste");
    expect(
      await getPassagesData(
        db,
        ADMIN,
        query(sector.id, "2026-11-14", "2026-11-20"),
        spDate("2026-11-20", "15:00"),
      ),
    ).toEqual(ZEROS);
  });

  it("fim do turno == agora conta como encerrado; um minuto antes, não", async () => {
    const { sector } = await setup();
    const day = query(sector.id, "2026-11-21", "2026-11-21");
    expect(
      await getPassagesData(db, ADMIN, day, spDate("2026-11-21", "14:00")),
    ).toEqual({ ...ZEROS, expected: 1, missing: 1, listed: 1 });
    expect(
      await getPassagesData(db, ADMIN, day, spDate("2026-11-21", "13:59")),
    ).toEqual(ZEROS);
  });

  it("turno que atravessa a meia-noite encerra no dia seguinte (06:00 == agora conta)", async () => {
    const { sector } = await setup({ startsAt: "22:00", endsAt: "06:00" });
    const day = query(sector.id, "2026-11-21", "2026-11-21");
    expect(
      await getPassagesData(db, ADMIN, day, spDate("2026-11-22", "05:59")),
    ).toEqual(ZEROS);
    expect(
      await getPassagesData(db, ADMIN, day, spDate("2026-11-22", "06:00")),
    ).toEqual({ ...ZEROS, expected: 1, missing: 1, listed: 1 });
  });

  it("o par antes do dia da criação do turno (em São Paulo) não é esperado", async () => {
    const { sector } = await setup({
      startsAt: "06:00",
      endsAt: "14:00",
      createdAt: spDate("2026-11-18", "09:00"),
    });
    expect(
      await getPassagesData(
        db,
        ADMIN,
        query(sector.id, "2026-11-16", "2026-11-19"),
        spDate("2026-11-21", "15:00"),
      ),
    ).toEqual({ ...ZEROS, expected: 2, missing: 2, listed: 2 });
  });

  it("passagem de um dia anterior à criação do turno entra em entregues e fora de esperadas", async () => {
    const { sector, turn, ana } = await setup({
      startsAt: "06:00",
      endsAt: "14:00",
      createdAt: spDate("2026-11-20", "09:00"),
    });
    await insertHandover(db, {
      sectorId: sector.id,
      shiftId: turn.id,
      operationalDate: "2026-11-19",
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: spDate("2026-11-19", "14:05"),
    });
    expect(
      await getPassagesData(
        db,
        ADMIN,
        query(sector.id, "2026-11-19", "2026-11-20"),
        spDate("2026-11-20", "15:00"),
      ),
    ).toEqual({
      expected: 1,
      delivered: 1,
      confirmed: 0,
      awaiting: 1,
      unconfirmed: 0,
      missing: 1,
      listed: 2,
    });
  });

  it("rascunho nunca entregue é sem passagem; entregue de um par aberto não é esperada", async () => {
    const { sector, turn, ana } = await setup();
    await insertHandover(db, {
      sectorId: sector.id,
      shiftId: turn.id,
      operationalDate: "2026-11-19",
      status: "draft",
      updatedBy: ana.id,
    });
    await insertHandover(db, {
      sectorId: sector.id,
      shiftId: turn.id,
      operationalDate: "2026-11-20",
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: spDate("2026-11-20", "13:00"),
    });
    // Agora = 13:30 de 20/11: a Manhã de 20/11 ainda não encerrou.
    expect(
      await getPassagesData(
        db,
        ADMIN,
        query(sector.id, "2026-11-19", "2026-11-20"),
        spDate("2026-11-20", "13:30"),
      ),
    ).toEqual({
      expected: 1,
      delivered: 1,
      confirmed: 0,
      awaiting: 1,
      unconfirmed: 0,
      missing: 1,
      listed: 2,
    });
  });

  it("período de 93 dias sem passagem alguma: um par por dia", async () => {
    const { sector } = await setup();
    expect(
      await getPassagesData(
        db,
        ADMIN,
        query(sector.id, "2026-08-20", "2026-11-20"),
        spDate("2026-11-21", "15:00"),
      ),
    ).toEqual({ ...ZEROS, expected: 93, missing: 93, listed: 93 });
  });
});
