import { describe, expect, it } from "vitest";

import { spDate } from "./clock";

describe("spDate", () => {
  it("converte hora de parede de São Paulo para UTC (+3 h)", () => {
    expect(spDate("2026-11-20", "14:05").toISOString()).toBe(
      "2026-11-20T17:05:00.000Z",
    );
  });

  it("23:59 em São Paulo já é o dia seguinte em UTC", () => {
    expect(spDate("2026-11-20", "23:59").toISOString()).toBe(
      "2026-11-21T02:59:00.000Z",
    );
  });

  it("00:00 em São Paulo é 03:00 UTC do mesmo dia", () => {
    expect(spDate("2026-11-21", "00:00").toISOString()).toBe(
      "2026-11-21T03:00:00.000Z",
    );
  });

  it("lança para data inexistente ou hora inválida", () => {
    expect(() => spDate("2026-02-30", "10:00")).toThrow(RangeError);
    expect(() => spDate("2026-11-20", "25:00")).toThrow(RangeError);
    expect(() => spDate("lixo", "10:00")).toThrow(RangeError);
  });
});
