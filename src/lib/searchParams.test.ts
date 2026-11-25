import { describe, expect, it } from "vitest";

import { firstValue, paginationParams } from "@/lib/searchParams";

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

describe("paginationParams", () => {
  it("devolve os parâmetros do href como objeto", () => {
    expect(paginationParams("/passagens?periodo=30&setor=x")).toEqual({
      periodo: "30",
      setor: "x",
    });
  });

  it("href sem query devolve objeto vazio", () => {
    expect(paginationParams("/passagens")).toEqual({});
    expect(paginationParams("/passagens?")).toEqual({});
  });

  it("decodifica acento e espaço", () => {
    expect(
      paginationParams("/solicitacoes?busca=rede%20de%20prote%C3%A7%C3%A3o"),
    ).toEqual({
      busca: "rede de proteção",
    });
  });

  it("parâmetro repetido vale o último (o que o Object.fromEntries faz hoje)", () => {
    expect(paginationParams("/x?a=1&a=2")).toEqual({ a: "2" });
  });
});
