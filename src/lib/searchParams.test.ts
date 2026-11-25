import { describe, expect, it } from "vitest";

import {
  firstValue,
  hrefQuery,
  paginationParams,
  queryRecord,
} from "@/lib/searchParams";

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

describe("queryRecord", () => {
  it("lê o query como objeto", () => {
    expect(queryRecord("periodo=30&setor=x")).toEqual({
      periodo: "30",
      setor: "x",
    });
  });

  it("aceita o ? inicial", () => {
    expect(queryRecord("?periodo=30")).toEqual({ periodo: "30" });
  });

  it("vazio, só ? e sem valor", () => {
    expect(queryRecord("")).toEqual({});
    expect(queryRecord("?")).toEqual({});
    expect(queryRecord("busca=")).toEqual({ busca: "" });
  });

  it("parâmetro repetido vale o primeiro (como firstValue)", () => {
    expect(queryRecord("a=1&a=2")).toEqual({ a: "1" });
  });

  it("decodifica acento, espaço e +", () => {
    expect(queryRecord("busca=rede%20de%20prote%C3%A7%C3%A3o")).toEqual({
      busca: "rede de proteção",
    });
    expect(queryRecord("busca=a+b")).toEqual({ busca: "a b" });
  });

  it("nome de parâmetro que existe em Object.prototype é um parâmetro como outro qualquer", () => {
    const record = queryRecord("constructor=1&__proto__=2&toString=3");
    expect(Object.keys(record).sort()).toEqual([
      "__proto__",
      "constructor",
      "toString",
    ]);
    expect(Object.getPrototypeOf(record)).toBe(Object.prototype);
  });
});

describe("hrefQuery", () => {
  it("devolve o que vem depois do ?", () => {
    expect(hrefQuery("/passagens?periodo=30&setor=x")).toBe(
      "periodo=30&setor=x",
    );
  });

  it("href sem query devolve texto vazio", () => {
    expect(hrefQuery("/passagens")).toBe("");
    expect(hrefQuery("/passagens?")).toBe("");
  });

  it("combina com queryRecord", () => {
    expect(queryRecord(hrefQuery("/solicitacoes?visao=tabela"))).toEqual({
      visao: "tabela",
    });
  });
});
