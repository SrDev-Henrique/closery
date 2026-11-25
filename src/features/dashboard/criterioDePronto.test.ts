import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listHandoverHistory } from "@/features/handovers/history";
import {
  type HistorySituationFilter,
  parseHistoryFilters,
} from "@/features/handovers/historyFilters";
import { hrefQuery, queryRecord } from "@/lib/searchParams";
import { authzOf } from "../../../test/authz";
import {
  type DashboardWorld,
  oraclePassages,
  rawHandovers,
  rawShifts,
  seedDashboardWorld,
} from "../../../test/dashboardWorld";
import { createTestDb, type TestDb } from "../../../test/db";
import { passagesListHref } from "./links";
import { getPassagesData } from "./passages";
import type { DashboardQuery, PassagesData } from "./types";

// O teste do critério de pronto (spec §12): num setor com turnos, passagens
// confirmadas, aguardando, não confirmadas, sem passagem e uma correção feita
// por correctHandover, cada número do dashboard bate com um oráculo
// independente. O oráculo é JS sobre leitores crus (test/dashboardWorld.ts);
// a lista que o link abre só entra como paridade (número = total da lista).

const ADMIN = authzOf({ role: "admin" });

let client: PGlite;
let db: TestDb;
let world: DashboardWorld;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
  world = await seedDashboardWorld(db);
});

afterAll(async () => {
  await client.close();
});

function queryOf(sectorId: string | null): DashboardQuery {
  return {
    sectorId,
    period: { from: world.period.from, to: world.period.to },
    previous: world.previous,
  };
}

describe("Passagens", () => {
  const SITUATIONS: readonly [keyof PassagesData, HistorySituationFilter][] = [
    ["expected", "expected"],
    ["delivered", "delivered"],
    ["confirmed", "confirmed"],
    ["awaiting", "awaiting"],
    ["unconfirmed", "unconfirmed"],
    ["missing", "missing"],
    ["listed", "all"],
  ];

  async function scopes() {
    const ids = [world.uld.id, world.camara.id];
    const shifts = await rawShifts(db, ids);
    const handovers = await rawHandovers(db, ids);
    const oracle = (sectorIds: readonly string[]) =>
      oraclePassages({
        shifts,
        handovers,
        sectorIds,
        period: world.period,
        now: world.now,
      });
    return [
      { name: "ULD", sectorId: world.uld.id, oracle: oracle([world.uld.id]) },
      {
        name: "Câmara",
        sectorId: world.camara.id,
        oracle: oracle([world.camara.id]),
      },
      { name: "Todos os setores", sectorId: null, oracle: oracle(ids) },
    ];
  }

  it("cada número bate com o oráculo independente, nos três escopos", async () => {
    for (const scope of await scopes()) {
      const data = await getPassagesData(
        db,
        ADMIN,
        queryOf(scope.sectorId),
        world.now,
      );
      expect(data, scope.name).toEqual(scope.oracle);
    }
  });

  it("e com os literais calculados à mão (tabela do mundo)", async () => {
    expect(
      await getPassagesData(db, ADMIN, queryOf(world.uld.id), world.now),
    ).toEqual({
      expected: 19,
      delivered: 10,
      confirmed: 7,
      awaiting: 1,
      unconfirmed: 2,
      missing: 11,
      listed: 21,
    });
    expect(
      await getPassagesData(db, ADMIN, queryOf(world.camara.id), world.now),
    ).toEqual({
      expected: 6,
      delivered: 2,
      confirmed: 1,
      awaiting: 1,
      unconfirmed: 0,
      missing: 4,
      listed: 6,
    });
    expect(await getPassagesData(db, ADMIN, queryOf(null), world.now)).toEqual({
      expected: 25,
      delivered: 12,
      confirmed: 8,
      awaiting: 2,
      unconfirmed: 2,
      missing: 15,
      listed: 27,
    });
  });

  it("cada número é o total da lista que o link dele abre (paridade, nunca oráculo)", async () => {
    for (const scope of await scopes()) {
      const data = await getPassagesData(
        db,
        ADMIN,
        queryOf(scope.sectorId),
        world.now,
      );
      const sector = scope.sectorId === null ? "todos" : scope.sectorId;
      for (const [field, situation] of SITUATIONS) {
        const href = passagesListHref(world.period, situation, { sector });
        const filters = parseHistoryFilters(
          queryRecord(hrefQuery(href)),
          world.today,
        );
        expect(filters.situation, `${scope.name} ${field}`).toBe(situation);
        const list = await listHandoverHistory(
          db,
          ADMIN,
          { filters, sectorId: scope.sectorId, page: 1 },
          world.now,
        );
        expect(list.total, `${scope.name} ${field}`).toBe(data[field]);
      }
    }
  });

  it("conta 'sem passagem' por par (o rascunho de 15/11 incluso) e a corrigida segue confirmada", async () => {
    const handovers = await rawHandovers(db, [world.uld.id]);
    const corrected = handovers.filter((row) => row.corrected);
    expect(corrected.map((row) => row.id)).toEqual([world.correctedHandoverId]);
    expect(corrected[0]?.status).toBe("confirmed");

    const confirmedList = await listHandoverHistory(
      db,
      ADMIN,
      {
        filters: {
          ...parseHistoryFilters({}, world.today),
          situation: "corrected",
        },
        sectorId: world.uld.id,
        page: 1,
      },
      world.now,
    );
    expect(confirmedList.rows.map((row) => row.handoverId)).toEqual([
      world.correctedHandoverId,
    ]);
    expect(confirmedList.rows[0]?.situation).toBe("confirmed");

    const data = await getPassagesData(
      db,
      ADMIN,
      queryOf(world.uld.id),
      world.now,
    );
    expect(data.missing).toBe(11);
    expect(data.confirmed).toBe(7);
  });

  it("o operador vê o mesmo que o admin vê do próprio setor", async () => {
    const asOperator = await getPassagesData(
      db,
      world.people.ana,
      queryOf(world.camara.id),
      world.now,
    );
    const asAdmin = await getPassagesData(
      db,
      ADMIN,
      queryOf(world.uld.id),
      world.now,
    );
    expect(asOperator).toEqual(asAdmin);
  });
});
