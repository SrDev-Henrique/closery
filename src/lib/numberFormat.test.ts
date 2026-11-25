import { describe, expect, it } from "vitest";

import { formatDecimal, formatInteger } from "@/lib/numberFormat";

describe("formatInteger", () => {
  it("agrupa os milhares com ponto", () => {
    expect(formatInteger(1234)).toBe("1.234");
    expect(formatInteger(99_999)).toBe("99.999");
    expect(formatInteger(1_000_000)).toBe("1.000.000");
  });

  it("zero e números pequenos ficam como são", () => {
    expect(formatInteger(0)).toBe("0");
    expect(formatInteger(7)).toBe("7");
  });

  it("não mostra casas decimais", () => {
    expect(formatInteger(12.4)).toBe("12");
  });
});

describe("formatDecimal", () => {
  it("usa vírgula e uma casa quando ela existe", () => {
    expect(formatDecimal(12.5)).toBe("12,5");
    expect(formatDecimal(3.6)).toBe("3,6");
  });

  it("inteiro não ganha casa", () => {
    expect(formatDecimal(12)).toBe("12");
    expect(formatDecimal(0)).toBe("0");
  });

  it("arredonda para uma casa", () => {
    expect(formatDecimal(0.05)).toBe("0,1");
    expect(formatDecimal(2.34)).toBe("2,3");
  });

  it("agrupa os milhares", () => {
    expect(formatDecimal(1234.5)).toBe("1.234,5");
  });
});
