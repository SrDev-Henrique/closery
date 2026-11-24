import { describe, expect, it } from "vitest";

import { REQUEST_STATUSES, type RequestStatus } from "@/lib/requestStatuses";

import {
  BOARD_STATUSES,
  isBoardStatus,
  isOpenStatus,
  moveLabel,
  moveTargets,
  nextStep,
  OPEN_STATUSES,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_ORDER,
  STATUS_PARAM,
} from "./status";

describe("listas de status", () => {
  it("a ordem dos grupos é a do banco; o Quadro não tem Cancelada", () => {
    expect(REQUEST_STATUS_ORDER).toEqual(REQUEST_STATUSES);
    expect(BOARD_STATUSES).toEqual(["requested", "in_transit", "delivered"]);
    expect(OPEN_STATUSES).toEqual(["requested", "in_transit"]);
  });

  it.each([
    ["requested", true, true],
    ["in_transit", true, true],
    ["delivered", false, true],
    ["cancelled", false, false],
  ] as const)("%s: aberta %s, no Quadro %s", (status, open, board) => {
    expect(isOpenStatus(status)).toBe(open);
    expect(isBoardStatus(status)).toBe(board);
  });
});

describe("rótulos e parâmetros", () => {
  it("rótulos do contrato, um por status", () => {
    expect(REQUEST_STATUS_LABEL).toEqual({
      requested: "Solicitada",
      in_transit: "Em separação / Trânsito",
      delivered: "Entregue",
      cancelled: "Cancelada",
    });
  });

  it("parâmetros do contrato, um por status, sem repetição", () => {
    expect(STATUS_PARAM).toEqual({
      requested: "solicitada",
      in_transit: "transito",
      delivered: "entregue",
      cancelled: "cancelada",
    });
    expect(new Set(Object.values(STATUS_PARAM)).size).toBe(4);
  });
});

describe("nextStep", () => {
  it.each([
    ["requested", "in_transit"],
    ["in_transit", "delivered"],
    ["delivered", null],
    ["cancelled", null],
  ] as const)("%s → %s", (status, expected) => {
    expect(nextStep(status)).toBe(expected);
  });
});

describe("moveTargets", () => {
  it.each([
    ["requested", ["in_transit", "delivered"]],
    ["in_transit", ["requested", "delivered"]],
    ["delivered", ["requested", "in_transit"]],
    // Reabrir uma cancelada é mover: os três do Quadro, nunca Cancelada.
    ["cancelled", ["requested", "in_transit", "delivered"]],
  ] as const)("%s → %j", (status, expected) => {
    expect(moveTargets(status)).toEqual(expected);
  });

  it("nunca oferece Cancelada nem o status atual", () => {
    for (const status of REQUEST_STATUSES satisfies readonly RequestStatus[]) {
      const targets = moveTargets(status);
      expect(targets).not.toContain("cancelled");
      expect(targets).not.toContain(status);
    }
  });
});

describe("moveLabel", () => {
  it("nomeia o resultado, com o rótulo do destino", () => {
    expect(moveLabel("in_transit")).toBe("Mover para Em separação / Trânsito");
    expect(moveLabel("delivered")).toBe("Mover para Entregue");
    expect(moveLabel("requested")).toBe("Mover para Solicitada");
  });
});
