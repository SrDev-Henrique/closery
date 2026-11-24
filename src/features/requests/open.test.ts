import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Authz } from "@/features/authz/authz";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertDestination,
  insertRequest,
  insertRequestEvent,
  insertSector,
  insertUser,
} from "../../../test/fixtures";
import { HANDOVER_OPEN_LIMIT } from "./limits";
import { listOpenRequests, listOpenRequestsAtDelivery } from "./open";

// 2026-11-21 12:00 em São Paulo = 15:00Z.
const NOW = spDate("2026-11-21", "12:00");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

let client: PGlite;
let db: TestDb;

type World = {
  sector: { id: string };
  other: { id: string };
  ana: { id: string };
  doca: { id: string };
  operator: Authz;
  admin: Authz;
};
let w: World;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
  const sector = await insertSector(db);
  const other = await insertSector(db);
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
    name: "Ana Teste",
  });
  const doca = await insertDestination(db, { name: "Doca 3" });
  w = {
    sector,
    other,
    ana,
    doca,
    operator: authzOf({
      role: "operator",
      userId: ana.id,
      sectorId: sector.id,
    }),
    admin: authzOf({ role: "admin" }),
  };
});

function seed(overrides: Partial<Parameters<typeof insertRequest>[1]> = {}) {
  return insertRequest(db, {
    sectorId: w.sector.id,
    createdBy: w.ana.id,
    destinationId: w.doca.id,
    createdAt: ago(HOUR),
    ...overrides,
  });
}

describe("listOpenRequests", () => {
  it("só as abertas do setor, a mais antiga no status primeiro, com o resumo de cada uma", async () => {
    const newer = await seed({ description: "nova", createdAt: ago(2 * HOUR) });
    const older = await seed({
      description: "antiga",
      destinationId: undefined,
      destinationOther: "Cliente avulso",
      status: "in_transit",
      createdAt: ago(6 * DAY),
      statusChangedAt: ago(5 * DAY),
    });
    await seed({
      status: "delivered",
      createdAt: ago(6 * DAY),
      statusChangedAt: ago(2 * DAY),
    });
    await seed({
      status: "cancelled",
      createdAt: ago(6 * DAY),
      statusChangedAt: ago(2 * DAY),
    });

    const result = await listOpenRequests(db, w.operator, w.sector.id, NOW);

    expect(result.total).toBe(2);
    expect(result.staleCount).toBe(1);
    expect(result.rows).toEqual([
      {
        id: older.id,
        description: "antiga",
        destinationName: "Cliente avulso",
        status: "in_transit",
        daysInStatus: 5,
        stale: true,
      },
      {
        id: newer.id,
        description: "nova",
        destinationName: "Doca 3",
        status: "requested",
        daysInStatus: 0,
        stale: false,
      },
    ]);
  });

  it("sem abertas: zeros", async () => {
    await seed({
      status: "delivered",
      createdAt: ago(3 * DAY),
      statusChangedAt: ago(DAY),
    });

    expect(await listOpenRequests(db, w.operator, w.sector.id, NOW)).toEqual({
      rows: [],
      total: 0,
      staleCount: 0,
    });
  });

  it("teto de 20 linhas, com total e paradas contados sobre todas", async () => {
    for (let i = 0; i < HANDOVER_OPEN_LIMIT + 5; i++) {
      await seed({
        description: `Pedido ${i}`,
        // as 5 mais antigas estão paradas
        createdAt: i < 5 ? ago(5 * DAY + i * HOUR) : ago(HOUR + i * 1000),
        events: false,
      });
    }

    const result = await listOpenRequests(db, w.operator, w.sector.id, NOW);

    expect(result.rows).toHaveLength(HANDOVER_OPEN_LIMIT);
    expect(result.total).toBe(25);
    expect(result.staleCount).toBe(5);
    // As paradas há mais tempo vêm primeiro.
    expect(result.rows.slice(0, 5).every((row) => row.stale)).toBe(true);
    expect(result.rows[0]?.description).toBe("Pedido 4");
  });

  it("72 h exatas não é parada; 72 h + 1 ms é", async () => {
    await seed({
      description: "exata",
      createdAt: ago(72 * HOUR),
      events: false,
    });
    await seed({
      description: "passou",
      createdAt: ago(72 * HOUR + 1),
      events: false,
    });

    const result = await listOpenRequests(db, w.operator, w.sector.id, NOW);

    expect(result.staleCount).toBe(1);
    expect(result.rows.map((row) => [row.description, row.stale])).toEqual([
      ["passou", true],
      ["exata", false],
    ]);
  });

  it("outro setor: operador recebe vazio; admin lê o setor pedido", async () => {
    const own = await seed({
      destinationId: undefined,
      destinationOther: "No meu setor",
    });
    const foreign = await insertRequest(db, {
      sectorId: w.other.id,
      createdBy: w.ana.id,
      destinationOther: "Em outro setor",
      createdAt: ago(HOUR),
    });

    const asOperator = await listOpenRequests(db, w.operator, w.other.id, NOW);
    expect(asOperator).toEqual({ rows: [], total: 0, staleCount: 0 });

    const asAdmin = await listOpenRequests(db, w.admin, w.other.id, NOW);
    expect(asAdmin.rows.map((row) => row.id)).toEqual([foreign.id]);
    expect(asAdmin.total).toBe(1);

    const ownResult = await listOpenRequests(db, w.operator, w.sector.id, NOW);
    expect(ownResult.rows.map((row) => row.id)).toEqual([own.id]);
    expect(ownResult.total).toBe(1);
  });

  it("setor inativo não lista abertas (padrão P26)", async () => {
    const inactive = await insertSector(db, "Inativo", { active: false });
    await insertRequest(db, {
      sectorId: inactive.id,
      createdBy: w.ana.id,
      destinationOther: "Qualquer",
      createdAt: ago(HOUR),
    });

    expect(await listOpenRequests(db, w.admin, inactive.id, NOW)).toEqual({
      rows: [],
      total: 0,
      staleCount: 0,
    });
  });
});

describe("listOpenRequestsAtDelivery", () => {
  const T = spDate("2026-11-21", "08:00");
  const before = (ms: number) => new Date(T.getTime() - ms);
  const after = (ms: number) => new Date(T.getTime() + ms);

  const atDelivery = (actor: Authz = w.operator, sectorId = w.sector.id) =>
    listOpenRequestsAtDelivery(db, actor, { sectorId, deliveredAt: T });

  it("status do instante pelos eventos: movida depois mostra o de antes e o de agora", async () => {
    const moved = await seed({
      description: "movida depois",
      status: "in_transit",
      createdAt: before(2 * HOUR),
      statusChangedAt: after(HOUR),
    });
    const unchanged = await seed({
      description: "igual",
      createdAt: before(3 * HOUR),
    });

    const result = await atDelivery();

    expect(result.deliveredAt).toEqual(T);
    expect(result.total).toBe(2);
    expect(result.rows).toEqual([
      {
        id: unchanged.id,
        description: "igual",
        destinationName: "Doca 3",
        status: "requested",
        daysInStatus: 0,
        stale: false,
        statusNow: "requested",
      },
      {
        id: moved.id,
        description: "movida depois",
        destinationName: "Doca 3",
        status: "requested",
        daysInStatus: 0,
        stale: false,
        statusNow: "in_transit",
      },
    ]);
  });

  it("criada depois da entrega fica de fora; criada no instante exato entra", async () => {
    await seed({ description: "depois", createdAt: after(1) });
    const exact = await seed({ description: "no instante", createdAt: T });

    const result = await atDelivery();

    expect(result.rows.map((row) => row.id)).toEqual([exact.id]);
  });

  it("entregue ou cancelada antes da entrega fica de fora, mesmo com um evento aberto anterior", async () => {
    await seed({
      status: "delivered",
      createdAt: before(5 * DAY),
      statusChangedAt: before(2 * DAY),
    });
    await seed({
      status: "cancelled",
      createdAt: before(5 * DAY),
      statusChangedAt: before(DAY),
    });
    const open = await seed({ description: "aberta", createdAt: before(HOUR) });

    const result = await atDelivery();

    expect(result.rows.map((row) => row.id)).toEqual([open.id]);
    expect(result.total).toBe(1);
  });

  it("reaberta depois da entrega: estava fechada no instante, fica de fora", async () => {
    const { id } = await seed({
      createdAt: before(5 * DAY),
      statusChangedAt: after(HOUR),
      events: false,
    });
    await insertRequestEvent(db, {
      requestId: id,
      fromStatus: null,
      toStatus: "requested",
      changedBy: w.ana.id,
      changedAt: before(5 * DAY),
    });
    await insertRequestEvent(db, {
      requestId: id,
      fromStatus: "requested",
      toStatus: "delivered",
      changedBy: w.ana.id,
      changedAt: before(2 * DAY),
    });
    await insertRequestEvent(db, {
      requestId: id,
      fromStatus: "delivered",
      toStatus: "requested",
      changedBy: w.ana.id,
      changedAt: after(HOUR),
    });

    const result = await atDelivery();

    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("parada na entrega e movida depois: dias e parada contados do evento, nunca de request.status_changed_at", async () => {
    const parada = await seed({
      description: "parada na entrega",
      status: "in_transit",
      createdAt: before(4 * DAY),
      statusChangedAt: after(HOUR),
    });

    const result = await atDelivery();

    expect(result.rows).toEqual([
      {
        id: parada.id,
        description: "parada na entrega",
        destinationName: "Doca 3",
        status: "requested",
        daysInStatus: 4,
        stale: true,
        statusNow: "in_transit",
      },
    ]);
    expect(result.staleCount).toBe(1);
  });

  it("72 h exatas na entrega não é parada; 72 h + 1 ms é", async () => {
    await seed({ description: "exata", createdAt: before(72 * HOUR) });
    await seed({ description: "passou", createdAt: before(72 * HOUR + 1) });

    const result = await atDelivery();

    expect(result.staleCount).toBe(1);
    expect(result.rows.map((row) => [row.description, row.stale])).toEqual([
      ["passou", true],
      ["exata", false],
    ]);
  });

  it("empate de changed_at no mesmo instante da entrega é determinístico (desempate por seq)", async () => {
    const open = await seed({
      description: "em separação",
      status: "in_transit",
      createdAt: T,
      statusChangedAt: T,
    });
    for (let i = 0; i < 20; i++) {
      await seed({ status: "delivered", createdAt: T, statusChangedAt: T });
    }

    const result = await atDelivery();

    expect(result.rows).toEqual([
      {
        id: open.id,
        description: "em separação",
        destinationName: "Doca 3",
        status: "in_transit",
        daysInStatus: 0,
        stale: false,
        statusNow: "in_transit",
      },
    ]);
    expect(result.total).toBe(1);
  });

  it("teto de 20 linhas, com total e paradas contados sobre o mesmo conjunto", async () => {
    for (let i = 0; i < HANDOVER_OPEN_LIMIT + 3; i++) {
      await seed({
        description: `Pedido ${i}`,
        createdAt: i < 4 ? before(5 * DAY + i * HOUR) : before(HOUR + i * 1000),
        events: false,
      });
      // `events: false` não grava histórico: o evento de criação vem à mão.
    }
    const rows = await db.query.request.findMany();
    for (const row of rows) {
      await insertRequestEvent(db, {
        requestId: row.id,
        fromStatus: null,
        toStatus: "requested",
        changedBy: w.ana.id,
        changedAt: row.createdAt,
      });
    }

    const result = await atDelivery();

    expect(result.rows).toHaveLength(HANDOVER_OPEN_LIMIT);
    expect(result.total).toBe(23);
    expect(result.staleCount).toBe(4);
    expect(result.rows[0]?.description).toBe("Pedido 3");
  });

  it("outro setor devolve vazio para o operador; admin lê qualquer setor", async () => {
    const own = await insertRequest(db, {
      sectorId: w.sector.id,
      createdBy: w.ana.id,
      destinationOther: "No meu setor",
      createdAt: before(HOUR),
    });
    const foreign = await insertRequest(db, {
      sectorId: w.other.id,
      createdBy: w.ana.id,
      destinationOther: "Em outro setor",
      createdAt: before(HOUR),
    });

    const asOperator = await atDelivery(w.operator, w.other.id);
    expect(asOperator).toEqual({
      deliveredAt: T,
      rows: [],
      total: 0,
      staleCount: 0,
    });
    const ownResult = await atDelivery(w.operator, w.sector.id);
    expect(ownResult.rows.map((row) => row.id)).toEqual([own.id]);
    expect(ownResult.total).toBe(1);

    const otherResult = await atDelivery(w.admin, w.other.id);
    expect(otherResult.rows.map((row) => row.id)).toEqual([foreign.id]);
    expect(otherResult.total).toBe(1);
  });

  it("setor inativo continua legível (o resumo da passagem não some)", async () => {
    const inactive = await insertSector(db, "Inativo", { active: false });
    const mine = await insertRequest(db, {
      sectorId: inactive.id,
      createdBy: w.ana.id,
      destinationOther: "Qualquer",
      createdAt: before(HOUR),
    });

    const result = await atDelivery(w.admin, inactive.id);

    expect(result.rows.map((row) => row.id)).toEqual([mine.id]);
  });

  it("sem solicitações: vazio", async () => {
    expect(await atDelivery()).toEqual({
      deliveredAt: T,
      rows: [],
      total: 0,
      staleCount: 0,
    });
  });
});
