import { describe, expect, it } from "vitest";

import { REQUEST_STATUSES } from "@/lib/requestStatuses";

import { daysInStatus, isStale, staleLabel } from "./stale";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-11-23T12:00:00Z");

function ago(ms: number): Date {
  return new Date(NOW.getTime() - ms);
}

describe("daysInStatus", () => {
  it.each([
    ["agora mesmo", 0, 0],
    ["23 h 59", 24 * HOUR - 60_000, 0],
    ["24 h exatas", 24 * HOUR, 1],
    ["71 h 59", 72 * HOUR - 60_000, 2],
    ["72 h exatas", 72 * HOUR, 3],
    ["72 h + 1 ms", 72 * HOUR + 1, 3],
    ["96 h", 96 * HOUR, 4],
    ["30 dias", 30 * 24 * HOUR, 30],
  ])("%s → %i dias", (_label, elapsed, expected) => {
    expect(daysInStatus(ago(elapsed), NOW)).toBe(expected);
  });

  it("data no futuro nunca é negativa", () => {
    expect(daysInStatus(new Date(NOW.getTime() + HOUR), NOW)).toBe(0);
    expect(daysInStatus(new Date(NOW.getTime() + 10 * 24 * HOUR), NOW)).toBe(0);
  });
});

describe("isStale", () => {
  it.each([
    ["requested", true],
    ["in_transit", true],
    ["delivered", false],
    ["cancelled", false],
  ] as const)("%s com 5 dias parado: %s", (status, expected) => {
    expect(isStale(status, ago(5 * 24 * HOUR), NOW)).toBe(expected);
  });

  it("fronteira: 72 h exatas não é parada; 72 h + 1 ms é", () => {
    expect(isStale("requested", ago(72 * HOUR), NOW)).toBe(false);
    expect(isStale("requested", ago(72 * HOUR + 1), NOW)).toBe(true);
    expect(isStale("in_transit", ago(72 * HOUR - 60_000), NOW)).toBe(false);
  });

  it("agora mesmo e data no futuro não são paradas", () => {
    expect(isStale("requested", NOW, NOW)).toBe(false);
    expect(isStale("requested", new Date(NOW.getTime() + HOUR), NOW)).toBe(
      false,
    );
  });

  it("Entregue e Cancelada nunca param, por mais antigas que sejam", () => {
    for (const status of REQUEST_STATUSES) {
      const stale = isStale(status, ago(365 * 24 * HOUR), NOW);
      expect(stale).toBe(status === "requested" || status === "in_transit");
    }
  });
});

describe("staleLabel", () => {
  it("singular só no 1", () => {
    expect(staleLabel(1)).toBe("Parada há 1 dia");
    expect(staleLabel(3)).toBe("Parada há 3 dias");
    expect(staleLabel(30)).toBe("Parada há 30 dias");
  });

  it("0 usa o plural (não acontece com parada, mas nunca quebra)", () => {
    expect(staleLabel(0)).toBe("Parada há 0 dias");
  });
});
