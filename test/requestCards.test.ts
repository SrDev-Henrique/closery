import { describe, expect, it } from "vitest";

import { BOARD_PAGE_SIZE } from "@/features/requests/limits";

import { requestGroups, requestListItem } from "./requestCards";

describe("requestListItem", () => {
  it("tem os padrões do contrato", () => {
    const row = requestListItem();
    expect(row).toMatchObject({
      status: "requested",
      description: "Solicitação de teste",
      destinationName: "Doca 3",
      destinationIsOther: false,
      createdByName: "Ana Teste",
      daysInStatus: 0,
      stale: false,
      itemCount: 0,
      commentCount: 0,
    });
    expect(row.createdAt.toISOString()).toBe("2026-11-20T12:00:00.000Z");
    expect(row.statusChangedAt.toISOString()).toBe("2026-11-20T12:00:00.000Z");
  });

  it("cada chamada devolve um id novo e os campos podem ser trocados", () => {
    const first = requestListItem();
    const second = requestListItem({ status: "delivered", itemCount: 3 });
    expect(second.id).not.toBe(first.id);
    expect(second).toMatchObject({ status: "delivered", itemCount: 3 });
  });
});

describe("requestGroups", () => {
  it("devolve sempre os 4 grupos, vazios quando não há linha", () => {
    const groups = requestGroups([]);
    expect(Object.keys(groups)).toEqual([
      "requested",
      "in_transit",
      "delivered",
      "cancelled",
    ]);
    for (const group of Object.values(groups)) {
      expect(group).toMatchObject({
        total: 0,
        limit: BOARD_PAGE_SIZE,
        rows: [],
      });
    }
  });

  it("agrupa pelo status e o total é o número de linhas", () => {
    const a = requestListItem();
    const b = requestListItem();
    const c = requestListItem({ status: "in_transit" });
    const groups = requestGroups([a, b, c]);
    expect(groups.requested.rows.map((row) => row.id)).toEqual([a.id, b.id]);
    expect(groups.requested.total).toBe(2);
    expect(groups.in_transit.total).toBe(1);
    expect(groups.delivered.total).toBe(0);
  });

  it("total informado vale (Carregar mais pendente) e o status acompanha o grupo", () => {
    const groups = requestGroups([requestListItem()], { requested: 25 });
    expect(groups.requested.total).toBe(25);
    expect(groups.requested.rows).toHaveLength(1);
    expect(groups.cancelled.status).toBe("cancelled");
  });
});
