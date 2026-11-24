import { describe, expect, it } from "vitest";

import { requestGroups, requestListItem } from "../../../test/requestCards";
import { applyMove, toGroupView } from "./boardMove";
import type { RequestListItem } from "./types";

const AT = new Date("2026-11-23T15:00:00Z");

function boardOf(rows: readonly RequestListItem[], totals = {}) {
  const { requested, in_transit, delivered } = requestGroups(rows, totals);
  return toGroupView({ requested, in_transit, delivered });
}

function ids(rows: readonly { id: string }[]): string[] {
  return rows.map((row) => row.id);
}

describe("toGroupView", () => {
  it("nenhum cartão começa em voo e o resto do grupo fica igual", () => {
    const row = requestListItem();
    const groups = requestGroups([row], { requested: 7 });
    const view = toGroupView(groups);
    expect(view.requested.total).toBe(7);
    expect(view.requested.limit).toBe(groups.requested.limit);
    expect(view.requested.rows).toEqual([{ ...row, pending: false }]);
    expect(Object.keys(view)).toEqual(Object.keys(groups));
  });

  it("não muta o servidor: as linhas de entrada não ganham pending", () => {
    const groups = requestGroups([requestListItem()]);
    toGroupView(groups);
    expect("pending" in (groups.requested.rows[0] ?? {})).toBe(false);
  });

  it("aceita só as colunas do Quadro", () => {
    const { requested, in_transit, delivered } = requestGroups([]);
    const view = toGroupView({ requested, in_transit, delivered });
    expect(Object.keys(view)).toEqual(["requested", "in_transit", "delivered"]);
  });
});

describe("applyMove", () => {
  it("move o cartão de coluna e as duas contagens mudam juntas", () => {
    const moving = requestListItem({ description: "Rede" });
    const other = requestListItem();
    const groups = boardOf([moving, other]);
    const next = applyMove(groups, { id: moving.id, to: "in_transit", at: AT });

    expect(ids(next.requested.rows)).toEqual([other.id]);
    expect(next.requested.total).toBe(1);
    expect(ids(next.in_transit.rows)).toEqual([moving.id]);
    expect(next.in_transit.total).toBe(1);
    expect(next.delivered.total).toBe(0);
  });

  it("o cartão movido está em voo, sem 'parada' e com os dias zerados", () => {
    const stale = requestListItem({
      stale: true,
      daysInStatus: 5,
      status: "in_transit",
    });
    const next = applyMove(boardOf([stale]), {
      id: stale.id,
      to: "delivered",
      at: AT,
    });
    expect(next.delivered.rows[0]).toMatchObject({
      id: stale.id,
      status: "delivered",
      statusChangedAt: AT,
      daysInStatus: 0,
      stale: false,
      pending: true,
    });
  });

  it("coluna aberta recebe o cartão no fim; Entregue, no topo", () => {
    const first = requestListItem({ status: "in_transit" });
    const done = requestListItem({ status: "delivered" });
    const moving = requestListItem();
    const groups = boardOf([moving, first, done]);

    const toOpen = applyMove(groups, {
      id: moving.id,
      to: "in_transit",
      at: AT,
    });
    expect(ids(toOpen.in_transit.rows)).toEqual([first.id, moving.id]);

    const toDelivered = applyMove(groups, {
      id: moving.id,
      to: "delivered",
      at: AT,
    });
    expect(ids(toDelivered.delivered.rows)).toEqual([moving.id, done.id]);
  });

  it("voltar de Entregue para uma coluna aberta também funciona (reabrir)", () => {
    const done = requestListItem({ status: "delivered" });
    const next = applyMove(boardOf([done]), {
      id: done.id,
      to: "requested",
      at: AT,
    });
    expect(ids(next.requested.rows)).toEqual([done.id]);
    expect(next.delivered.total).toBe(0);
  });

  it("coluna aberta truncada: soma a contagem, mas não insere o cartão", () => {
    const moving = requestListItem();
    const shown = requestListItem({ status: "in_transit" });
    // 1 linha mostrada de 5 no servidor: faltam 4 ("Carregar mais").
    const groups = boardOf([moving, shown], { in_transit: 5 });
    const next = applyMove(groups, { id: moving.id, to: "in_transit", at: AT });

    expect(ids(next.in_transit.rows)).toEqual([shown.id]);
    expect(next.in_transit.total).toBe(6);
    expect(next.requested.total).toBe(0);
  });

  it("Entregue truncada: o cartão entra no topo mesmo assim", () => {
    const moving = requestListItem({ status: "in_transit" });
    const shown = requestListItem({ status: "delivered" });
    const groups = boardOf([moving, shown], { delivered: 30 });
    const next = applyMove(groups, { id: moving.id, to: "delivered", at: AT });
    expect(ids(next.delivered.rows)).toEqual([moving.id, shown.id]);
    expect(next.delivered.total).toBe(31);
  });

  it("devolve o MESMO objeto quando não acha o cartão", () => {
    const groups = boardOf([requestListItem()]);
    expect(
      applyMove(groups, { id: "inexistente", to: "delivered", at: AT }),
    ).toBe(groups);
  });

  it("devolve o MESMO objeto quando o cartão já está no destino", () => {
    const row = requestListItem({ status: "in_transit" });
    const groups = boardOf([row]);
    expect(applyMove(groups, { id: row.id, to: "in_transit", at: AT })).toBe(
      groups,
    );
  });

  it("grupo de destino ausente (Cancelada no Quadro): só tira da origem", () => {
    const moving = requestListItem();
    const groups = boardOf([moving]);
    const next = applyMove(groups, { id: moving.id, to: "cancelled", at: AT });
    expect(next.requested.rows).toEqual([]);
    expect(next.requested.total).toBe(0);
    expect(Object.keys(next)).toEqual(["requested", "in_transit", "delivered"]);
  });

  it("na Lista (4 grupos) Cancelada recebe o cartão no topo", () => {
    const moving = requestListItem();
    const old = requestListItem({ status: "cancelled" });
    const groups = toGroupView(requestGroups([moving, old]));
    const next = applyMove(groups, { id: moving.id, to: "cancelled", at: AT });
    expect(ids(next.cancelled.rows)).toEqual([moving.id, old.id]);
    expect(next.cancelled.total).toBe(2);
  });

  it("a contagem da origem nunca fica negativa", () => {
    const moving = requestListItem();
    // total do servidor desatualizado (0) com uma linha na tela.
    const groups = boardOf([moving], { requested: 0 });
    const next = applyMove(groups, { id: moving.id, to: "in_transit", at: AT });
    expect(next.requested.total).toBe(0);
  });

  it("não muta a entrada (grupos, linhas e cartão)", () => {
    const moving = requestListItem();
    const groups = boardOf([moving, requestListItem({ status: "delivered" })]);
    const before = structuredClone(groups);
    const next = applyMove(groups, { id: moving.id, to: "delivered", at: AT });
    expect(groups).toEqual(before);
    expect(next).not.toBe(groups);
    expect(next.requested).not.toBe(groups.requested);
    expect(groups.requested.rows[0]?.pending).toBe(false);
  });

  it("dois movimentos seguidos: o segundo parte do resultado do primeiro", () => {
    const moving = requestListItem();
    const groups = boardOf([moving]);
    const first = applyMove(groups, {
      id: moving.id,
      to: "in_transit",
      at: AT,
    });
    const second = applyMove(first, { id: moving.id, to: "delivered", at: AT });
    expect(second.in_transit.total).toBe(0);
    expect(ids(second.delivered.rows)).toEqual([moving.id]);
    expect(second.delivered.total).toBe(1);
  });

  it("a soma dos totais se mantém (o cartão só muda de lugar)", () => {
    const rows = [
      requestListItem(),
      requestListItem(),
      requestListItem({ status: "in_transit" }),
    ];
    const groups = boardOf(rows);
    const sum = (view: typeof groups) =>
      view.requested.total + view.in_transit.total + view.delivered.total;
    const next = applyMove(groups, {
      id: rows[0]?.id ?? "",
      to: "delivered",
      at: AT,
    });
    expect(sum(next)).toBe(sum(groups));
  });
});
