import { describe, expect, it } from "vitest";

import { formatDateTimeBR } from "@/lib/dateTime";

describe("formatDateTimeBR", () => {
  it("formata dia/mês/ano e hora no fuso de São Paulo", () => {
    expect(formatDateTimeBR(new Date("2026-11-28T17:30:00Z"))).toBe(
      "28/11/2026, 14:30",
    );
  });

  it("meia-noite em São Paulo é 03:00 UTC: 00:00 do mesmo dia", () => {
    expect(formatDateTimeBR(new Date("2026-11-28T03:00:00Z"))).toBe(
      "28/11/2026, 00:00",
    );
  });

  it("um minuto antes da meia-noite ainda é o dia anterior", () => {
    expect(formatDateTimeBR(new Date("2026-11-28T02:59:00Z"))).toBe(
      "27/11/2026, 23:59",
    );
  });

  it("vira o ano no fuso de São Paulo, não no UTC", () => {
    expect(formatDateTimeBR(new Date("2027-01-01T02:00:00Z"))).toBe(
      "31/12/2026, 23:00",
    );
  });
});
