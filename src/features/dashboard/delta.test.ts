import { describe, expect, it } from "vitest";

import { computeDelta, deltaAriaLabel, deltaText } from "./delta";

const MINUS = "\u{2212}";
const EM_DASH = "\u{2014}";

describe("computeDelta", () => {
  it("anterior 0 não tem comparação, com atual 0 ou 5", () => {
    expect(computeDelta(0, 0)).toEqual({ kind: "none" });
    expect(computeDelta(5, 0)).toEqual({ kind: "none" });
  });

  it("iguais: same", () => {
    expect(computeDelta(7, 7)).toEqual({ kind: "same" });
  });

  it("subiu e desceu em porcentagem inteira", () => {
    expect(computeDelta(12, 10)).toEqual({ kind: "up", percent: 20 });
    expect(computeDelta(8, 10)).toEqual({ kind: "down", percent: 20 });
  });

  it("5 → 0 é queda de 100%", () => {
    expect(computeDelta(0, 5)).toEqual({ kind: "down", percent: 100 });
  });

  it("variação menor que 0,5% arredonda para 0 (mas continua up/down)", () => {
    expect(computeDelta(1003, 1000)).toEqual({ kind: "up", percent: 0 });
    expect(computeDelta(997, 1000)).toEqual({ kind: "down", percent: 0 });
  });

  it("arredonda .5 para cima, igual na subida e na queda", () => {
    expect(computeDelta(9, 8)).toEqual({ kind: "up", percent: 13 });
    expect(computeDelta(7, 8)).toEqual({ kind: "down", percent: 13 });
  });

  it("números do mundo de teste: Rede 35 vs 6 e Cinta 36 vs 9", () => {
    expect(computeDelta(35, 6)).toEqual({ kind: "up", percent: 483 });
    expect(computeDelta(36, 9)).toEqual({ kind: "up", percent: 300 });
    expect(computeDelta(6, 5)).toEqual({ kind: "up", percent: 20 });
  });
});

describe("deltaText", () => {
  it("sobe, desce, igual e sem comparação", () => {
    expect(deltaText({ kind: "up", percent: 12 })).toBe(
      "+12% vs período anterior",
    );
    expect(deltaText({ kind: "down", percent: 8 })).toBe(
      `${MINUS}8% vs período anterior`,
    );
    expect(deltaText({ kind: "same" })).toBe("igual ao período anterior");
    expect(deltaText({ kind: "none" })).toBe(`${EM_DASH} vs período anterior`);
  });

  it("variação < 1% nunca vira +0%", () => {
    expect(deltaText({ kind: "up", percent: 0 })).toBe(
      "+<1% vs período anterior",
    );
    expect(deltaText({ kind: "down", percent: 0 })).toBe(
      `${MINUS}<1% vs período anterior`,
    );
  });

  it("o número usa o separador de milhar pt-BR", () => {
    expect(deltaText({ kind: "up", percent: 1250 })).toBe(
      "+1.250% vs período anterior",
    );
  });

  it("o sinal de menos é U+2212, não o hífen", () => {
    expect(deltaText({ kind: "down", percent: 3 }).startsWith("-")).toBe(false);
    expect(deltaText({ kind: "down", percent: 3 }).charCodeAt(0)).toBe(0x2212);
  });
});

describe("deltaAriaLabel", () => {
  it("sem comparação diz por quê", () => {
    expect(deltaAriaLabel({ kind: "none" })).toBe(
      "Sem dados no período anterior para comparar",
    );
  });

  it("nos outros casos é o próprio texto", () => {
    expect(deltaAriaLabel({ kind: "up", percent: 12 })).toBe(
      "+12% vs período anterior",
    );
    expect(deltaAriaLabel({ kind: "same" })).toBe("igual ao período anterior");
  });
});
