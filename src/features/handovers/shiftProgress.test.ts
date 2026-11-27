import { describe, expect, it } from "vitest";

import { spDate } from "../../../test/clock";
import { shiftProgress } from "./shiftProgress";

const DAY = { startsAt: "06:00", endsAt: "14:00" };
const NIGHT = { startsAt: "22:00", endsAt: "06:00" };
const DATE = "2026-11-21";

function at(hhmm: string) {
  return spDate(DATE, hhmm);
}

describe("shiftProgress: turno do dia (06:00–14:00)", () => {
  it("no meio: rótulos e porcentagem", () => {
    expect(shiftProgress(DAY, at("08:42"))).toEqual({
      startLabel: "06:00",
      endLabel: "14:00",
      nowLabel: "08:42",
      pct: 33.75,
    });
  });

  it("exatamente no início: 0; exatamente no fim: 100", () => {
    expect(shiftProgress(DAY, at("06:00")).pct).toBe(0);
    expect(shiftProgress(DAY, at("14:00")).pct).toBe(100);
  });

  it("um minuto depois do início e um minuto antes do fim", () => {
    expect(shiftProgress(DAY, at("06:01")).pct).toBeCloseTo(0.21, 2);
    expect(shiftProgress(DAY, at("13:59")).pct).toBeCloseTo(99.79, 2);
  });

  it("antes do início: 0 (mais perto do início do que do fim)", () => {
    expect(shiftProgress(DAY, at("05:30")).pct).toBe(0);
    expect(shiftProgress(DAY, at("00:00")).pct).toBe(0);
    expect(shiftProgress(DAY, at("23:59")).pct).toBe(0);
  });

  it("depois do fim: 100 (mais perto do fim do que do próximo início)", () => {
    expect(shiftProgress(DAY, at("14:01")).pct).toBe(100);
    expect(shiftProgress(DAY, at("15:30")).pct).toBe(100);
  });

  it("empate entre o fim e o próximo início vai para 100", () => {
    // 22:00 está a 8 h do fim (14:00) e a 8 h do próximo início (06:00).
    expect(shiftProgress(DAY, at("22:00")).pct).toBe(100);
  });
});

describe("shiftProgress: turno que cruza a meia-noite (22:00–06:00)", () => {
  it("antes da meia-noite, no turno que começou hoje", () => {
    expect(shiftProgress(NIGHT, at("23:30"))).toEqual({
      startLabel: "22:00",
      endLabel: "06:00",
      nowLabel: "23:30",
      pct: 18.75,
    });
  });

  it("depois da meia-noite, no mesmo turno", () => {
    expect(shiftProgress(NIGHT, at("00:30"))).toMatchObject({
      nowLabel: "00:30",
      pct: 31.25,
    });
    expect(shiftProgress(NIGHT, at("02:00")).pct).toBe(50);
  });

  it("meia-noite em ponto: 25%", () => {
    expect(shiftProgress(NIGHT, at("00:00")).pct).toBe(25);
  });

  it("exatamente no início (22:00): 0; exatamente no fim (06:00): 100", () => {
    expect(shiftProgress(NIGHT, at("22:00")).pct).toBe(0);
    expect(shiftProgress(NIGHT, at("06:00")).pct).toBe(100);
  });

  it("um minuto antes do início: 0; um minuto depois do fim: 100", () => {
    expect(shiftProgress(NIGHT, at("21:59")).pct).toBe(0);
    expect(shiftProgress(NIGHT, at("06:01")).pct).toBe(100);
  });

  it("no meio do dia: antes das 14:00 conta como depois do fim; depois, como antes do início", () => {
    expect(shiftProgress(NIGHT, at("10:00")).pct).toBe(100);
    expect(shiftProgress(NIGHT, at("18:00")).pct).toBe(0);
  });
});

describe("shiftProgress: fuso e formato", () => {
  it("usa a hora de parede de São Paulo, não a UTC", () => {
    // 01:30Z = 22:30 em São Paulo (dia 20): 30 min dentro do turno 22:00–06:00.
    const now = new Date("2026-11-21T01:30:00Z");

    expect(shiftProgress(NIGHT, now)).toMatchObject({
      nowLabel: "22:30",
      pct: 6.25,
    });
  });

  it("virada UTC: 02:59Z ainda é 23:59 de São Paulo", () => {
    expect(shiftProgress(DAY, new Date("2026-11-21T02:59:00Z")).nowLabel).toBe(
      "23:59",
    );
  });

  it("aceita HH:mm:00 (como vem do banco) e devolve rótulos HH:mm", () => {
    expect(
      shiftProgress({ startsAt: "06:00:00", endsAt: "14:00:00" }, at("10:00")),
    ).toEqual({
      startLabel: "06:00",
      endLabel: "14:00",
      nowLabel: "10:00",
      pct: 50,
    });
  });

  it("horário inválido lança RangeError", () => {
    expect(() =>
      shiftProgress({ startsAt: "25:00", endsAt: "14:00" }, at("10:00")),
    ).toThrow(RangeError);
    expect(() =>
      shiftProgress({ startsAt: "06:00", endsAt: "xx" }, at("10:00")),
    ).toThrow(RangeError);
  });

  it("início igual ao fim vale 24 h e nunca divide por zero", () => {
    const full = { startsAt: "06:00", endsAt: "06:00" };

    expect(shiftProgress(full, at("06:00")).pct).toBe(0);
    expect(shiftProgress(full, at("18:00")).pct).toBe(50);
  });
});

describe("shiftProgress: o pct nunca sai de 0..100 e nunca anda para trás dentro do turno", () => {
  function allMinutes(): string[] {
    return Array.from({ length: 1440 }, (_, minute) => {
      const hh = String(Math.floor(minute / 60)).padStart(2, "0");
      const mm = String(minute % 60).padStart(2, "0");
      return `${hh}:${mm}`;
    });
  }

  it.each([
    ["dia", DAY],
    ["noite", NIGHT],
  ])("turno de %s, todos os minutos do dia", (_name, shift) => {
    for (const hhmm of allMinutes()) {
      const { pct } = shiftProgress(shift, at(hhmm));
      expect(pct, hhmm).toBeGreaterThanOrEqual(0);
      expect(pct, hhmm).toBeLessThanOrEqual(100);
    }
  });

  it("dentro do turno do dia o pct só cresce", () => {
    let previous = -1;
    for (const hhmm of allMinutes().filter(
      (m) => m >= "06:00" && m <= "14:00",
    )) {
      const { pct } = shiftProgress(DAY, at(hhmm));
      expect(pct, hhmm).toBeGreaterThanOrEqual(previous);
      previous = pct;
    }
  });
});
