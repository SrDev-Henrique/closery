import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { item } from "@/db/schema/catalog";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import {
  type DashboardWorld,
  seedDashboardWorld,
} from "../../../test/dashboardWorld";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { getStockData } from "./stock";
import type { DashboardQuery, StockItemMetric } from "./types";

const ADMIN = authzOf({ role: "admin" });
const OLD = new Date("2026-01-01T12:00:00.000Z");

describe("getStockData sobre o mundo do critério de pronto", () => {
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

  const queryOf = (
    sectorId: string | null,
    period = { from: world.period.from, to: world.period.to },
  ): DashboardQuery => ({
    sectorId,
    period,
    previous: world.previous,
  });
  const metricOf = (items: StockItemMetric[], itemId: string) => {
    const found = items.find((metric) => metric.itemId === itemId);
    if (!found) throw new Error("item fora do resultado");
    return found;
  };
  const quantities = (metric: StockItemMetric) =>
    metric.points.map((point) => point.quantity);

  it("ULD: Stretch com a última contagem (20T) e os pontos do período", async () => {
    const data = await getStockData(db, ADMIN, queryOf(world.uld.id));
    expect(data.totalItems).toBe(2);
    expect(data.items.map((metric) => metric.name)).toEqual([
      "Stretch",
      "Filme",
    ]);
    const stretch = metricOf(data.items, world.items.stretch);
    expect(stretch.last).toEqual({
      quantity: 12,
      unit: "rolo",
      operationalDate: "2026-11-20",
      shiftName: "Tarde",
      handoverId: world.handovers["20T"],
    });
    expect(stretch.lastBeforePeriod).toBe(false);
    expect(stretch.points.map((point) => point.date)).toEqual([
      "2026-11-14",
      "2026-11-15",
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
    ]);
    // 15/11: o Turno Antigo (termina 18:00) vence a Manhã; 19/11: a Noite
    // (termina em 20/11) vence a Manhã entregue depois.
    expect(quantities(stretch)).toEqual([9, 7, 6, 5, null, 3, 12]);
  });

  it("item nunca contado (Filme): Sem contagem e todos os pontos null", async () => {
    const data = await getStockData(db, ADMIN, queryOf(world.uld.id));
    const film = metricOf(data.items, world.items.film);
    expect(film.last).toBeNull();
    expect(film.lastBeforePeriod).toBe(false);
    expect(film.points).toHaveLength(7);
    expect(quantities(film).every((value) => value === null)).toBe(true);
  });

  it("contagem anterior ao período: Caixa térmica (10/11) com lastBeforePeriod", async () => {
    const data = await getStockData(db, ADMIN, queryOf(world.camara.id));
    const box = metricOf(data.items, world.items.thermalBox);
    expect(box.last).toEqual({
      quantity: 4,
      unit: "caixa",
      operationalDate: "2026-11-10",
      shiftName: "Dia",
      handoverId: world.handovers.C10D,
    });
    expect(box.lastBeforePeriod).toBe(true);
    expect(quantities(box).every((value) => value === null)).toBe(true);
  });

  it("a Manhã de 19/11 entregue atrasada não vence a Noite: com o período até 19/11 a última é 3", async () => {
    const data = await getStockData(
      db,
      ADMIN,
      queryOf(world.uld.id, { from: "2026-11-14", to: "2026-11-19" }),
    );
    const stretch = metricOf(data.items, world.items.stretch);
    expect(stretch.last).toMatchObject({
      quantity: 3,
      operationalDate: "2026-11-19",
      shiftName: "Noite",
      handoverId: world.handovers["19N"],
    });
    expect(quantities(stretch)).toEqual([9, 7, 6, 5, null, 3]);
  });

  it("'Todos os setores': Câmara primeiro e o Setor Parado de fora", async () => {
    const data = await getStockData(db, ADMIN, queryOf(null));
    expect(data.totalItems).toBe(3);
    expect(data.items.map((metric) => metric.name)).toEqual([
      "Caixa térmica",
      "Stretch",
      "Filme",
    ]);
    expect(data.items.map((metric) => metric.sectorName)).toEqual([
      "Câmara Teste",
      "ULD Teste",
      "ULD Teste",
    ]);
  });

  it("período de 1 dia: um ponto", async () => {
    const data = await getStockData(
      db,
      ADMIN,
      queryOf(world.uld.id, { from: "2026-11-17", to: "2026-11-17" }),
    );
    expect(quantities(metricOf(data.items, world.items.stretch))).toEqual([5]);
  });

  it("item de controle nunca entra em Estoque", async () => {
    const data = await getStockData(db, ADMIN, queryOf(world.uld.id));
    expect(data.items.map((metric) => metric.itemId)).not.toContain(
      world.items.net,
    );
  });

  it("operador com sectorId de outro setor no input: vê o próprio setor", async () => {
    const data = await getStockData(
      db,
      world.people.cris,
      queryOf(world.uld.id),
    );
    expect(data.items.map((metric) => metric.name)).toEqual(["Caixa térmica"]);
  });

  it("operador de setor inativo, admin no setor inativo e operador sem setor: vazio", async () => {
    const empty = { items: [], totalItems: 0 };
    expect(
      await getStockData(db, world.people.duda, queryOf(world.inactive.id)),
    ).toEqual(empty);
    expect(await getStockData(db, ADMIN, queryOf(world.inactive.id))).toEqual(
      empty,
    );
    expect(
      await getStockData(
        db,
        { ...world.people.ana, sectorId: null },
        queryOf(world.uld.id),
      ),
    ).toEqual(empty);
  });

  it("duas consultas no máximo, nunca uma por item", async () => {
    const logged: string[] = [];
    const logging = drizzle(client, {
      schema,
      logger: { logQuery: (text) => void logged.push(text) },
    });
    await getStockData(logging, ADMIN, queryOf(null));
    expect(logged).toHaveLength(2);
  });
});

describe("getStockData em cenários próprios", () => {
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

  const query = (sectorId: string): DashboardQuery => ({
    sectorId,
    period: { from: "2026-11-14", to: "2026-11-20" },
    previous: { from: "2026-11-07", to: "2026-11-13" },
  });

  async function base() {
    const sector = await insertSector(db, "Setor Teste");
    const ana = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      name: "Ana Teste",
    });
    const stretch = await insertItem(db, {
      sectorId: sector.id,
      name: "Stretch",
      unit: "rolo",
      kind: "stock",
      sortOrder: 1,
    });
    return { sector, ana, stretch };
  }

  async function count(input: {
    sectorId: string;
    shiftId: string;
    by: string;
    date: string;
    deliveredAt: Date;
    itemId: string;
    quantity: number;
  }) {
    const created = await insertHandover(db, {
      sectorId: input.sectorId,
      shiftId: input.shiftId,
      operationalDate: input.date,
      status: "delivered",
      deliveredBy: input.by,
      deliveredAt: input.deliveredAt,
    });
    await insertHandoverItem(db, {
      handoverId: created.id,
      itemId: input.itemId,
      quantity: input.quantity,
      snapshot: true,
    });
    return created.id;
  }

  it("fim do turno igual no mesmo dia: vence a entrega mais recente", async () => {
    const { sector, ana, stretch } = await base();
    const first = await insertShift(db, {
      sectorId: sector.id,
      name: "Manhã A",
      startsAt: "06:00",
      endsAt: "14:00",
      createdAt: OLD,
    });
    const second = await insertShift(db, {
      sectorId: sector.id,
      name: "Manhã B",
      startsAt: "07:00",
      endsAt: "14:00",
      createdAt: OLD,
    });
    const common = {
      sectorId: sector.id,
      by: ana.id,
      date: "2026-11-18",
      itemId: stretch.id,
    };
    await count({
      ...common,
      shiftId: first.id,
      deliveredAt: spDate("2026-11-18", "14:30"),
      quantity: 7,
    });
    await count({
      ...common,
      shiftId: second.id,
      deliveredAt: spDate("2026-11-18", "14:10"),
      quantity: 9,
    });
    const [metric] = (await getStockData(db, ADMIN, query(sector.id))).items;
    expect(metric?.last?.quantity).toBe(7);
    expect(metric?.points.find((p) => p.date === "2026-11-18")?.quantity).toBe(
      7,
    );
  });

  it("entrega no mesmo instante: vence o maior id da passagem", async () => {
    const { sector, ana, stretch } = await base();
    const first = await insertShift(db, {
      sectorId: sector.id,
      name: "Manhã A",
      startsAt: "06:00",
      endsAt: "14:00",
      createdAt: OLD,
    });
    const second = await insertShift(db, {
      sectorId: sector.id,
      name: "Manhã B",
      startsAt: "07:00",
      endsAt: "14:00",
      createdAt: OLD,
    });
    const at = spDate("2026-11-18", "14:30");
    const common = {
      sectorId: sector.id,
      by: ana.id,
      date: "2026-11-18",
      itemId: stretch.id,
      deliveredAt: at,
    };
    const idA = await count({ ...common, shiftId: first.id, quantity: 7 });
    const idB = await count({ ...common, shiftId: second.id, quantity: 9 });
    const [metric] = (await getStockData(db, ADMIN, query(sector.id))).items;
    expect(metric?.last?.handoverId).toBe(idA > idB ? idA : idB);
  });

  it("item inativo com contagem no período aparece; só com contagem antes do período, não", async () => {
    const { sector, ana, stretch } = await base();
    const old = await insertItem(db, {
      sectorId: sector.id,
      name: "Filme antigo",
      unit: "rolo",
      kind: "stock",
      sortOrder: 2,
      active: false,
    });
    const gone = await insertItem(db, {
      sectorId: sector.id,
      name: "Fita antiga",
      unit: "rolo",
      kind: "stock",
      sortOrder: 3,
      active: false,
    });
    const turn = await insertShift(db, {
      sectorId: sector.id,
      name: "Manhã",
      createdAt: OLD,
    });
    await count({
      sectorId: sector.id,
      shiftId: turn.id,
      by: ana.id,
      date: "2026-11-16",
      deliveredAt: spDate("2026-11-16", "14:30"),
      itemId: old.id,
      quantity: 3,
    });
    await count({
      sectorId: sector.id,
      shiftId: turn.id,
      by: ana.id,
      date: "2026-11-09",
      deliveredAt: spDate("2026-11-09", "14:30"),
      itemId: gone.id,
      quantity: 8,
    });
    const data = await getStockData(db, ADMIN, query(sector.id));
    expect(data.items.map((metric) => metric.name)).toEqual([
      "Stretch",
      "Filme antigo",
    ]);
    expect(data.totalItems).toBe(2);
    expect(data.items[0]?.itemId).toBe(stretch.id);
  });

  it("nome e unidade vêm da última contagem; renomear o item depois não muda", async () => {
    const { sector, ana, stretch } = await base();
    const turn = await insertShift(db, {
      sectorId: sector.id,
      name: "Manhã",
      createdAt: OLD,
    });
    await count({
      sectorId: sector.id,
      shiftId: turn.id,
      by: ana.id,
      date: "2026-11-16",
      deliveredAt: spDate("2026-11-16", "14:30"),
      itemId: stretch.id,
      quantity: 3,
    });
    await db
      .update(item)
      .set({ name: "Depois de tudo", unit: "caixa" })
      .where(eq(item.id, stretch.id));
    const [metric] = (await getStockData(db, ADMIN, query(sector.id))).items;
    expect(metric).toMatchObject({ name: "Stretch", unit: "rolo" });
    expect(metric?.last?.unit).toBe("rolo");
  });

  it("teto de 30 cartões: totalItems conta todos", async () => {
    const { sector } = await base();
    for (let n = 2; n <= 31; n += 1) {
      await insertItem(db, {
        sectorId: sector.id,
        name: `Item ${String(n).padStart(2, "0")}`,
        kind: "stock",
        sortOrder: n,
      });
    }
    const data = await getStockData(db, ADMIN, query(sector.id));
    expect(data.items).toHaveLength(30);
    expect(data.totalItems).toBe(31);
    expect(data.items.every((metric) => metric.points.length === 7)).toBe(true);
  });

  it("contagem de zero é uma contagem (0 ≠ sem contagem)", async () => {
    const { sector, ana, stretch } = await base();
    const turn = await insertShift(db, {
      sectorId: sector.id,
      name: "Manhã",
      createdAt: OLD,
    });
    await count({
      sectorId: sector.id,
      shiftId: turn.id,
      by: ana.id,
      date: "2026-11-16",
      deliveredAt: spDate("2026-11-16", "14:30"),
      itemId: stretch.id,
      quantity: 0,
    });
    const [metric] = (await getStockData(db, ADMIN, query(sector.id))).items;
    expect(metric?.last?.quantity).toBe(0);
    expect(metric?.points.find((p) => p.date === "2026-11-16")?.quantity).toBe(
      0,
    );
    expect(metric?.points.find((p) => p.date === "2026-11-17")?.quantity).toBe(
      null,
    );
  });
});
