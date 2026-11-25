import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listHandoverHistory } from "@/features/handovers/history";
import {
  listHistoryItems,
  listHistoryShifts,
} from "@/features/handovers/historyChoices";
import {
  type HistorySituationFilter,
  parseHistoryFilters,
} from "@/features/handovers/historyFilters";
import { addDays } from "@/features/handovers/saoPaulo";
import { hrefQuery, queryRecord } from "@/lib/searchParams";
import { authzOf } from "../../../test/authz";
import {
  type DashboardWorld,
  oracleControls,
  oracleCsv,
  oraclePassages,
  oracleRequests,
  oracleSlotOf,
  oracleStock,
  rawDeliveredItems,
  rawHandovers,
  rawRequests,
  rawShifts,
  seedDashboardWorld,
} from "../../../test/dashboardWorld";
import { createTestDb, type TestDb } from "../../../test/db";
import { getControlsData } from "./controls";
import { CSV_BOM } from "./csv";
import { buildPassagesCsv } from "./exportCsv";
import { lastCountHref, linkExtras, passagesListHref } from "./links";
import { getPassagesData } from "./passages";
import { periodDays, previousPeriod } from "./period";
import { getRequestsData } from "./requests";
import { getStockData } from "./stock";
import type { DashboardQuery, DashboardScope, PassagesData } from "./types";

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

describe("Controles e Estoque", () => {
  const sectorIdsOf = (sectorId: string | null) =>
    sectorId === null ? [world.uld.id, world.camara.id] : [sectorId];

  async function controlsOracle(sectorId: string | null) {
    const sectorIds = sectorIdsOf(sectorId);
    const lines = await rawDeliveredItems(db, {
      sectorIds,
      range: { from: world.previous.from, to: world.period.to },
      kind: "control",
    });
    const shifts = await rawShifts(db, sectorIds);
    const data = await getControlsData(db, ADMIN, queryOf(sectorId));
    const metrics = oracleControls({
      lines,
      itemIds: data.items.map((metric) => metric.itemId),
      period: world.period,
      previous: world.previous,
    });
    return { data, metrics, lines, shifts };
  }

  const SCOPES: readonly [string, () => string | null][] = [
    ["ULD", () => world.uld.id],
    ["Câmara", () => world.camara.id],
    ["Todos os setores", () => null],
  ];

  it.each(
    SCOPES,
  )("Controles (%s): total, anterior, passagens, média e segmentos batem com o oráculo (valor vigente, depois da correção)", async (_name, sector) => {
    const { data, metrics, lines, shifts } = await controlsOracle(sector());
    expect(data.items.length).toBeGreaterThan(0);
    for (const metric of data.items) {
      const expected = metrics.find((entry) => entry.itemId === metric.itemId);
      if (!expected) throw new Error("oráculo sem o item");
      expect(metric.total, metric.name).toBe(expected.total);
      expect(metric.previousTotal, metric.name).toBe(expected.previousTotal);
      expect(metric.handoverCount, metric.name).toBe(expected.handoverCount);
      expect(metric.average, metric.name).toBe(expected.average);

      // Um segmento por turno: os ativos do setor do item + o inativo com linha.
      const wanted = shifts
        .filter(
          (shift) =>
            shift.sectorId === metric.sectorId &&
            (shift.active || expected.byShift[shift.id] !== undefined),
        )
        .map((shift) => shift.id)
        .sort();
      expect(metric.segments.map((seg) => seg.shiftId).sort()).toEqual(wanted);
      for (const segment of metric.segments) {
        const part = expected.byShift[segment.shiftId] ?? {
          total: 0,
          previousTotal: 0,
        };
        expect(segment.total, `${metric.name} ${segment.label}`).toBe(
          part.total,
        );
        expect(segment.previousTotal, `${metric.name} ${segment.label}`).toBe(
          part.previousTotal,
        );
        expect(segment.slot).toBe(
          oracleSlotOf(shifts, metric.sectorId, segment.shiftId),
        );
      }

      // A série: 2N dias contíguos, o dia e cada parte batem com as linhas cruas.
      expect(metric.series).toHaveLength(2 * 7);
      for (const [index, point] of metric.series.entries()) {
        const day = addDays(world.previous.from, index);
        expect(point.date).toBe(day);
        expect(point.total, `${metric.name} ${day}`).toBe(
          expected.byDay[day] ?? 0,
        );
        expect(point.parts).toEqual(
          metric.segments.map((segment) =>
            lines
              .filter(
                (line) =>
                  line.itemId === metric.itemId &&
                  line.shiftId === segment.shiftId &&
                  line.operationalDate === day,
              )
              .reduce((acc, line) => acc + line.quantity, 0),
          ),
        );
      }
    }
  });

  it("Controles: os literais da tabela do mundo (Rede 5 → 8 depois da correção vale 8)", async () => {
    const data = await getControlsData(db, ADMIN, queryOf(null));
    const by = (itemId: string) => {
      const found = data.items.find((metric) => metric.itemId === itemId);
      if (!found) throw new Error("item fora do resultado");
      return found;
    };
    expect(
      [world.items.net, world.items.strap, world.items.oldStrap].map((id) => [
        by(id).total,
        by(id).previousTotal,
        by(id).handoverCount,
        by(id).average,
      ]),
    ).toEqual([
      [35, 6, 10, 3.5],
      [36, 9, 10, 3.6],
      [3, 0, 2, 1.5],
    ]);
    expect(by(world.items.seal)).toMatchObject({
      total: 6,
      previousTotal: 5,
      handoverCount: 2,
      average: 3,
    });
    expect(by(world.items.uldSeal)).toMatchObject({
      total: 0,
      handoverCount: 0,
      average: null,
    });
    const net = by(world.items.net);
    expect(net.series.map((point) => point.total)).toEqual([
      0, 0, 0, 4, 0, 2, 0, 5, 5, 5, 8, 0, 3, 9,
    ]);
    expect(
      net.series.slice(7).reduce((acc, point) => acc + point.total, 0),
    ).toBe(35);
  });

  it("Controles (C-1): o total, a legenda e cada segmento são o total da lista que o link abre, depois da mesma validação da tela", async () => {
    const { data, lines } = await controlsOracle(null);
    const current = lines.filter(
      (line) => line.operationalDate >= world.period.from,
    );
    for (const metric of data.items) {
      const extras = { ...linkExtras(metric.sectorId), itemId: metric.itemId };
      const totalHref = passagesListHref(world.period, "delivered", extras);
      const filters = parseHistoryFilters(
        queryRecord(hrefQuery(totalHref)),
        world.today,
      );
      // A tela só mantém o item que está nas escolhas do setor (inclusive o
      // inativo escolhido pela URL, como a Cinta antiga).
      const choices = await listHistoryItems(
        db,
        metric.sectorId,
        filters.itemId,
      );
      expect(
        choices.map((choice) => choice.id),
        metric.name,
      ).toContain(metric.itemId);
      const list = await listHandoverHistory(
        db,
        ADMIN,
        { filters, sectorId: metric.sectorId, page: 1 },
        world.now,
      );
      expect(list.total, metric.name).toBe(metric.handoverCount);

      for (const segment of metric.segments) {
        const href = passagesListHref(world.period, "delivered", {
          ...extras,
          shiftId: segment.shiftId,
        });
        const segFilters = parseHistoryFilters(
          queryRecord(hrefQuery(href)),
          world.today,
        );
        const shiftChoices = await listHistoryShifts(
          db,
          metric.sectorId,
          segFilters.shiftId,
        );
        expect(shiftChoices.map((choice) => choice.id)).toContain(
          segment.shiftId,
        );
        const segList = await listHandoverHistory(
          db,
          ADMIN,
          { filters: segFilters, sectorId: metric.sectorId, page: 1 },
          world.now,
        );
        // As passagens do item naquele turno (uma linha por passagem).
        expect(segList.total, `${metric.name} ${segment.label}`).toBe(
          current.filter(
            (line) =>
              line.itemId === metric.itemId && line.shiftId === segment.shiftId,
          ).length,
        );
      }
    }
  });

  it.each(
    SCOPES,
  )("Estoque (%s): a última contagem e os pontos batem com o oráculo, na ordem cronológica", async (_name, sector) => {
    const sectorId = sector();
    const sectorIds = sectorIdsOf(sectorId);
    const data = await getStockData(db, ADMIN, queryOf(sectorId));
    const metrics = oracleStock({
      lines: await rawDeliveredItems(db, {
        sectorIds,
        range: { from: "2026-01-01", to: world.period.to },
        kind: "stock",
      }),
      handovers: await rawHandovers(db, sectorIds),
      shifts: await rawShifts(db, sectorIds),
      itemIds: data.items.map((metric) => metric.itemId),
      period: world.period,
    });
    const shifts = await rawShifts(db, sectorIds);
    expect(data.items.length).toBeGreaterThan(0);
    for (const metric of data.items) {
      const expected = metrics.find((entry) => entry.itemId === metric.itemId);
      if (!expected) throw new Error("oráculo sem o item");
      expect(metric.last?.quantity ?? null, metric.name).toBe(
        expected.last?.quantity ?? null,
      );
      expect(metric.last?.operationalDate ?? null, metric.name).toBe(
        expected.last?.operationalDate ?? null,
      );
      expect(metric.last?.handoverId ?? null, metric.name).toBe(
        expected.last?.handoverId ?? null,
      );
      expect(metric.last?.shiftName ?? null, metric.name).toBe(
        shifts.find((shift) => shift.id === expected.last?.shiftId)?.name ??
          null,
      );
      expect(metric.lastBeforePeriod, metric.name).toBe(
        expected.lastBeforePeriod,
      );
      expect(metric.points, metric.name).toEqual(expected.points);
    }
  });

  it("Estoque: os literais do mundo e o link da última contagem abre a passagem", async () => {
    const data = await getStockData(db, ADMIN, queryOf(world.uld.id));
    const stretch = data.items.find(
      (metric) => metric.itemId === world.items.stretch,
    );
    expect(stretch?.last).toMatchObject({
      quantity: 12,
      operationalDate: "2026-11-20",
      shiftName: "Tarde",
    });
    expect(stretch?.points.map((point) => point.quantity)).toEqual([
      9,
      7,
      6,
      5,
      null,
      3,
      12,
    ]);
    expect(lastCountHref(stretch?.last?.handoverId ?? "")).toBe(
      `/passagens/${world.handovers["20T"]}`,
    );
    const film = data.items.find(
      (metric) => metric.itemId === world.items.film,
    );
    expect(film?.last).toBeNull();
  });
});

describe("Solicitações", () => {
  const SCOPES: readonly [string, () => string | null][] = [
    ["ULD", () => world.uld.id],
    ["Câmara", () => world.camara.id],
    ["Todos os setores", () => null],
  ];

  it.each(
    SCOPES,
  )("(%s) abertas, paradas, entregues, destinos e itens batem com o oráculo sobre os eventos crus", async (_name, sector) => {
    const sectorId = sector();
    const sectorIds =
      sectorId === null ? [world.uld.id, world.camara.id] : [sectorId];
    const data = await getRequestsData(db, ADMIN, queryOf(sectorId), world.now);
    const oracle = oracleRequests({
      requests: await rawRequests(db, sectorIds),
      now: world.now,
      period: world.period,
    });

    expect(data.open).toBe(oracle.open);
    expect(data.stale).toBe(oracle.stale);
    expect(data.deliveredInPeriod).toBe(oracle.deliveredInPeriod);

    expect(data.totalDestinations).toBe(
      Object.keys(oracle.destinations).length,
    );
    expect(data.destinations.length).toBe(data.totalDestinations);
    for (const destination of data.destinations) {
      const expected = oracle.destinations[destination.key];
      expect(expected, destination.name).toBeDefined();
      expect(destination.deliveredCount, destination.name).toBe(
        expected?.deliveredCount,
      );
      expect(destination.averageSeconds, destination.name).toBeCloseTo(
        expected?.averageSeconds ?? Number.NaN,
        3,
      );
    }

    expect(data.totalItems).toBe(Object.keys(oracle.items).length);
    expect(data.items.length).toBe(data.totalItems);
    for (const row of data.items) {
      const expected = oracle.items[row.itemId];
      expect(expected, row.name).toBeDefined();
      expect(row.quantity, row.name).toBe(expected?.quantity);
      expect(row.requestCount, row.name).toBe(expected?.requestCount);
    }
  });

  it("os literais da tabela do mundo (a 1ª entrega decide: R3 reaberta uma vez, R4 cancelada depois, R5 antes do período)", async () => {
    const uld = await getRequestsData(
      db,
      ADMIN,
      queryOf(world.uld.id),
      world.now,
    );
    expect([uld.open, uld.stale, uld.deliveredInPeriod]).toEqual([3, 1, 5]);
    expect(
      uld.destinations.map((row) => [
        row.name,
        row.deliveredCount,
        row.averageSeconds,
      ]),
    ).toEqual([
      ["Doca 3", 3, 66_000],
      ["Doca Antiga", 1, 21_600],
      ["Outro", 1, 1_800],
    ]);
    expect(
      uld.items.map((row) => [
        row.name,
        row.quantity,
        row.requestCount,
        row.unit,
      ]),
    ).toEqual([
      ["Rede de proteção", 6, 2, "rede"],
      ["Stretch", 5, 2, "rolo"],
      ["Cinta", 2, 1, "peça"],
    ]);

    const camara = await getRequestsData(
      db,
      ADMIN,
      queryOf(world.camara.id),
      world.now,
    );
    expect([camara.open, camara.stale, camara.deliveredInPeriod]).toEqual([
      0, 0, 1,
    ]);
    expect(camara.destinations.map((row) => row.averageSeconds)).toEqual([
      2_100,
    ]);
    expect(camara.items.map((row) => [row.name, row.quantity])).toEqual([
      ["Lacre", 3],
    ]);

    const todos = await getRequestsData(db, ADMIN, queryOf(null), world.now);
    expect([todos.open, todos.stale, todos.deliveredInPeriod]).toEqual([
      3, 1, 6,
    ]);
    expect(todos.destinations[0]).toMatchObject({
      name: "Doca 3",
      deliveredCount: 4,
      averageSeconds: 50_025,
    });
  });
});

describe("CSV", () => {
  let csvClient: PGlite;
  let csvDb: TestDb;
  let csvWorld: DashboardWorld;

  beforeAll(async () => {
    ({ client: csvClient, db: csvDb } = await createTestDb());
    csvWorld = await seedDashboardWorld(csvDb);
  });
  afterAll(async () => {
    await csvClient.close();
  });

  function scopeOf(
    sector: { id: string; name: string } | null,
  ): DashboardScope {
    return {
      sectorId: sector?.id ?? null,
      sectorName: sector?.name ?? null,
      sectorParam: sector?.id ?? "todos",
      showSector: sector === null,
      period: csvWorld.period,
      previous: previousPeriod(csvWorld.period),
      days: periodDays(csvWorld.period),
      today: csvWorld.today,
    };
  }

  // O mundo não tem aspas nem quebra de linha: dividir por ";" e CRLF basta.
  async function exported(sector: { id: string; name: string } | null) {
    const csv = await buildPassagesCsv(
      csvDb,
      csvWorld.people.admin,
      scopeOf(sector),
      csvWorld.now,
    );
    if (!csv.ok) throw new Error("o CSV devia ter sido gerado");
    const [header = [], ...rows] = csv.body
      .slice(CSV_BOM.length, -2)
      .split("\r\n")
      .map((line) => line.split(";"));
    const itemColumns = header.slice(7, header.length - 3);
    return { csv, header, rows, itemColumns };
  }

  // O oráculo independente (leitores crus + JS), nunca as funções do dashboard.
  async function oracleOf(sectorIds: readonly string[]) {
    const passages = oraclePassages({
      shifts: await rawShifts(csvDb, sectorIds),
      handovers: await rawHandovers(csvDb, sectorIds),
      sectorIds,
      period: csvWorld.period,
      now: csvWorld.now,
    });
    const csv = oracleCsv({
      passages,
      controlLines: await rawDeliveredItems(csvDb, {
        sectorIds,
        range: csvWorld.period,
        kind: "control",
      }),
      stockLines: await rawDeliveredItems(csvDb, {
        sectorIds,
        range: csvWorld.period,
        kind: "stock",
      }),
    });
    return { passages, csv };
  }

  // Rótulo da coluna ("Rede de proteção (rede)", com ou sem "Setor · ") → id.
  function itemIdOf(label: string): string {
    const ids: Record<string, string> = {
      "Rede de proteção (rede)": csvWorld.items.net,
      "Cinta (peça)": csvWorld.items.strap,
      "Cinta antiga (peça)": csvWorld.items.oldStrap,
      "Stretch (rolo)": csvWorld.items.stretch,
      "Lacre (unidade)": csvWorld.items.seal,
    };
    const id = ids[label.split(" · ").pop() ?? label];
    if (id === undefined) throw new Error(`coluna desconhecida: ${label}`);
    return id;
  }

  function columnSum(rows: string[][], column: number): number {
    return rows.reduce((sum, row) => sum + Number(row[column] || 0), 0);
  }

  function countOf(rows: string[][], label: string): number {
    return rows.filter((row) => row[5] === label).length;
  }

  // As colunas de item são as do oráculo (uma por item com linha entregue no
  // período) e a soma de cada controle é a do oráculo, nunca a de getControlsData.
  function expectColumnsOfOracle(
    itemColumns: string[],
    rows: string[][],
    oracle: Awaited<ReturnType<typeof oracleOf>>["csv"],
  ) {
    const ids = itemColumns.map(itemIdOf);
    expect([...ids].sort()).toEqual(
      [...oracle.controlItemIds, ...oracle.stockItemIds].sort(),
    );
    for (const [index, id] of ids.entries()) {
      const expected = oracle.controlSums[id];
      if (expected !== undefined) {
        expect(columnSum(rows, 7 + index), itemColumns[index]).toBe(expected);
      }
    }
  }

  it("ULD: 21 linhas, as colunas e as somas dos controles iguais às do oráculo e aos literais", async () => {
    const { csv, rows, itemColumns } = await exported(csvWorld.uld);
    const { csv: oracle } = await oracleOf([csvWorld.uld.id]);
    expect(rows).toHaveLength(21);
    expect(csv.rows).toBe(21);
    expect(rows).toHaveLength(oracle.rows);
    expect(itemColumns).toEqual([
      "Rede de proteção (rede)",
      "Cinta (peça)",
      "Cinta antiga (peça)",
      "Stretch (rolo)",
    ]);
    expectColumnsOfOracle(itemColumns, rows, oracle);
    // Rede 35 (já com a correção 5 → 8), Cinta 36, Cinta antiga 3.
    expect([0, 1, 2].map((index) => columnSum(rows, 7 + index))).toEqual([
      35, 36, 3,
    ]);
  });

  it("ULD: a contagem de cada situação do CSV é a do oráculo e a dos literais", async () => {
    const { rows } = await exported(csvWorld.uld);
    const { passages } = await oracleOf([csvWorld.uld.id]);
    expect(countOf(rows, "Confirmada")).toBe(passages.confirmed);
    expect(countOf(rows, "Aguardando recebimento")).toBe(passages.awaiting);
    expect(countOf(rows, "Não confirmada")).toBe(passages.unconfirmed);
    expect(countOf(rows, "Sem passagem")).toBe(passages.missing);
    expect(rows).toHaveLength(passages.listed);
    expect([
      countOf(rows, "Confirmada"),
      countOf(rows, "Aguardando recebimento"),
      countOf(rows, "Não confirmada"),
      countOf(rows, "Sem passagem"),
    ]).toEqual([7, 1, 2, 11]);
    // Uma correção (Rede 5 → 8): uma linha "Sim".
    expect(rows.filter((row) => row[6] === "Sim")).toHaveLength(1);
  });

  it("Câmara: 6 linhas e a coluna do Lacre soma 6", async () => {
    const { rows, itemColumns } = await exported(csvWorld.camara);
    const { csv: oracle } = await oracleOf([csvWorld.camara.id]);
    expect(rows).toHaveLength(6);
    expect(rows).toHaveLength(oracle.rows);
    expect(itemColumns).toEqual(["Lacre (unidade)"]);
    expectColumnsOfOracle(itemColumns, rows, oracle);
    expect(columnSum(rows, 7)).toBe(6);
    expect(countOf(rows, "Sem passagem")).toBe(4);
  });

  it("Todos os setores: 27 linhas, colunas com o setor e as situações do oráculo", async () => {
    const { rows, itemColumns } = await exported(null);
    const { passages, csv: oracle } = await oracleOf([
      csvWorld.uld.id,
      csvWorld.camara.id,
    ]);
    expect(rows).toHaveLength(27);
    expect(rows).toHaveLength(oracle.rows);
    expect(itemColumns).toEqual([
      "Câmara Teste · Lacre (unidade)",
      "ULD Teste · Rede de proteção (rede)",
      "ULD Teste · Cinta (peça)",
      "ULD Teste · Cinta antiga (peça)",
      "ULD Teste · Stretch (rolo)",
    ]);
    expectColumnsOfOracle(itemColumns, rows, oracle);
    expect(countOf(rows, "Confirmada")).toBe(passages.confirmed);
    expect(countOf(rows, "Aguardando recebimento")).toBe(passages.awaiting);
    expect(countOf(rows, "Não confirmada")).toBe(passages.unconfirmed);
    expect(countOf(rows, "Sem passagem")).toBe(passages.missing);
    expect([
      countOf(rows, "Confirmada"),
      countOf(rows, "Aguardando recebimento"),
      countOf(rows, "Não confirmada"),
      countOf(rows, "Sem passagem"),
    ]).toEqual([8, 2, 2, 15]);
    expect([0, 1, 2, 3].map((index) => columnSum(rows, 7 + index))).toEqual([
      6, 35, 36, 3,
    ]);
  });
});
