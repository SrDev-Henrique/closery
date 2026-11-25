import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { item } from "@/db/schema/catalog";
import { getHomeRequests } from "@/features/requests/home";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import {
  type DashboardWorld,
  seedDashboardWorld,
} from "../../../test/dashboardWorld";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertDestination,
  insertItem,
  insertRequest,
  insertRequestEvent,
  insertRequestItem,
  insertSector,
  insertUser,
} from "../../../test/fixtures";
import { getRequestsData } from "./requests";
import type { DashboardQuery, RequestsData } from "./types";

const ADMIN = authzOf({ role: "admin" });

describe("getRequestsData sobre o mundo do critério de pronto", () => {
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
  const run = (sectorId: string | null, actor = ADMIN) =>
    getRequestsData(db, actor, queryOf(sectorId), world.now);

  it("ULD: abertas, paradas e entregues no período (a 1ª entrega decide)", async () => {
    const data = await run(world.uld.id);
    // Abertas: R7, R8, R9. Paradas: só a R7 (97 h; a R9 tem 72 h exatas).
    // Entregues: R1, R2 (criada antes), R3 (reaberta, uma vez), R4 (cancelada
    // depois) e R6; a R5 teve a 1ª entrega antes do período.
    expect([data.open, data.stale, data.deliveredInPeriod]).toEqual([3, 1, 5]);
  });

  it("Câmara e 'Todos os setores' (o Setor Parado nunca entra)", async () => {
    const camara = await run(world.camara.id);
    expect([camara.open, camara.stale, camara.deliveredInPeriod]).toEqual([
      0, 0, 1,
    ]);
    const todos = await run(null);
    expect([todos.open, todos.stale, todos.deliveredInPeriod]).toEqual([
      3, 1, 6,
    ]);
  });

  it("abertas e paradas batem com o cartão do Início de cada setor", async () => {
    for (const sector of [world.uld, world.camara]) {
      const home = await getHomeRequests(db, ADMIN, sector.id, world.now);
      const data = await run(sector.id);
      expect([data.open, data.stale]).toEqual([
        home.openCount,
        home.staleCount,
      ]);
    }
    const uld = await getHomeRequests(db, ADMIN, world.uld.id, world.now);
    const camara = await getHomeRequests(db, ADMIN, world.camara.id, world.now);
    const todos = await run(null);
    expect(todos.open).toBe(uld.openCount + camara.openCount);
    expect(todos.stale).toBe(uld.staleCount + camara.staleCount);
  });

  it("tempo até a entrega por destino: média em segundos, Outro como um destino, destino inativo com nome", async () => {
    const data = await run(world.uld.id);
    expect(data.totalDestinations).toBe(3);
    expect(data.destinations).toEqual([
      {
        key: world.destinations.doca,
        destinationId: world.destinations.doca,
        name: "Doca 3",
        deliveredCount: 3,
        averageSeconds: 66_000,
      },
      {
        key: world.destinations.inactive,
        destinationId: world.destinations.inactive,
        name: "Doca Antiga",
        deliveredCount: 1,
        averageSeconds: 21_600,
      },
      {
        key: "outro",
        destinationId: null,
        name: "Outro",
        deliveredCount: 1,
        averageSeconds: 1_800,
      },
    ]);
  });

  it("destinos em 'Todos os setores': a média é de todas as entregas, não das médias", async () => {
    const data = await run(null);
    expect(data.destinations[0]).toMatchObject({
      name: "Doca 3",
      deliveredCount: 4,
      averageSeconds: 50_025,
    });
    expect(data.destinations.map((row) => row.name)).toEqual([
      "Doca 3",
      "Doca Antiga",
      "Outro",
    ]);
  });

  it("Câmara: um destino com 35 min", async () => {
    const data = await run(world.camara.id);
    expect(data.destinations).toEqual([
      {
        key: world.destinations.doca,
        destinationId: world.destinations.doca,
        name: "Doca 3",
        deliveredCount: 1,
        averageSeconds: 2_100,
      },
    ]);
  });

  it("quantidade pedida: soma por item das solicitações criadas no período, sem as canceladas", async () => {
    const data = await run(world.uld.id);
    expect(data.totalItems).toBe(3);
    expect(data.items).toEqual([
      {
        itemId: world.items.net,
        sectorId: world.uld.id,
        sectorName: "ULD Teste",
        name: "Rede de proteção",
        unit: "rede",
        quantity: 6,
        requestCount: 2,
      },
      {
        itemId: world.items.stretch,
        sectorId: world.uld.id,
        sectorName: "ULD Teste",
        name: "Stretch",
        unit: "rolo",
        quantity: 5,
        requestCount: 2,
      },
      {
        itemId: world.items.strap,
        sectorId: world.uld.id,
        sectorName: "ULD Teste",
        name: "Cinta",
        unit: "peça",
        quantity: 2,
        requestCount: 1,
      },
    ]);
  });

  it("quantidade pedida em 'Todos os setores': Rede, Stretch, Lacre, Cinta (por solicitações e depois quantidade)", async () => {
    const data = await run(null);
    expect(data.items.map((row) => row.name)).toEqual([
      "Rede de proteção",
      "Stretch",
      "Lacre",
      "Cinta",
    ]);
    expect(data.items[2]).toMatchObject({
      sectorName: "Câmara Teste",
      quantity: 3,
      requestCount: 1,
    });
  });

  it("período sem nada: zeros e listas vazias, sem lançar", async () => {
    const data = await getRequestsData(
      db,
      ADMIN,
      {
        sectorId: world.camara.id,
        period: { from: "2026-10-01", to: "2026-10-07" },
        previous: { from: "2026-09-24", to: "2026-09-30" },
      },
      world.now,
    );
    expect(data).toEqual({
      open: 0,
      stale: 0,
      deliveredInPeriod: 0,
      destinations: [],
      totalDestinations: 0,
      items: [],
      totalItems: 0,
    });
  });

  it("operador com sectorId de outro setor: vê o próprio; admin com setor lê o setor (a tabela request sem alias nos dois)", async () => {
    const asCris = await run(world.uld.id, world.people.cris);
    expect(asCris.deliveredInPeriod).toBe(1);
    expect(asCris.items.map((row) => row.name)).toEqual(["Lacre"]);
    const asAdmin = await run(world.camara.id);
    expect(asAdmin).toEqual(asCris);
  });

  it("operador de setor inativo e admin no setor inativo: tudo zero", async () => {
    const zero: RequestsData = {
      open: 0,
      stale: 0,
      deliveredInPeriod: 0,
      destinations: [],
      totalDestinations: 0,
      items: [],
      totalItems: 0,
    };
    expect(await run(world.inactive.id, world.people.duda)).toEqual(zero);
    expect(await run(world.inactive.id)).toEqual(zero);
  });
});

describe("getRequestsData em cenários próprios", () => {
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

  const NOW = spDate("2026-11-20", "15:00");
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
    const doca = await insertDestination(db, { name: "Doca 3" });
    return { sector, ana, doca };
  }

  it("parada: 72 h exatas não, 72 h + 1 ms sim (fim da janela é estrito)", async () => {
    const { sector, ana, doca } = await base();
    const exact = new Date(NOW.getTime() - 72 * 3_600_000);
    const over = new Date(NOW.getTime() - 72 * 3_600_000 - 1);
    for (const at of [exact, over]) {
      await insertRequest(db, {
        sectorId: sector.id,
        createdBy: ana.id,
        destinationId: doca.id,
        createdAt: at,
      });
    }
    const data = await getRequestsData(db, ADMIN, query(sector.id), NOW);
    expect(data.open).toBe(2);
    expect(data.stale).toBe(1);
  });

  it("parada: o status em trânsito conta pelo último movimento, não pela criação", async () => {
    const { sector, ana, doca } = await base();
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      destinationId: doca.id,
      status: "in_transit",
      createdAt: new Date(NOW.getTime() - 100 * 3_600_000),
      statusChangedAt: new Date(NOW.getTime() - 10 * 3_600_000),
    });
    const data = await getRequestsData(db, ADMIN, query(sector.id), NOW);
    expect(data).toMatchObject({ open: 1, stale: 0 });
  });

  it("entrega às 23:59 do último dia entra e à 00:00 do dia seguinte sai (dia de São Paulo)", async () => {
    const { sector, ana, doca } = await base();
    const make = async (at: Date) => {
      const created = await insertRequest(db, {
        sectorId: sector.id,
        createdBy: ana.id,
        destinationId: doca.id,
        status: "delivered",
        createdAt: new Date(at.getTime() - 3_600_000),
        statusChangedAt: at,
        events: false,
      });
      await insertRequestEvent(db, {
        requestId: created.id,
        fromStatus: null,
        toStatus: "requested",
        changedBy: ana.id,
        changedAt: new Date(at.getTime() - 3_600_000),
      });
      await insertRequestEvent(db, {
        requestId: created.id,
        fromStatus: "requested",
        toStatus: "delivered",
        changedBy: ana.id,
        changedAt: at,
      });
    };
    await make(spDate("2026-11-20", "23:59"));
    await make(spDate("2026-11-21", "00:00"));
    await make(spDate("2026-11-14", "00:00"));
    await make(spDate("2026-11-13", "23:59"));
    const data = await getRequestsData(
      db,
      ADMIN,
      query(sector.id),
      spDate("2026-11-21", "12:00"),
    );
    expect(data.deliveredInPeriod).toBe(2);
  });

  it("destinos: vários 'Outro' (textos livres diferentes) são um grupo só; teto de 8 com totalDestinations", async () => {
    const { sector, ana } = await base();
    for (let n = 1; n <= 9; n += 1) {
      const destination = await insertDestination(db, {
        name: `Destino ${String(n).padStart(2, "0")}`,
      });
      await insertRequest(db, {
        sectorId: sector.id,
        createdBy: ana.id,
        destinationId: destination.id,
        status: "delivered",
        createdAt: spDate("2026-11-16", "08:00"),
        statusChangedAt: new Date(
          spDate("2026-11-16", "08:00").getTime() + n * 600_000,
        ),
        events: true,
      });
    }
    for (const text of ["Pátio A", "Pátio B"]) {
      await insertRequest(db, {
        sectorId: sector.id,
        createdBy: ana.id,
        destinationOther: text,
        status: "delivered",
        createdAt: spDate("2026-11-16", "08:00"),
        statusChangedAt: spDate("2026-11-16", "08:05"),
        events: true,
      });
    }
    const data = await getRequestsData(db, ADMIN, query(sector.id), NOW);
    // 9 destinos da lista + o grupo "Outro" = 10 grupos; as 8 barras são as de
    // maior tempo médio, em ordem decrescente.
    expect(data.totalDestinations).toBe(10);
    expect(data.destinations).toHaveLength(8);
    expect(data.destinations.map((row) => row.averageSeconds)).toEqual(
      [...data.destinations.map((row) => row.averageSeconds)].sort(
        (a, b) => b - a,
      ),
    );
    expect(data.destinations[0]).toMatchObject({
      name: "Destino 09",
      averageSeconds: 5_400,
    });
    expect(
      data.destinations.filter((row) => row.destinationId === null),
    ).toEqual([]);
  });

  it("'Outro' aparece com os textos livres juntos quando está entre as 8 barras", async () => {
    const { sector, ana } = await base();
    for (const text of ["Pátio A", "Pátio B"]) {
      await insertRequest(db, {
        sectorId: sector.id,
        createdBy: ana.id,
        destinationOther: text,
        status: "delivered",
        createdAt: spDate("2026-11-16", "08:00"),
        statusChangedAt: spDate("2026-11-16", "08:10"),
        events: true,
      });
    }
    const data = await getRequestsData(db, ADMIN, query(sector.id), NOW);
    expect(data.destinations).toEqual([
      {
        key: "outro",
        destinationId: null,
        name: "Outro",
        deliveredCount: 2,
        averageSeconds: 600,
      },
    ]);
  });

  it("itens: teto de 12 com totalItems, ordem por solicitações e depois quantidade", async () => {
    const { sector, ana, doca } = await base();
    for (let n = 1; n <= 13; n += 1) {
      const created = await insertItem(db, {
        sectorId: sector.id,
        name: `Item ${String(n).padStart(2, "0")}`,
        unit: "peça",
        kind: "stock",
        sortOrder: n,
      });
      const request = await insertRequest(db, {
        sectorId: sector.id,
        createdBy: ana.id,
        destinationId: doca.id,
        createdAt: spDate("2026-11-18", "08:00"),
      });
      await insertRequestItem(db, {
        requestId: request.id,
        itemId: created.id,
        quantity: n,
      });
    }
    const data = await getRequestsData(db, ADMIN, query(sector.id), NOW);
    expect(data.totalItems).toBe(13);
    expect(data.items).toHaveLength(12);
    // Todos têm 1 solicitação: vence a maior quantidade.
    expect(data.items[0]).toMatchObject({ name: "Item 13", quantity: 13 });
    expect(data.items[11]).toMatchObject({ name: "Item 02", quantity: 2 });
  });

  it("item cuja unidade mudou no período: uma linha só, com a unidade da solicitação mais recente", async () => {
    const { sector, ana, doca } = await base();
    const stretch = await insertItem(db, {
      sectorId: sector.id,
      name: "Stretch",
      unit: "rolo",
      kind: "stock",
      sortOrder: 1,
    });
    const first = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      destinationId: doca.id,
      createdAt: spDate("2026-11-15", "08:00"),
    });
    await insertRequestItem(db, {
      requestId: first.id,
      itemId: stretch.id,
      quantity: 3,
    });
    await db.update(item).set({ unit: "caixa" }).where(eq(item.id, stretch.id));
    const second = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      destinationId: doca.id,
      createdAt: spDate("2026-11-16", "08:00"),
    });
    await insertRequestItem(db, {
      requestId: second.id,
      itemId: stretch.id,
      quantity: 4,
    });
    const data = await getRequestsData(db, ADMIN, query(sector.id), NOW);
    expect(data.items).toEqual([
      {
        itemId: stretch.id,
        sectorId: sector.id,
        sectorName: "Setor Teste",
        name: "Stretch",
        unit: "caixa",
        quantity: 7,
        requestCount: 2,
      },
    ]);
  });

  it("cancelada fora da quantidade pedida; criada fora do período também", async () => {
    const { sector, ana, doca } = await base();
    const net = await insertItem(db, {
      sectorId: sector.id,
      name: "Rede",
      kind: "stock",
      sortOrder: 1,
    });
    const make = async (
      createdAt: Date,
      status: "requested" | "cancelled",
      quantity: number,
    ) => {
      const created = await insertRequest(db, {
        sectorId: sector.id,
        createdBy: ana.id,
        destinationId: doca.id,
        createdAt,
        ...(status === "cancelled"
          ? {
              status,
              statusChangedAt: new Date(createdAt.getTime() + 3_600_000),
            }
          : {}),
      });
      await insertRequestItem(db, {
        requestId: created.id,
        itemId: net.id,
        quantity,
      });
    };
    await make(spDate("2026-11-16", "08:00"), "requested", 2);
    await make(spDate("2026-11-16", "09:00"), "cancelled", 50);
    await make(spDate("2026-11-13", "23:59"), "requested", 70);
    await make(spDate("2026-11-21", "00:00"), "requested", 90);
    const data = await getRequestsData(
      db,
      ADMIN,
      query(sector.id),
      spDate("2026-11-21", "12:00"),
    );
    expect(data.items.map((row) => [row.quantity, row.requestCount])).toEqual([
      [2, 1],
    ]);
  });
});
