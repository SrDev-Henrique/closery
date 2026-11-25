import { describe, expect, it } from "vitest";

import { barPercent, formatDuration, sharePercent } from "./format";

describe("formatDuration", () => {
  it("menos de meio minuto: menos de 1 min", () => {
    expect(formatDuration(0)).toBe("menos de 1 min");
    expect(formatDuration(29)).toBe("menos de 1 min");
  });

  it("meio minuto arredonda para 1 min", () => {
    expect(formatDuration(30)).toBe("1 min");
  });

  it("minutos até 59 (59 min 29 s ainda é 59 min)", () => {
    expect(formatDuration(35 * 60)).toBe("35 min");
    expect(formatDuration(59 * 60 + 29)).toBe("59 min");
  });

  it("60 min vira 1 h; horas com e sem minutos", () => {
    expect(formatDuration(60 * 60)).toBe("1 h");
    expect(formatDuration(89 * 60)).toBe("1 h 29 min");
    expect(formatDuration(5 * 3600)).toBe("5 h");
    expect(formatDuration(5 * 3600 + 20 * 60)).toBe("5 h 20 min");
  });

  it("os números do mundo de teste", () => {
    expect(formatDuration(66_000)).toBe("18 h 20 min");
    expect(formatDuration(21_600)).toBe("6 h");
    expect(formatDuration(1_800)).toBe("30 min");
    expect(formatDuration(2_100)).toBe("35 min");
    expect(formatDuration(50_025)).toBe("13 h 54 min");
  });

  it("de 24 h em diante: dias e horas, sem minutos", () => {
    expect(formatDuration(24 * 3600)).toBe("1 d");
    expect(formatDuration(25 * 3600 + 30 * 60)).toBe("1 d 1 h");
    expect(formatDuration(72 * 3600)).toBe("3 d");
    expect(formatDuration(52 * 3600)).toBe("2 d 4 h");
  });

  it("23 h 59 min ainda é horas; 23 h 59 min 30 s fecha o dia", () => {
    expect(formatDuration(23 * 3600 + 59 * 60)).toBe("23 h 59 min");
    expect(formatDuration(23 * 3600 + 59 * 60 + 30)).toBe("1 d");
  });

  it("negativo ou não finito lança RangeError", () => {
    expect(() => formatDuration(-1)).toThrow(RangeError);
    expect(() => formatDuration(Number.NaN)).toThrow(RangeError);
    expect(() => formatDuration(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("barPercent", () => {
  it("zero e máximo zero ficam em 0", () => {
    expect(barPercent(0, 10)).toBe(0);
    expect(barPercent(5, 0)).toBe(0);
    expect(barPercent(5, -1)).toBe(0);
    expect(barPercent(-3, 10)).toBe(0);
  });

  it("proporção do maior, arredondada", () => {
    expect(barPercent(5, 10)).toBe(50);
    expect(barPercent(10, 10)).toBe(100);
    expect(barPercent(1, 3)).toBe(33);
  });

  it("valor positivo nunca some: piso de 2%", () => {
    expect(barPercent(1, 1000)).toBe(2);
  });

  it("nunca passa de 100%", () => {
    expect(barPercent(20, 10)).toBe(100);
  });
});

describe("sharePercent", () => {
  it("total zero ou negativo: 0", () => {
    expect(sharePercent(5, 0)).toBe(0);
    expect(sharePercent(5, -2)).toBe(0);
  });

  it("participação inteira", () => {
    expect(sharePercent(1, 4)).toBe(25);
    expect(sharePercent(2, 3)).toBe(67);
    expect(sharePercent(0, 10)).toBe(0);
    expect(sharePercent(10, 10)).toBe(100);
  });
});
