import { describe, expect, it } from "vitest";

import { MAX_QUANTITY } from "./limits";
import {
  formatQuantity,
  parseQuantity,
  sanitizeQuantityInput,
  stepQuantity,
} from "./quantity";

describe("sanitizeQuantityInput", () => {
  it("mantém só dígitos", () => {
    expect(sanitizeQuantityInput("12")).toBe("12");
    expect(sanitizeQuantityInput("abc")).toBe("");
    expect(sanitizeQuantityInput("1a2b3")).toBe("123");
    expect(sanitizeQuantityInput("-5")).toBe("5");
    expect(sanitizeQuantityInput("1,5")).toBe("15");
  });

  it("tira zeros à esquerda, mas preserva o zero sozinho", () => {
    expect(sanitizeQuantityInput("007")).toBe("7");
    expect(sanitizeQuantityInput("000")).toBe("0");
    expect(sanitizeQuantityInput("0")).toBe("0");
    expect(sanitizeQuantityInput("00012")).toBe("12");
  });

  it("vazio continua vazio (o campo pode ficar vazio enquanto se digita)", () => {
    expect(sanitizeQuantityInput("")).toBe("");
  });

  it("colagem com espaços e quebras vira só os dígitos", () => {
    expect(sanitizeQuantityInput(" 1 2 3 ")).toBe("123");
    expect(sanitizeQuantityInput("1\n2\t3")).toBe("123");
    expect(sanitizeQuantityInput("1\u{a0}2")).toBe("12");
  });

  it("no máximo 5 dígitos", () => {
    expect(sanitizeQuantityInput("99999")).toBe("99999");
    expect(sanitizeQuantityInput("123456")).toBe("12345");
    expect(sanitizeQuantityInput("0000123456")).toBe("12345");
  });

  it("ignora dígitos de outros alfabetos e emoji", () => {
    expect(sanitizeQuantityInput("\u{663}\u{664}")).toBe("");
    expect(sanitizeQuantityInput("5\u{1f600}")).toBe("5");
  });
});

describe("parseQuantity", () => {
  it('"" e texto sem dígitos → null', () => {
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("abc")).toBeNull();
    expect(parseQuantity("  ")).toBeNull();
  });

  it("número comum, zeros à esquerda e colagem com espaços", () => {
    expect(parseQuantity("12")).toBe(12);
    expect(parseQuantity("0")).toBe(0);
    expect(parseQuantity("007")).toBe(7);
    expect(parseQuantity(" 1 2 ")).toBe(12);
  });

  it("acima do teto vira o teto", () => {
    expect(parseQuantity("99999")).toBe(MAX_QUANTITY);
    expect(parseQuantity("100000")).toBe(MAX_QUANTITY);
    expect(parseQuantity("99999999999999999999999")).toBe(MAX_QUANTITY);
  });
});

describe("stepQuantity", () => {
  it("soma e subtrai 1", () => {
    expect(stepQuantity(5, 1)).toBe(6);
    expect(stepQuantity(5, -1)).toBe(4);
  });

  it("trava em 0 e no teto", () => {
    expect(stepQuantity(0, -1)).toBe(0);
    expect(stepQuantity(MAX_QUANTITY, 1)).toBe(MAX_QUANTITY);
    expect(stepQuantity(MAX_QUANTITY - 1, 1)).toBe(MAX_QUANTITY);
  });

  it("valor fora da faixa volta para dentro", () => {
    expect(stepQuantity(-3, 1)).toBe(0);
    expect(stepQuantity(MAX_QUANTITY + 10, -1)).toBe(MAX_QUANTITY);
  });
});

describe("formatQuantity", () => {
  it("usa o ponto como separador de milhar (pt-BR)", () => {
    expect(formatQuantity(0)).toBe("0");
    expect(formatQuantity(999)).toBe("999");
    expect(formatQuantity(1234)).toBe("1.234");
    expect(formatQuantity(99999)).toBe("99.999");
  });
});
