import { describe, expect, it } from "vitest";

import {
  formatTimeOfDay,
  fromDbTime,
  MINUTES_PER_DAY,
  parseTimeOfDay,
  TIME_INPUT_PATTERN,
  toDbTime,
} from "@/features/admin/timeOfDay";

describe("parseTimeOfDay", () => {
  it("converte HH:mm em minutos, nos limites do dia", () => {
    expect(parseTimeOfDay("00:00")).toBe(0);
    expect(parseTimeOfDay("06:00")).toBe(360);
    expect(parseTimeOfDay("23:59")).toBe(1439);
  });

  it("aceita HH:mm:00 (o formato do banco)", () => {
    expect(parseTimeOfDay("06:00:00")).toBe(360);
    expect(parseTimeOfDay("00:00:00")).toBe(0);
  });

  it("recusa 24:00, hora sem zero, minuto 60, segundos e lixo", () => {
    for (const value of [
      "24:00",
      "6:00",
      "06:60",
      "06:00:30",
      "06:00:00:00",
      "0600",
      "ab:cd",
      "",
      " 06:00",
    ]) {
      expect(parseTimeOfDay(value), value).toBeNull();
    }
  });
});

describe("TIME_INPUT_PATTERN", () => {
  it("só casa HH:mm", () => {
    expect(TIME_INPUT_PATTERN.test("22:15")).toBe(true);
    expect(TIME_INPUT_PATTERN.test("22:15:00")).toBe(false);
    expect(TIME_INPUT_PATTERN.test("2:15")).toBe(false);
  });
});

describe("formatTimeOfDay", () => {
  it("formata com zeros à esquerda", () => {
    expect(formatTimeOfDay(0)).toBe("00:00");
    expect(formatTimeOfDay(65)).toBe("01:05");
    expect(formatTimeOfDay(1439)).toBe("23:59");
  });

  it("dá a volta no dia (módulo 1440), inclusive para negativos", () => {
    expect(MINUTES_PER_DAY).toBe(1440);
    expect(formatTimeOfDay(1440)).toBe("00:00");
    expect(formatTimeOfDay(1440 + 90)).toBe("01:30");
    expect(formatTimeOfDay(-60)).toBe("23:00");
  });
});

describe("toDbTime / fromDbTime", () => {
  it("toDbTime acrescenta os segundos", () => {
    expect(toDbTime("06:00")).toBe("06:00:00");
    expect(toDbTime("23:59")).toBe("23:59:00");
  });

  it("toDbTime lança RangeError para horário inválido", () => {
    expect(() => toDbTime("24:00")).toThrow(RangeError);
    expect(() => toDbTime("")).toThrow(RangeError);
  });

  it("fromDbTime tira os segundos e deixa HH:mm como está", () => {
    expect(fromDbTime("06:00:00")).toBe("06:00");
    expect(fromDbTime("22:00:00")).toBe("22:00");
    expect(fromDbTime("06:00")).toBe("06:00");
  });

  it("fromDbTime lança RangeError para o que não é horário", () => {
    expect(() => fromDbTime("lixo")).toThrow(RangeError);
    expect(() => fromDbTime("06:00:30")).toThrow(RangeError);
  });

  it("ida e volta preserva o horário", () => {
    expect(fromDbTime(toDbTime("13:45"))).toBe("13:45");
  });
});
