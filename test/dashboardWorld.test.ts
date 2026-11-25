import type { PGlite } from "@electric-sql/pglite";
import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { destination, item, shift } from "@/db/schema/catalog";
import { handoverCorrection, handoverItem } from "@/db/schema/handovers";
import { requestStatusEvent } from "@/db/schema/requests";
import { sector } from "@/db/schema/sectors";
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
} from "./dashboardWorld";
import { createTestDb, type TestDb } from "./db";

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

describe("o mundo do critério de pronto tem o que a tabela diz", () => {
  it("relógio, período e setores", () => {
    expect(world.now.toISOString()).toBe("2026-11-20T18:00:00.000Z");
    expect(world.today).toBe("2026-11-20");
    expect(world.period).toEqual({
      period: "7",
      from: "2026-11-14",
      to: "2026-11-20",
    });
    expect(world.previous).toEqual({ from: "2026-11-07", to: "2026-11-13" });
    expect([world.uld.name, world.camara.name, world.inactive.name]).toEqual([
      "ULD Teste",
      "Câmara Teste",
      "Setor Parado",
    ]);
  });

  it("o Setor Parado é o único setor inativo", async () => {
    const rows = await db
      .select({ name: sector.name, active: sector.active })
      .from(sector);
    expect(rows.filter((row) => !row.active).map((row) => row.name)).toEqual([
      "Setor Parado",
    ]);
    expect(rows).toHaveLength(3);
  });

  it("turnos: 6, só o Turno Antigo inativo", async () => {
    const rows = await rawShifts(db, [
      world.uld.id,
      world.camara.id,
      world.inactive.id,
    ]);
    expect(rows).toHaveLength(6);
    expect(rows.filter((row) => !row.active).map((row) => row.name)).toEqual([
      "Turno Antigo",
    ]);
    const byName = Object.fromEntries(rows.map((row) => [row.name, row]));
    expect(byName.Noite).toMatchObject({ startsAt: "22:00", endsAt: "06:00" });
    expect(byName["Turno Antigo"]).toMatchObject({ sortOrder: 0 });
  });

  it("itens: 9, só a Cinta antiga inativa", async () => {
    const rows = await db
      .select({ name: item.name, active: item.active, kind: item.kind })
      .from(item);
    expect(rows).toHaveLength(9);
    expect(rows.filter((row) => !row.active).map((row) => row.name)).toEqual([
      "Cinta antiga",
    ]);
    expect(
      rows
        .filter((row) => row.kind === "stock")
        .map((r) => r.name)
        .sort(),
    ).toEqual(["Caixa térmica", "Filme", "Stretch"]);
  });

  it("passagens: 17, com os estados da tabela", async () => {
    const rows = await rawHandovers(db, [
      world.uld.id,
      world.camara.id,
      world.inactive.id,
    ]);
    expect(rows).toHaveLength(17);
    const status = (key: keyof DashboardWorld["handovers"]) =>
      rows.find((row) => row.id === world.handovers[key])?.status;
    expect(status("15T")).toBe("draft");
    const deliveredKeys: (keyof DashboardWorld["handovers"])[] = [
      "15M",
      "19M",
      "20T",
      "C18D",
    ];
    expect(deliveredKeys.map((key) => status(key))).toEqual([
      "delivered",
      "delivered",
      "delivered",
      "delivered",
    ]);
    expect(rows.filter((row) => row.status === "confirmed")).toHaveLength(12);
    expect(rows.filter((row) => row.status === "draft")).toHaveLength(1);
  });

  it("a correção da 17T é a operação real: Rede 5 → 8, uma linha de auditoria", async () => {
    const rows = await db.select().from(handoverCorrection);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      handoverId: world.correctedHandoverId,
      field: "item_quantity",
      itemId: world.items.net,
      oldValue: "5",
      newValue: "8",
      correctedBy: world.people.admin.userId,
    });
    const handovers = await rawHandovers(db, [world.uld.id]);
    expect(
      handovers.filter((row) => row.corrected).map((row) => row.id),
    ).toEqual([world.handovers["17T"]]);
  });

  it("as linhas de item são exatamente as da tabela (43)", async () => {
    const [row] = await db.select({ n: count() }).from(handoverItem);
    expect(row?.n).toBe(43);
    // 15M e 15A são as únicas com a Cinta antiga; nenhuma tem Lacre ULD nem Filme.
    const withOld = await db
      .select({ id: handoverItem.handoverId })
      .from(handoverItem)
      .where(eq(handoverItem.itemId, world.items.oldStrap));
    expect(withOld.map((r) => r.id).sort()).toEqual(
      [world.handovers["15M"], world.handovers["15A"]].sort(),
    );
    for (const itemId of [world.items.uldSeal, world.items.film]) {
      const none = await db
        .select({ id: handoverItem.handoverId })
        .from(handoverItem)
        .where(eq(handoverItem.itemId, itemId));
      expect(none).toEqual([]);
    }
  });

  it("solicitações: 12, com 4 eventos na R3 e o destino inativo", async () => {
    const rows = await rawRequests(db, [
      world.uld.id,
      world.camara.id,
      world.inactive.id,
    ]);
    expect(rows).toHaveLength(12);
    expect(
      rows
        .find((row) => row.id === world.requests.R3)
        ?.events.map((e) => e.toStatus),
    ).toEqual(["requested", "delivered", "in_transit", "delivered"]);
    const [events] = await db.select({ n: count() }).from(requestStatusEvent);
    // 12 criações + R1 2 + R2 1 + R3 3 + R4 2 + R5 3 + R6 1 + R8 1 + R10 1 + R11 1 + R12 1
    expect(events?.n).toBe(28);
    const dests = await db
      .select({ name: destination.name, active: destination.active })
      .from(destination);
    expect(dests.filter((d) => !d.active).map((d) => d.name)).toEqual([
      "Doca Antiga",
    ]);
    expect(await db.select().from(shift)).toHaveLength(6);
  });
});

// Os três escopos do dashboard: setor da ULD, setor da Câmara e todos (só os
// setores ativos: o Setor Parado nunca entra).
function scopes(w: DashboardWorld) {
  return {
    uld: [w.uld.id],
    camara: [w.camara.id],
    todos: [w.uld.id, w.camara.id],
  };
}

describe("números esperados do mundo (C-6): oráculos em JS sobre os leitores crus", () => {
  it("Passagens: os 7 números de cada escopo", async () => {
    const all = scopes(world);
    const shifts = await rawShifts(db, all.todos);
    const handovers = await rawHandovers(db, all.todos);
    const passages = (sectorIds: readonly string[]) =>
      oraclePassages({
        shifts,
        handovers,
        sectorIds,
        period: world.period,
        now: world.now,
      });
    expect(passages(all.uld)).toEqual({
      expected: 19,
      delivered: 10,
      confirmed: 7,
      awaiting: 1,
      unconfirmed: 2,
      missing: 11,
      listed: 21,
    });
    expect(passages(all.camara)).toEqual({
      expected: 6,
      delivered: 2,
      confirmed: 1,
      awaiting: 1,
      unconfirmed: 0,
      missing: 4,
      listed: 6,
    });
    expect(passages(all.todos)).toEqual({
      expected: 25,
      delivered: 12,
      confirmed: 8,
      awaiting: 2,
      unconfirmed: 2,
      missing: 15,
      listed: 27,
    });
  });

  it("Controles: total, anterior, passagens, média e segmentos por turno", async () => {
    const all = scopes(world);
    const lines = await rawDeliveredItems(db, {
      sectorIds: all.todos,
      range: { from: world.previous.from, to: world.period.to },
      kind: "control",
    });
    const metrics = oracleControls({
      lines,
      itemIds: Object.values({
        net: world.items.net,
        strap: world.items.strap,
        oldStrap: world.items.oldStrap,
        uldSeal: world.items.uldSeal,
        seal: world.items.seal,
      }),
      period: world.period,
      previous: world.previous,
    });
    const by = (id: string) => {
      const found = metrics.find((metric) => metric.itemId === id);
      if (!found) throw new Error("item sem métrica");
      return found;
    };
    const part = (id: string, shiftId: string) =>
      by(id).byShift[shiftId] ?? { total: 0, previousTotal: 0 };
    const s = world.shifts;

    expect(by(world.items.net)).toMatchObject({
      total: 35,
      previousTotal: 6,
      handoverCount: 10,
      average: 3.5,
    });
    expect(by(world.items.strap)).toMatchObject({
      total: 36,
      previousTotal: 9,
      handoverCount: 10,
      average: 3.6,
    });
    expect(by(world.items.oldStrap)).toMatchObject({
      total: 3,
      previousTotal: 0,
      handoverCount: 2,
      average: 1.5,
    });
    expect(by(world.items.uldSeal)).toMatchObject({
      total: 0,
      previousTotal: 0,
      handoverCount: 0,
      average: null,
    });
    expect(by(world.items.seal)).toMatchObject({
      total: 6,
      previousTotal: 5,
      handoverCount: 2,
      average: 3,
    });

    expect(
      [s.morning, s.afternoon, s.night, s.retired].map((id) =>
        part(world.items.net, id),
      ),
    ).toEqual([
      { total: 20, previousTotal: 4 },
      { total: 13, previousTotal: 0 },
      { total: 1, previousTotal: 2 },
      { total: 1, previousTotal: 0 },
    ]);
    expect(
      [s.morning, s.afternoon, s.night, s.retired].map((id) =>
        part(world.items.strap, id),
      ),
    ).toEqual([
      { total: 21, previousTotal: 6 },
      { total: 10, previousTotal: 0 },
      { total: 3, previousTotal: 3 },
      { total: 2, previousTotal: 0 },
    ]);
    expect(
      [s.morning, s.afternoon, s.night, s.retired].map((id) =>
        part(world.items.oldStrap, id),
      ),
    ).toEqual([
      { total: 2, previousTotal: 0 },
      { total: 0, previousTotal: 0 },
      { total: 0, previousTotal: 0 },
      { total: 1, previousTotal: 0 },
    ]);
    expect(part(world.items.seal, s.camaraDay)).toEqual({
      total: 6,
      previousTotal: 5,
    });
  });

  it("Controles: a série diária da Rede (07 a 20/11) soma 35 nos 7 últimos dias", async () => {
    const lines = await rawDeliveredItems(db, {
      sectorIds: [world.uld.id],
      range: { from: world.previous.from, to: world.period.to },
      kind: "control",
    });
    const [net] = oracleControls({
      lines,
      itemIds: [world.items.net],
      period: world.period,
      previous: world.previous,
    });
    const days = [
      "2026-11-07",
      "2026-11-08",
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
    ];
    expect(days.map((day) => net?.byDay[day] ?? 0)).toEqual([
      0, 0, 0, 4, 0, 2, 0, 5, 5, 5, 8, 0, 3, 9,
    ]);
  });

  it("slots: Manhã 1, Tarde 2, Noite 3 e o Turno Antigo (inativo) 4", async () => {
    const shifts = await rawShifts(db, [world.uld.id, world.camara.id]);
    const s = world.shifts;
    expect(
      [s.morning, s.afternoon, s.night, s.retired].map((id) =>
        oracleSlotOf(shifts, world.uld.id, id),
      ),
    ).toEqual([1, 2, 3, 4]);
    expect(oracleSlotOf(shifts, world.camara.id, s.camaraDay)).toBe(1);
  });

  it("Estoque: última contagem e pontos do período", async () => {
    const all = scopes(world);
    const lines = await rawDeliveredItems(db, {
      sectorIds: all.todos,
      range: { from: "2026-01-01", to: world.period.to },
      kind: "stock",
    });
    const stock = oracleStock({
      lines,
      handovers: await rawHandovers(db, all.todos),
      shifts: await rawShifts(db, all.todos),
      itemIds: [world.items.stretch, world.items.film, world.items.thermalBox],
      period: world.period,
    });
    const [stretch, film, box] = stock;
    expect(stretch?.last).toEqual({
      quantity: 12,
      operationalDate: "2026-11-20",
      shiftId: world.shifts.afternoon,
      handoverId: world.handovers["20T"],
    });
    expect(stretch?.lastBeforePeriod).toBe(false);
    expect(stretch?.points.map((point) => point.quantity)).toEqual([
      9,
      7,
      6,
      5,
      null,
      3,
      12,
    ]);
    expect(film?.last).toBeNull();
    expect(film?.points.every((point) => point.quantity === null)).toBe(true);
    expect(film?.points).toHaveLength(7);
    expect(box?.last).toEqual({
      quantity: 4,
      operationalDate: "2026-11-10",
      shiftId: world.shifts.camaraDay,
      handoverId: world.handovers.C10D,
    });
    expect(box?.lastBeforePeriod).toBe(true);
    expect(box?.points.every((point) => point.quantity === null)).toBe(true);
  });

  it("Solicitações: abertas, paradas, entregues, destinos e itens pedidos", async () => {
    const run = async (sectorIds: readonly string[]) =>
      oracleRequests({
        requests: await rawRequests(db, sectorIds),
        now: world.now,
        period: world.period,
      });
    const { doca, inactive } = world.destinations;
    const uld = await run([world.uld.id]);
    expect(uld).toEqual({
      open: 3,
      stale: 1,
      deliveredInPeriod: 5,
      destinations: {
        [doca]: { deliveredCount: 3, averageSeconds: 66_000 },
        [inactive]: { deliveredCount: 1, averageSeconds: 21_600 },
        outro: { deliveredCount: 1, averageSeconds: 1_800 },
      },
      items: {
        [world.items.net]: { quantity: 6, requestCount: 2 },
        [world.items.stretch]: { quantity: 5, requestCount: 2 },
        [world.items.strap]: { quantity: 2, requestCount: 1 },
      },
    });
    const camara = await run([world.camara.id]);
    expect(camara).toEqual({
      open: 0,
      stale: 0,
      deliveredInPeriod: 1,
      destinations: { [doca]: { deliveredCount: 1, averageSeconds: 2_100 } },
      items: { [world.items.seal]: { quantity: 3, requestCount: 1 } },
    });
    const todos = await run([world.uld.id, world.camara.id]);
    expect(todos.open).toBe(3);
    expect(todos.stale).toBe(1);
    expect(todos.deliveredInPeriod).toBe(6);
    expect(todos.destinations[doca]).toEqual({
      deliveredCount: 4,
      averageSeconds: 50_025,
    });
    expect(Object.keys(todos.items)).toHaveLength(4);
  });

  it("CSV: linhas e colunas de item por escopo, com a soma de cada coluna de controle", async () => {
    const all = scopes(world);
    const shifts = await rawShifts(db, all.todos);
    const handovers = await rawHandovers(db, all.todos);
    const csv = async (sectorIds: readonly string[]) =>
      oracleCsv({
        passages: oraclePassages({
          shifts,
          handovers,
          sectorIds,
          period: world.period,
          now: world.now,
        }),
        controlLines: await rawDeliveredItems(db, {
          sectorIds,
          range: world.period,
          kind: "control",
        }),
        stockLines: await rawDeliveredItems(db, {
          sectorIds,
          range: world.period,
          kind: "stock",
        }),
      });
    const { net, strap, oldStrap, stretch, seal } = world.items;

    const uld = await csv(all.uld);
    expect(uld.rows).toBe(21);
    expect(uld.controlItemIds).toEqual([net, strap, oldStrap].sort());
    expect(uld.stockItemIds).toEqual([stretch]);
    expect(uld.controlSums).toEqual({ [net]: 35, [strap]: 36, [oldStrap]: 3 });

    const camara = await csv(all.camara);
    expect(camara.rows).toBe(6);
    expect(camara.controlItemIds).toEqual([seal]);
    expect(camara.stockItemIds).toEqual([]);
    expect(camara.controlSums).toEqual({ [seal]: 6 });

    const todos = await csv(all.todos);
    expect(todos.rows).toBe(27);
    expect(todos.controlItemIds).toEqual([seal, net, strap, oldStrap].sort());
    expect(todos.stockItemIds).toEqual([stretch]);
  });
});
