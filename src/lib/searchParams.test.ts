import { describe, expect, it } from "vitest";

import { firstValue } from "@/lib/searchParams";

describe("firstValue", () => {
  it("devolve o texto como veio", () => {
    expect(firstValue("a")).toBe("a");
    expect(firstValue("")).toBe("");
  });

  it("parâmetro ausente continua undefined", () => {
    expect(firstValue(undefined)).toBeUndefined();
  });

  it("parâmetro repetido vale o primeiro", () => {
    expect(firstValue(["a", "b"])).toBe("a");
    expect(firstValue(["só"])).toBe("só");
  });

  it("lista vazia vira undefined", () => {
    expect(firstValue([])).toBeUndefined();
  });
});
