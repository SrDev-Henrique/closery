import { describe, expect, it } from "vitest";

import { REQUEST_STATUSES } from "@/lib/requestStatuses";

import { timelineKind, timelineSentence } from "./timeline";

describe("timelineKind", () => {
  it.each([
    [null, "requested", "created"],
    // avanços e voltas entre abertos
    ["requested", "in_transit", "moved"],
    ["in_transit", "delivered", "moved"],
    ["requested", "delivered", "moved"],
    ["in_transit", "requested", "moved"],
    // cancelar, de qualquer status
    ["requested", "cancelled", "cancelled"],
    ["in_transit", "cancelled", "cancelled"],
    ["delivered", "cancelled", "cancelled"],
    // reabrir, de Entregue e de Cancelada, para uma aberta
    ["delivered", "requested", "reopened"],
    ["delivered", "in_transit", "reopened"],
    ["cancelled", "requested", "reopened"],
    ["cancelled", "in_transit", "reopened"],
    // Cancelada → Entregue não é reabrir: não volta para uma aberta
    ["cancelled", "delivered", "moved"],
  ] as const)("%s → %s: %s", (from, to, expected) => {
    expect(timelineKind(from, to)).toBe(expected);
  });

  it("toda combinação de status devolve algum tipo; só o from nulo cria", () => {
    for (const from of [null, ...REQUEST_STATUSES]) {
      for (const to of REQUEST_STATUSES) {
        const kind = timelineKind(from, to);
        expect(["created", "moved", "cancelled", "reopened"]).toContain(kind);
        expect(kind === "created").toBe(from === null);
      }
    }
  });
});

describe("timelineSentence", () => {
  it.each([
    [
      { kind: "created", to: "requested", byName: "Ana Teste" },
      "Criada por Ana Teste",
    ],
    [
      { kind: "moved", to: "in_transit", byName: "Bia Teste" },
      "Bia Teste moveu para Em separação / Trânsito",
    ],
    [
      { kind: "moved", to: "delivered", byName: "Bia Teste" },
      "Bia Teste moveu para Entregue",
    ],
    [
      { kind: "cancelled", to: "cancelled", byName: "Ana Teste" },
      "Ana Teste cancelou",
    ],
    [
      { kind: "reopened", to: "requested", byName: "Ana Teste" },
      "Ana Teste reabriu como Solicitada",
    ],
    [
      { kind: "reopened", to: "in_transit", byName: "Ana Teste" },
      "Ana Teste reabriu como Em separação / Trânsito",
    ],
  ] as const)("%j", (entry, expected) => {
    expect(timelineSentence(entry)).toBe(expected);
  });
});
