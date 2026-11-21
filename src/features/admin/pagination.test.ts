import { describe, expect, it } from "vitest";

import {
  buildPageHref,
  CHOICE_LIST_LIMIT,
  MAX_PAGE,
  PAGE_SIZE,
  parsePage,
  resolvePage,
} from "@/features/admin/pagination";

describe("constantes", () => {
  it("valem o que o contrato diz", () => {
    expect(PAGE_SIZE).toBe(50);
    expect(CHOICE_LIST_LIMIT).toBe(200);
    expect(MAX_PAGE).toBe(10_000);
  });
});

describe("parsePage", () => {
  it("lê um inteiro positivo, inclusive dentro de um array", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2"])).toBe(2);
    expect(parsePage(["2", "5"])).toBe(2);
    expect(parsePage(String(MAX_PAGE))).toBe(MAX_PAGE);
  });

  it("lixo, zero, negativo, decimal, vazio e ausente viram 1", () => {
    for (const raw of [
      "abc",
      "0",
      "-1",
      "2.5",
      "1e3",
      " 2",
      "2 ",
      "",
      "+3",
      "٣",
      undefined,
      [],
    ]) {
      expect(parsePage(raw), String(raw)).toBe(1);
    }
  });

  it("acima do teto vira 1 (e um número gigante também)", () => {
    expect(parsePage(String(MAX_PAGE + 1))).toBe(1);
    expect(parsePage("99999999999999999999999")).toBe(1);
  });
});

describe("resolvePage", () => {
  it("sem registros: página 1 de 1", () => {
    expect(resolvePage(0, 1)).toEqual({ page: 1, pageCount: 1, offset: 0 });
  });

  it("exatamente uma página cheia: 50 registros = 1 página; 51 = 2", () => {
    expect(resolvePage(50, 1).pageCount).toBe(1);
    expect(resolvePage(51, 1).pageCount).toBe(2);
  });

  it("calcula o deslocamento da página pedida", () => {
    expect(resolvePage(120, 3)).toEqual({ page: 3, pageCount: 3, offset: 100 });
    expect(resolvePage(120, 2).offset).toBe(50);
  });

  it("página além do fim é clampada para a última (nunca vazia por engano)", () => {
    expect(resolvePage(120, 99)).toEqual({
      page: 3,
      pageCount: 3,
      offset: 100,
    });
    expect(resolvePage(0, 5)).toEqual({ page: 1, pageCount: 1, offset: 0 });
  });

  it("página abaixo de 1 e total negativo são tratados como o mínimo", () => {
    expect(resolvePage(120, 0).page).toBe(1);
    expect(resolvePage(120, -4).page).toBe(1);
    expect(resolvePage(-10, 1)).toEqual({ page: 1, pageCount: 1, offset: 0 });
  });
});

describe("buildPageHref", () => {
  it("página 1 remove o parâmetro", () => {
    expect(buildPageHref("/admin/setores", {}, "pagina", 1)).toBe(
      "/admin/setores",
    );
  });

  it("página 2 acrescenta o parâmetro", () => {
    expect(buildPageHref("/admin/setores", {}, "pagina", 2)).toBe(
      "/admin/setores?pagina=2",
    );
  });

  it("preserva o setor e os outros parâmetros", () => {
    expect(
      buildPageHref(
        "/admin/turnos",
        { setor: "abc-123", pagina: "9" },
        "pagina",
        3,
      ),
    ).toBe("/admin/turnos?setor=abc-123&pagina=3");
    expect(
      buildPageHref(
        "/admin/turnos",
        { setor: "abc-123", pagina: "9" },
        "pagina",
        1,
      ),
    ).toBe("/admin/turnos?setor=abc-123");
  });

  it("ignora parâmetros indefinidos", () => {
    expect(
      buildPageHref("/admin/turnos", { setor: undefined }, "pagina", 2),
    ).toBe("/admin/turnos?pagina=2");
  });

  it("codifica os valores", () => {
    expect(
      buildPageHref("/admin/equipe", { busca: "a&b=c d" }, "convites", 2),
    ).toBe("/admin/equipe?busca=a%26b%3Dc+d&convites=2");
  });

  it("na Equipe, trocar uma lista mantém a página da outra", () => {
    expect(buildPageHref("/admin/equipe", { pagina: "2" }, "convites", 3)).toBe(
      "/admin/equipe?pagina=2&convites=3",
    );
  });
});
