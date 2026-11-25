import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { item } from "@/db/schema/catalog";
import { addDays } from "@/features/handovers/saoPaulo";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import {
  type DashboardWorld,
  seedDashboardWorld,
} from "../../../test/dashboardWorld";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  deactivateSector,
  insertHandover,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { getControlsData } from "./controls";
import type { ControlItemMetric, DashboardQuery } from "./types";

const ADMIN = authzOf({ role: "admin" });
const OLD = new Date("2026-01-01T12:00:00.000Z");

describe("getControlsData sobre o mundo do critério de pronto", () => {
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

  const queryOf = (sectorId: string | null): DashboardQuery => ({
    sectorId,
    period: { from: world.period.from, to: world.period.to },
    previous: world.previous,
  });
  const metricOf = (items: ControlItemMetric[], itemId: string) => {
    const found = items.find((metric) => metric.itemId === itemId);
    if (!found) throw new Error("item fora do resultado");
    return found;
  };

  it("ULD: os itens, na ordem do cadastro, com total, anterior, passagens e média", async () => {
    const data = await getControlsData(db, ADMIN, queryOf(world.uld.id));
    expect(data.totalItems).toBe(4);
    expect(
      data.items.map((metric) => [
        metric.name,
        metric.unit,
        metric.total,
        metric.previousTotal,
        metric.handoverCount,
        metric.average,
      ]),
    ).toEqual([
      ["Rede de proteção", "rede", 35, 6, 10, 3.5],
      ["Cinta", "peça", 36, 9, 10, 3.6],
      ["Cinta antiga", "peça", 3, 0, 2, 1.5],
      ["Lacre ULD", "unidade", 0, 0, 0, null],
    ]);
    expect(data.items.every((m) => m.sectorName === "ULD Teste")).toBe(true);
  });

  it("segmentos: um por turno (ativos + o inativo com linha), com slot, total e anterior", async () => {
    const data = await getControlsData(db, ADMIN, queryOf(world.uld.id));
    const s = world.shifts;
    const shape = (itemId: string) =>
      metricOf(data.items, itemId).segments.map((seg) => [
        seg.shiftId,
        seg.label,
        seg.slot,
        seg.total,
        seg.previousTotal,
      ]);
    expect(shape(world.items.net)).toEqual([
      [s.morning, "Manhã", 1, 20, 4],
      [s.afternoon, "Tarde", 2, 13, 0],
      [s.night, "Noite", 3, 1, 2],
      [s.retired, "Turno Antigo", 4, 1, 0],
    ]);
    expect(shape(world.items.strap)).toEqual([
      [s.morning, "Manhã", 1, 21, 6],
      [s.afternoon, "Tarde", 2, 10, 0],
      [s.night, "Noite", 3, 3, 3],
      [s.retired, "Turno Antigo", 4, 2, 0],
    ]);
    expect(shape(world.items.oldStrap)).toEqual([
      [s.morning, "Manhã", 1, 2, 0],
      [s.afternoon, "Tarde", 2, 0, 0],
      [s.night, "Noite", 3, 0, 0],
      [s.retired, "Turno Antigo", 4, 1, 0],
    ]);
    // Lacre ULD nunca teve linha: o Turno Antigo (inativo) não vira segmento.
    expect(shape(world.items.uldSeal)).toEqual([
      [s.morning, "Manhã", 1, 0, 0],
      [s.afternoon, "Tarde", 2, 0, 0],
      [s.night, "Noite", 3, 0, 0],
    ]);
    // Nenhum agregado: Σ dos segmentos = total e Σ dos anteriores = anterior.
    for (const metric of data.items) {
      const sum = (pick: (seg: (typeof metric.segments)[number]) => number) =>
        metric.segments.reduce((acc, seg) => acc + pick(seg), 0);
      expect(
        sum((seg) => seg.total),
        metric.name,
      ).toBe(metric.total);
      expect(
        sum((seg) => seg.previousTotal),
        metric.name,
      ).toBe(metric.previousTotal);
    }
  });

  it("série: 2N dias contíguos, zeros do SQL, total do dia = soma das partes, Σ dos N últimos = total", async () => {
    const data = await getControlsData(db, ADMIN, queryOf(world.uld.id));
    const net = metricOf(data.items, world.items.net);
    expect(net.series).toHaveLength(14);
    expect(net.series.map((point) => point.date)).toEqual(
      Array.from({ length: 14 }, (_, index) =>
        addDays(world.previous.from, index),
      ),
    );
    expect(net.series.map((point) => point.total)).toEqual([
      0, 0, 0, 4, 0, 2, 0, 5, 5, 5, 8, 0, 3, 9,
    ]);
    for (const point of net.series) {
      expect(point.parts).toHaveLength(net.segments.length);
      expect(point.parts.reduce((acc, part) => acc + part, 0)).toBe(
        point.total,
      );
    }
    // 17/11 (a Tarde corrigida de 5 para 8): Tarde = 8, o resto 0.
    expect(net.series[10]?.parts).toEqual([0, 8, 0, 0]);
    expect(
      net.series.slice(7).reduce((acc, point) => acc + point.total, 0),
    ).toBe(net.total);
  });

  it("Câmara: Lacre com um segmento (Dia) e a variação do anterior", async () => {
    const data = await getControlsData(db, ADMIN, queryOf(world.camara.id));
    expect(data.totalItems).toBe(1);
    const seal = metricOf(data.items, world.items.seal);
    expect(seal).toMatchObject({
      name: "Lacre",
      total: 6,
      previousTotal: 5,
      handoverCount: 2,
      average: 3,
      sectorName: "Câmara Teste",
    });
    expect(seal.segments).toEqual([
      {
        key: world.shifts.camaraDay,
        shiftId: world.shifts.camaraDay,
        label: "Dia",
        slot: 1,
        total: 6,
        previousTotal: 5,
      },
    ]);
  });

  it("'Todos os setores': Câmara primeiro, os 5 itens, sem o Setor Parado", async () => {
    const data = await getControlsData(db, ADMIN, queryOf(null));
    expect(data.totalItems).toBe(5);
    expect(data.items.map((metric) => metric.name)).toEqual([
      "Lacre",
      "Rede de proteção",
      "Cinta",
      "Cinta antiga",
      "Lacre ULD",
    ]);
    expect(data.items.map((metric) => metric.sectorName)).toEqual([
      "Câmara Teste",
      "ULD Teste",
      "ULD Teste",
      "ULD Teste",
      "ULD Teste",
    ]);
  });

  it("item ativo sem passagem (Lacre ULD) aparece vazio; item inativo com linha (Cinta antiga) também", async () => {
    const data = await getControlsData(db, ADMIN, queryOf(world.uld.id));
    expect(metricOf(data.items, world.items.uldSeal)).toMatchObject({
      total: 0,
      handoverCount: 0,
      average: null,
    });
    expect(metricOf(data.items, world.items.oldStrap).handoverCount).toBe(2);
  });

  it("período de 1 dia: série de 2 pontos (anterior e atual)", async () => {
    const data = await getControlsData(db, ADMIN, {
      sectorId: world.uld.id,
      period: { from: "2026-11-17", to: "2026-11-17" },
      previous: { from: "2026-11-16", to: "2026-11-16" },
    });
    const net = metricOf(data.items, world.items.net);
    // O Turno Antigo (inativo) não tem linha de 16 e 17/11: não vira segmento.
    expect(net.total).toBe(8);
    expect(net.previousTotal).toBe(5);
    expect(net.series).toEqual([
      { date: "2026-11-16", total: 5, parts: [5, 0, 0] },
      { date: "2026-11-17", total: 8, parts: [0, 8, 0] },
    ]);
  });

  it("período anterior vazio: anterior 0 e o resto igual", async () => {
    const data = await getControlsData(db, ADMIN, {
      sectorId: world.uld.id,
      period: { from: "2026-11-14", to: "2026-11-20" },
      previous: { from: "2026-10-01", to: "2026-10-07" },
    });
    const net = metricOf(data.items, world.items.net);
    expect(net.total).toBe(35);
    expect(net.previousTotal).toBe(0);
    expect(net.segments.every((seg) => seg.previousTotal === 0)).toBe(true);
  });

  it("operador com sectorId de outro setor no input: vê o próprio setor", async () => {
    const data = await getControlsData(
      db,
      world.people.cris,
      queryOf(world.uld.id),
    );
    expect(data.items.map((metric) => metric.name)).toEqual(["Lacre"]);
  });

  it("operador de setor inativo e operador sem setor: vazio", async () => {
    const empty = { items: [], totalItems: 0 };
    expect(
      await getControlsData(db, world.people.duda, queryOf(world.inactive.id)),
    ).toEqual(empty);
    expect(
      await getControlsData(db, ADMIN, queryOf(world.inactive.id)),
    ).toEqual(empty);
    expect(
      await getControlsData(
        db,
        { ...world.people.ana, sectorId: null },
        queryOf(world.uld.id),
      ),
    ).toEqual(empty);
  });

  it("no máximo três consultas, nunca uma por item", async () => {
    const logged: string[] = [];
    const logging = drizzle(client, {
      schema,
      logger: { logQuery: (text) => void logged.push(text) },
    });
    await getControlsData(logging, ADMIN, queryOf(null));
    expect(logged.length).toBeLessThanOrEqual(3);
    expect(logged.length).toBeGreaterThan(0);
  });
});

describe("getControlsData em cenários próprios", () => {
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

  async function deliver(input: {
    sectorId: string;
    shiftId: string;
    by: string;
    date: string;
    lines: readonly (readonly [string, number])[];
  }) {
    const created = await insertHandover(db, {
      sectorId: input.sectorId,
      shiftId: input.shiftId,
      operationalDate: input.date,
      status: "delivered",
      deliveredBy: input.by,
      deliveredAt: spDate(input.date, "23:00"),
    });
    for (const [itemId, quantity] of input.lines) {
      await insertHandoverItem(db, {
        handoverId: created.id,
        itemId,
        quantity,
        snapshot: true,
      });
    }
    return created.id;
  }

  async function base() {
    const sector = await insertSector(db, "Setor Teste");
    const ana = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      name: "Ana Teste",
    });
    const net = await insertItem(db, {
      sectorId: sector.id,
      name: "Rede de proteção",
      unit: "rede",
      sortOrder: 1,
    });
    return { sector, ana, net };
  }

  it("2 turnos inativos com sort_order menor: os 3 ativos ficam nos slots 1 a 3, os inativos com linha depois", async () => {
    const { sector, ana, net } = await base();
    const make = (name: string, sortOrder: number, active: boolean) =>
      insertShift(db, {
        sectorId: sector.id,
        name,
        sortOrder,
        active,
        createdAt: OLD,
      });
    const retiredA = await make("Antigo A", 1, false);
    const retiredB = await make("Antigo B", 2, false);
    await make("Manhã", 5, true);
    await make("Tarde", 6, true);
    await make("Noite", 7, true);
    await deliver({
      sectorId: sector.id,
      shiftId: retiredA.id,
      by: ana.id,
      date: "2026-11-15",
      lines: [[net.id, 4]],
    });
    const data = await getControlsData(db, ADMIN, query(sector.id));
    expect(
      data.items[0]?.segments.map((seg) => [seg.label, seg.slot, seg.total]),
    ).toEqual([
      ["Manhã", 1, 0],
      ["Tarde", 2, 0],
      ["Noite", 3, 0],
      ["Antigo A", 4, 4],
    ]);
    // O Antigo B (slot 5) sem linha não vira segmento.
    expect(data.items[0]?.segments.map((seg) => seg.shiftId)).not.toContain(
      retiredB.id,
    );
  });

  it("5º turno ativo: slot null, com a própria linha, total e shiftId (nunca agregado)", async () => {
    const { sector, ana, net } = await base();
    const shifts = [];
    for (const [index, name] of [
      "Turno 1",
      "Turno 2",
      "Turno 3",
      "Turno 4",
      "Turno 5",
    ].entries()) {
      shifts.push(
        await insertShift(db, {
          sectorId: sector.id,
          name,
          sortOrder: index + 1,
          createdAt: OLD,
        }),
      );
    }
    for (const [index, turn] of shifts.entries()) {
      await deliver({
        sectorId: sector.id,
        shiftId: turn.id,
        by: ana.id,
        date: "2026-11-16",
        lines: [[net.id, index + 1]],
      });
    }
    const data = await getControlsData(db, ADMIN, query(sector.id));
    const segments = data.items[0]?.segments ?? [];
    expect(segments.map((seg) => seg.slot)).toEqual([1, 2, 3, 4, null]);
    expect(segments[4]).toMatchObject({
      label: "Turno 5",
      shiftId: shifts[4]?.id,
      total: 5,
    });
    expect(segments.reduce((acc, seg) => acc + seg.total, 0)).toBe(15);
  });

  it("teto de 30 cartões: totalItems conta todos, a ordem é a do cadastro", async () => {
    const { sector } = await base();
    for (let n = 2; n <= 31; n += 1) {
      await insertItem(db, {
        sectorId: sector.id,
        name: `Item ${String(n).padStart(2, "0")}`,
        sortOrder: n,
      });
    }
    const data = await getControlsData(db, ADMIN, query(sector.id));
    expect(data.items).toHaveLength(30);
    expect(data.totalItems).toBe(31);
    expect(data.items[0]?.name).toBe("Rede de proteção");
    expect(data.items[29]?.name).toBe("Item 30");
  });

  it("soma no teto de quantidade (99.999 × linhas) sem estourar", async () => {
    const { sector, ana, net } = await base();
    const turn = await insertShift(db, {
      sectorId: sector.id,
      name: "Manhã",
      createdAt: OLD,
    });
    for (const date of ["2026-11-15", "2026-11-16", "2026-11-17"]) {
      await deliver({
        sectorId: sector.id,
        shiftId: turn.id,
        by: ana.id,
        date,
        lines: [[net.id, 99_999]],
      });
    }
    const [metric] = (await getControlsData(db, ADMIN, query(sector.id))).items;
    expect(metric).toMatchObject({ total: 299_997, average: 99_999 });
    expect(metric?.series.map((point) => point.total)).toContain(99_999);
  });

  it("nome e unidade vêm do snapshot mais recente da janela; renomear o item depois não muda", async () => {
    const { sector, ana, net } = await base();
    const turn = await insertShift(db, {
      sectorId: sector.id,
      name: "Manhã",
      createdAt: OLD,
    });
    await deliver({
      sectorId: sector.id,
      shiftId: turn.id,
      by: ana.id,
      date: "2026-11-15",
      lines: [[net.id, 2]],
    });
    await db
      .update(item)
      .set({ name: "Rede nova", unit: "peça" })
      .where(eq(item.id, net.id));
    await deliver({
      sectorId: sector.id,
      shiftId: turn.id,
      by: ana.id,
      date: "2026-11-16",
      lines: [[net.id, 3]],
    });
    await db
      .update(item)
      .set({ name: "Nome depois de tudo", unit: "caixa" })
      .where(eq(item.id, net.id));
    const [metric] = (await getControlsData(db, ADMIN, query(sector.id))).items;
    // Uma linha só (agrupa por item_id), com o snapshot da entrega mais recente.
    expect(metric).toMatchObject({
      name: "Rede nova",
      unit: "peça",
      total: 5,
    });
  });

  it("sem nenhuma passagem, o item mostra o nome do cadastro", async () => {
    const { sector } = await base();
    const data = await getControlsData(db, ADMIN, query(sector.id));
    expect(data.items[0]).toMatchObject({
      name: "Rede de proteção",
      unit: "rede",
      total: 0,
      handoverCount: 0,
      average: null,
    });
  });

  it("setor sem turnos: o item aparece, sem segmentos e sem série", async () => {
    const { sector } = await base();
    const [metric] = (await getControlsData(db, ADMIN, query(sector.id))).items;
    expect(metric?.segments).toEqual([]);
    expect(metric?.series).toEqual([]);
  });

  it("item de estoque nunca entra em Controles; setor desativado depois some", async () => {
    const { sector } = await base();
    await insertItem(db, {
      sectorId: sector.id,
      name: "Stretch",
      unit: "rolo",
      kind: "stock",
      sortOrder: 2,
    });
    const before = await getControlsData(db, ADMIN, query(sector.id));
    expect(before.items.map((metric) => metric.name)).toEqual([
      "Rede de proteção",
    ]);
    await deactivateSector(db, sector.id);
    expect(await getControlsData(db, ADMIN, query(sector.id))).toEqual({
      items: [],
      totalItems: 0,
    });
  });
});
