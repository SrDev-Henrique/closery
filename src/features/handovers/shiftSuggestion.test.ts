import { describe, expect, it } from "vitest";

import { spDate } from "../../../test/clock";
import {
  hasShiftEnded,
  resolveHandoverTarget,
  type SuggestableShift,
  shiftEnd,
  suggestShift,
} from "./shiftSuggestion";

const shift = (id: string, startsAt: string, endsAt: string) => ({
  id,
  startsAt,
  endsAt,
});
const MANHA = shift("manha", "06:00", "14:00");
const TARDE = shift("tarde", "14:00", "22:00");
const NOITE = shift("noite", "22:00", "06:00");
const SHIFTS: SuggestableShift[] = [MANHA, TARDE, NOITE];
const TODAY = "2026-11-21";
const YESTERDAY = "2026-11-20";
const at = (hhmm: string, date = TODAY) => spDate(date, hhmm);

describe("shiftEnd", () => {
  it.each([
    [MANHA, "2026-11-20", "2026-11-20", 840],
    [NOITE, "2026-11-20", "2026-11-21", 360],
    [shift("x", "18:00", "00:00"), "2026-11-30", "2026-12-01", 0],
    [shift("x", "06:00:00", "14:00:00"), "2026-11-20", "2026-11-20", 840],
  ])("turno %j começando em %s", (turn, date, endDate, minutes) => {
    expect(shiftEnd(date, turn)).toEqual({ date: endDate, minutes });
  });

  it("lança RangeError para horário inválido", () => {
    expect(() => shiftEnd("2026-11-20", shift("x", "06:00", "25:00"))).toThrow(
      RangeError,
    );
  });
});

describe("hasShiftEnded", () => {
  it.each([
    [MANHA, YESTERDAY, YESTERDAY, "13:59", false],
    [MANHA, YESTERDAY, YESTERDAY, "14:00", true],
    [MANHA, YESTERDAY, YESTERDAY, "14:01", true],
    [NOITE, YESTERDAY, YESTERDAY, "23:59", false],
    [NOITE, YESTERDAY, TODAY, "05:59", false],
    [NOITE, YESTERDAY, TODAY, "06:00", true],
    [MANHA, "2026-11-22", TODAY, "23:59", false],
    [MANHA, "2026-11-01", TODAY, "00:00", true],
  ])("turno %j no dia %s, agora %s %s: encerrado = %s", (turn, day, nowDay, nowTime, ended) => {
    expect(hasShiftEnded(day, turn, at(nowTime, nowDay))).toBe(ended);
  });

  it("segundos não mudam o fim e a virada UTC usa o dia de São Paulo", () => {
    expect(
      hasShiftEnded(YESTERDAY, MANHA, new Date("2026-11-20T16:59:59.999Z")),
    ).toBe(false);
    expect(
      hasShiftEnded(YESTERDAY, MANHA, new Date("2026-11-20T17:00:00.000Z")),
    ).toBe(true);
    const late = shift("x", "18:00", "23:59");
    expect(
      hasShiftEnded(YESTERDAY, late, new Date("2026-11-21T02:58:00Z")),
    ).toBe(false);
    expect(
      hasShiftEnded(YESTERDAY, late, new Date("2026-11-21T02:59:00Z")),
    ).toBe(true);
  });
});

describe("suggestShift", () => {
  it.each([
    ["14:05", TODAY, "manha", TODAY],
    ["06:05", TODAY, "noite", YESTERDAY],
    ["14:00", TODAY, "manha", TODAY],
    ["22:00", TODAY, "tarde", TODAY],
    ["23:30", TODAY, "tarde", TODAY],
    ["00:10", TODAY, "tarde", YESTERDAY],
    ["00:10", "2026-01-01", "tarde", "2025-12-31"],
  ])("às %s de %s: %s no dia %s", (time, day, shiftId, operationalDate) => {
    expect(suggestShift(SHIFTS, at(time, day))).toEqual({
      shiftId,
      operationalDate,
    });
  });

  it("sem turnos devolve null", () => {
    expect(suggestShift([], at("10:00"))).toBeNull();
  });

  it("com um turno só escolhe o fim mais próximo entre ontem e hoje", () => {
    expect(suggestShift([MANHA], at("09:00"))).toEqual({
      shiftId: "manha",
      operationalDate: TODAY,
    });
    expect(suggestShift([MANHA], at("00:10"))).toEqual({
      shiftId: "manha",
      operationalDate: YESTERDAY,
    });
    expect(suggestShift([NOITE], at("12:00"))).toEqual({
      shiftId: "noite",
      operationalDate: YESTERDAY,
    });
  });

  it("nunca sugere um dia operacional futuro (turno de amanhã)", () => {
    const early = shift("x", "00:30", "08:00");
    expect(suggestShift([early], at("23:50"))).toEqual({
      shiftId: "x",
      operationalDate: TODAY,
    });
  });

  it("empate de fim igual: vence o primeiro da lista", () => {
    const first = shift("a", "06:00", "14:00");
    const second = shift("b", "10:00", "14:00");
    expect(suggestShift([first, second], at("14:00"))?.shiftId).toBe("a");
    expect(suggestShift([second, first], at("14:00"))?.shiftId).toBe("b");
  });

  it("empate passado × futuro: o que já terminou vence, em qualquer ordem", () => {
    const ended = shift("passado", "05:00", "13:00");
    const upcoming = shift("futuro", "07:00", "15:00");
    expect(suggestShift([upcoming, ended], at("14:00"))?.shiftId).toBe(
      "passado",
    );
    expect(suggestShift([ended, upcoming], at("14:00"))?.shiftId).toBe(
      "passado",
    );
  });

  it("virada UTC: 02:59Z e 03:00Z de um turno que termina às 23:59", () => {
    const last = shift("z", "18:00", "23:59");
    for (const iso of ["2026-11-21T02:59:00Z", "2026-11-21T03:00:00Z"]) {
      expect(suggestShift([last], new Date(iso))).toEqual({
        shiftId: "z",
        operationalDate: YESTERDAY,
      });
    }
  });
});

describe("resolveHandoverTarget", () => {
  const now = at("14:05");
  const suggestion = {
    shiftId: "manha",
    operationalDate: TODAY,
    suggested: true,
  };

  it("turno e data válidos: usa o pedido; 31 dias atrás ainda vale", () => {
    for (const date of ["2026-11-19", "2026-10-21"]) {
      expect(
        resolveHandoverTarget(SHIFTS, now, { shiftId: "noite", date }),
      ).toEqual({ shiftId: "noite", operationalDate: date, suggested: false });
    }
  });

  it.each([
    ["sem parâmetros", {}],
    ["turno de outro setor", { shiftId: "outro", date: YESTERDAY }],
    ["data futura", { shiftId: "tarde", date: "2026-11-22" }],
    ["32 dias atrás", { shiftId: "tarde", date: "2026-10-20" }],
    ["data inexistente", { shiftId: "tarde", date: "2026-02-30" }],
    ["data malformada", { shiftId: "tarde", date: "ontem" }],
    ["só o turno", { shiftId: "tarde" }],
    ["só a data", { date: "2026-11-19" }],
    ["arrays com lixo no primeiro", { shiftId: ["lixo", "tarde"], date: [] }],
  ])("%s: sugere", (_label, requested) => {
    expect(resolveHandoverTarget(SHIFTS, now, requested)).toEqual(suggestion);
  });

  it("parâmetro repetido (array): vale o primeiro valor", () => {
    expect(
      resolveHandoverTarget(SHIFTS, now, {
        shiftId: ["noite", "tarde"],
        date: ["2026-11-19", "2026-11-20"],
      }),
    ).toEqual({
      shiftId: "noite",
      operationalDate: "2026-11-19",
      suggested: false,
    });
  });

  it("sem turnos: null, mesmo com parâmetros", () => {
    expect(resolveHandoverTarget([], now, {})).toBeNull();
    expect(
      resolveHandoverTarget([], now, { shiftId: "manha", date: TODAY }),
    ).toBeNull();
  });

  it("a data de UTC não vale enquanto em São Paulo ainda é o dia anterior", () => {
    const request = { shiftId: "manha", date: TODAY };
    const before = new Date("2026-11-21T02:59:00Z");
    const after = new Date("2026-11-21T03:00:00Z");
    expect(resolveHandoverTarget(SHIFTS, before, request)?.suggested).toBe(
      true,
    );
    expect(resolveHandoverTarget(SHIFTS, after, request)?.suggested).toBe(
      false,
    );
  });
});
