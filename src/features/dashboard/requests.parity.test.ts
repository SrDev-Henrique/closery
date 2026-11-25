import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  listFilterDestinations,
  listFilterItems,
} from "@/features/requests/choices";
import { listRequestTable } from "@/features/requests/lists";
import {
  parseRequestFilters,
  type RequestFilters,
} from "@/features/requests/requestFilters";
import { hrefQuery, queryRecord } from "@/lib/searchParams";
import { authzOf } from "../../../test/authz";
import {
  type DashboardWorld,
  seedDashboardWorld,
} from "../../../test/dashboardWorld";
import { createTestDb, type TestDb } from "../../../test/db";
import {
  deliveredRequestsHref,
  destinationDeliveriesHref,
  linkExtras,
  openRequestsHref,
  requestedItemHref,
  staleRequestsHref,
} from "./links";
import { getRequestsData } from "./requests";
import type { DashboardQuery } from "./types";

// Cada número do bloco Solicitações é o total da Tabela que o link dele abre
// (D-F5-3). Os links são lidos de volta pelo parse da tela e passam pela mesma
// validação que a tela faz antes de consultar (item e destino conhecidos).

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

// O que a tela faz com o href: parse, ?item= desconhecido vira null, destino
// desconhecido vira null.
async function screenFilters(
  href: string,
  sectorId: string | null,
): Promise<RequestFilters> {
  const parsed = parseRequestFilters(queryRecord(hrefQuery(href)), world.today);
  const items = await listFilterItems(db, ADMIN, sectorId, parsed.itemId);
  const destinations = await listFilterDestinations(db);
  return {
    ...parsed,
    itemId: items.some((entry) => entry.id === parsed.itemId)
      ? parsed.itemId
      : null,
    destination:
      parsed.destination === "outro" ||
      destinations.some((entry) => entry.id === parsed.destination)
        ? parsed.destination
        : null,
  };
}

const SCOPES: readonly [string, () => string | null][] = [
  ["ULD", () => world.uld.id],
  ["Câmara", () => world.camara.id],
  ["Todos os setores", () => null],
];

describe.each(SCOPES)("número × total da Tabela (%s)", (_name, scopeOf) => {
  const queryOf = (sectorId: string | null): DashboardQuery => ({
    sectorId,
    period: { from: world.period.from, to: world.period.to },
    previous: world.previous,
  });
  const totalOf = async (href: string, sectorId: string | null) =>
    (
      await listRequestTable(
        db,
        ADMIN,
        { sectorId, filters: await screenFilters(href, sectorId) },
        world.now,
      )
    ).total;

  it("abertas, paradas e entregues no período", async () => {
    const sectorId = scopeOf();
    const data = await getRequestsData(db, ADMIN, queryOf(sectorId), world.now);
    const extras = linkExtras(sectorId === null ? "todos" : sectorId);
    expect(await totalOf(openRequestsHref(extras), sectorId)).toBe(data.open);
    expect(await totalOf(staleRequestsHref(extras), sectorId)).toBe(data.stale);
    expect(
      await totalOf(deliveredRequestsHref(world.period, extras), sectorId),
    ).toBe(data.deliveredInPeriod);
    expect(data.deliveredInPeriod).toBeGreaterThan(0);
  });

  it("cada barra de destino (inclusive 'outro' e o destino inativo)", async () => {
    const sectorId = scopeOf();
    const data = await getRequestsData(db, ADMIN, queryOf(sectorId), world.now);
    const extras = linkExtras(sectorId === null ? "todos" : sectorId);
    expect(data.destinations.length).toBeGreaterThan(0);
    for (const destination of data.destinations) {
      const href = destinationDeliveriesHref(
        world.period,
        destination.key,
        extras,
      );
      expect(await totalOf(href, sectorId), destination.name).toBe(
        destination.deliveredCount,
      );
    }
  });

  it("cada item pedido (criadas no período, sem as canceladas)", async () => {
    const sectorId = scopeOf();
    const data = await getRequestsData(db, ADMIN, queryOf(sectorId), world.now);
    const extras = linkExtras(sectorId === null ? "todos" : sectorId);
    expect(data.items.length).toBeGreaterThan(0);
    for (const row of data.items) {
      const href = requestedItemHref(world.period, row.itemId, extras);
      const filters = await screenFilters(href, sectorId);
      // A tela mantém o item do link (ele está nas escolhas do escopo).
      expect(filters.itemId, row.name).toBe(row.itemId);
      expect(await totalOf(href, sectorId), row.name).toBe(row.requestCount);
    }
  });
});

describe("a Tabela do link respeita o escopo do operador", () => {
  it("o operador da Câmara abrindo o link do item da ULD vê 0 (o item é de outro setor)", async () => {
    const href = requestedItemHref(world.period, world.items.net);
    const parsed = parseRequestFilters(
      queryRecord(hrefQuery(href)),
      world.today,
    );
    const table = await listRequestTable(
      db,
      world.people.cris,
      { sectorId: null, filters: parsed },
      world.now,
    );
    expect(table.total).toBe(0);
  });
});
