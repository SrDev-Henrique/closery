import { describe, expect, it } from "vitest";

import { spDate } from "../../../test/clock";
import {
  addDays,
  daysBetween,
  formatDateAtTimeBR,
  formatDateBR,
  formatTimeBR,
  isIsoDate,
  isOperationalDateAllowed,
  saoPauloParts,
} from "./saoPaulo";

describe("saoPauloParts", () => {
  it("devolve dia e minutos em hora de parede (17:05Z = 14:05)", () => {
    expect(saoPauloParts(new Date("2026-11-20T17:05:00Z"))).toEqual({
      date: "2026-11-20",
      minutes: 14 * 60 + 5,
    });
  });

  it("virada UTC: 02:59Z ainda é 23:59 do dia anterior; 03:00Z já é 00:00", () => {
    expect(saoPauloParts(new Date("2026-11-21T02:59:00Z"))).toEqual({
      date: "2026-11-20",
      minutes: 1439,
    });
    expect(saoPauloParts(new Date("2026-11-21T03:00:00Z"))).toEqual({
      date: "2026-11-21",
      minutes: 0,
    });
  });
});

describe("isIsoDate", () => {
  it.each([
    "2026-11-21",
    "2024-02-29",
    "2026-12-31",
    "2026-01-01",
  ])("aceita %s", (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  it.each([
    ["2026-02-30", "30 de fevereiro"],
    ["2026-02-29", "29/02 em ano comum"],
    ["2026-13-01", "mês 13"],
    ["2026-00-10", "mês 0"],
    ["2026-11-00", "dia 0"],
    ["2026-11-31", "31 de novembro"],
    ["2026-1-5", "sem zero à esquerda"],
    ["20261121", "sem hífens"],
    ["2026-11-21T10:00", "com hora"],
    [" 2026-11-21", "com espaço"],
    ["2026-11-21\n", "com quebra de linha"],
    ["", "vazio"],
    ["lixo", "texto"],
  ])("recusa %s (%s)", (value) => {
    expect(isIsoDate(value)).toBe(false);
  });
});

describe("addDays", () => {
  it("avança para o mês e o ano seguintes", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("aceita negativo e zero", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-11-21", 0)).toBe("2026-11-21");
    expect(addDays("2026-11-21", -31)).toBe("2026-10-21");
  });

  it("lança RangeError para data inválida", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
    expect(() => addDays("lixo", 1)).toThrow(RangeError);
  });
});

describe("daysBetween", () => {
  it("conta dias inteiros de from até to (negativo se to é anterior)", () => {
    expect(daysBetween("2026-11-21", "2026-11-21")).toBe(0);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-10-21", "2026-11-21")).toBe(31);
    expect(daysBetween("2026-11-21", "2026-11-18")).toBe(-3);
  });

  it("lança RangeError para data inválida", () => {
    expect(() => daysBetween("2026-02-30", "2026-03-01")).toThrow(RangeError);
  });
});

describe("isOperationalDateAllowed", () => {
  const now = spDate("2026-11-21", "10:00");

  it("aceita hoje e os últimos 31 dias", () => {
    expect(isOperationalDateAllowed("2026-11-21", now)).toBe(true);
    expect(isOperationalDateAllowed("2026-11-20", now)).toBe(true);
    expect(isOperationalDateAllowed("2026-10-21", now)).toBe(true);
  });

  it("recusa 32 dias atrás e a data futura", () => {
    expect(isOperationalDateAllowed("2026-10-20", now)).toBe(false);
    expect(isOperationalDateAllowed("2026-11-22", now)).toBe(false);
  });

  it("recusa data inexistente e lixo", () => {
    expect(isOperationalDateAllowed("2026-02-30", now)).toBe(false);
    expect(isOperationalDateAllowed("lixo", now)).toBe(false);
    expect(isOperationalDateAllowed("", now)).toBe(false);
  });

  it("hoje é o dia de São Paulo, não o de UTC (02:59Z × 03:00Z)", () => {
    const before = new Date("2026-11-21T02:59:00Z");
    const after = new Date("2026-11-21T03:00:00Z");
    expect(isOperationalDateAllowed("2026-11-21", before)).toBe(false);
    expect(isOperationalDateAllowed("2026-11-20", before)).toBe(true);
    expect(isOperationalDateAllowed("2026-11-21", after)).toBe(true);
  });
});

describe("formatTimeBR", () => {
  it("mostra HH:mm em São Paulo", () => {
    expect(formatTimeBR(new Date("2026-11-20T17:05:00Z"))).toBe("14:05");
    expect(formatTimeBR(new Date("2026-11-21T03:00:00Z"))).toBe("00:00");
    expect(formatTimeBR(new Date("2026-11-21T02:59:00Z"))).toBe("23:59");
  });
});

describe("formatDateBR", () => {
  it("reformata o texto, sem passar por Date", () => {
    expect(formatDateBR("2026-11-21")).toBe("21/11/2026");
    expect(formatDateBR("2026-01-05")).toBe("05/01/2026");
  });

  it("lança RangeError para data inválida", () => {
    expect(() => formatDateBR("2026-02-30")).toThrow(RangeError);
    expect(() => formatDateBR("21/11/2026")).toThrow(RangeError);
  });
});

describe("formatDateAtTimeBR", () => {
  it("junta o dia e a hora de São Paulo", () => {
    expect(formatDateAtTimeBR(new Date("2026-11-21T10:05:00Z"))).toBe(
      "21/11/2026 às 07:05",
    );
  });

  it("a virada do dia é a de São Paulo, não a de UTC (02:59Z × 03:00Z)", () => {
    expect(formatDateAtTimeBR(new Date("2026-11-21T02:59:00Z"))).toBe(
      "20/11/2026 às 23:59",
    );
    expect(formatDateAtTimeBR(new Date("2026-11-21T03:00:00Z"))).toBe(
      "21/11/2026 às 00:00",
    );
  });

  it("vira de ano em São Paulo", () => {
    expect(formatDateAtTimeBR(new Date("2027-01-01T02:59:00Z"))).toBe(
      "31/12/2026 às 23:59",
    );
  });
});
