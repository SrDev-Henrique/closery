import { describe, expect, it } from "vitest";

import {
  appendPeriodParams,
  buildHistoryHref,
  type HistoryFilters,
  type HistoryPeriodRange,
  parseHistoryFilters,
  parseHistoryPeriod,
  SITUATION_PARAM,
} from "./historyFilters";
import { HISTORY_MAX_DAYS } from "./limits";
import { daysBetween } from "./saoPaulo";

const TODAY = "2026-11-21";
const SHIFT = "11111111-1111-4111-8111-111111111111";

const DEFAULTS: HistoryFilters = {
  period: "7",
  from: "2026-11-15",
  to: TODAY,
  shiftId: null,
  situation: "all",
};

describe("parseHistoryFilters", () => {
  it("sem parâmetros: últimos 7 dias, todos os turnos e situações", () => {
    expect(parseHistoryFilters({}, TODAY)).toEqual(DEFAULTS);
  });

  it("periodo=30: hoje − 29 até hoje; período desconhecido cai em 7", () => {
    expect(parseHistoryFilters({ periodo: "30" }, TODAY)).toEqual({
      ...DEFAULTS,
      period: "30",
      from: "2026-10-23",
    });
    expect(parseHistoryFilters({ periodo: "90" }, TODAY).period).toBe("7");
    expect(parseHistoryFilters({ periodo: "<script>" }, TODAY).period).toBe(
      "7",
    );
  });

  describe("intervalo", () => {
    function range(de: string | undefined, ate: string | undefined) {
      return parseHistoryFilters({ periodo: "intervalo", de, ate }, TODAY);
    }

    it("de e ate válidos", () => {
      expect(range("2026-11-01", "2026-11-10")).toEqual({
        ...DEFAULTS,
        period: "range",
        from: "2026-11-01",
        to: "2026-11-10",
      });
    });

    it("intervalo invertido: as pontas são trocadas", () => {
      expect(range("2026-11-10", "2026-11-01")).toMatchObject({
        period: "range",
        from: "2026-11-01",
        to: "2026-11-10",
      });
    });

    it("ate no futuro é cortado em hoje", () => {
      expect(range("2026-11-15", "2026-12-31")).toMatchObject({
        period: "range",
        from: "2026-11-15",
        to: TODAY,
      });
    });

    it("intervalo inteiro no futuro cai em 7 dias", () => {
      expect(range("2026-12-01", "2026-12-05")).toEqual(DEFAULTS);
    });

    it("ausente, pela metade ou inválido cai em 7 dias", () => {
      expect(range(undefined, undefined)).toEqual(DEFAULTS);
      expect(range("2026-11-01", undefined)).toEqual(DEFAULTS);
      expect(range(undefined, "2026-11-10")).toEqual(DEFAULTS);
      expect(range("2026-02-30", "2026-11-10")).toEqual(DEFAULTS);
      expect(range("lixo", "2026-11-10")).toEqual(DEFAULTS);
      expect(range("", "")).toEqual(DEFAULTS);
    });

    it("extensão máxima de 93 dias: corta o `de`", () => {
      const result = range("2025-01-01", "2026-11-10");
      expect(result).toMatchObject({ period: "range", to: "2026-11-10" });
      expect(daysBetween(result.from, result.to) + 1).toBe(HISTORY_MAX_DAYS);
      expect(result.from).toBe("2026-08-10");
    });

    it("de e ate só valem como texto único (array: vale o primeiro)", () => {
      const result = parseHistoryFilters(
        {
          periodo: ["intervalo", "30"],
          de: ["2026-11-01", "2026-01-01"],
          ate: ["2026-11-10"],
        },
        TODAY,
      );
      expect(result).toMatchObject({
        period: "range",
        from: "2026-11-01",
        to: "2026-11-10",
      });
    });
  });

  describe("turno", () => {
    it("aceita uuid", () => {
      expect(parseHistoryFilters({ turno: SHIFT }, TODAY).shiftId).toBe(SHIFT);
    });

    it.each([
      "lixo",
      "",
      "1",
      `${SHIFT}x`,
      "'; drop table shift; --",
    ])("recusa %j", (value) => {
      expect(parseHistoryFilters({ turno: value }, TODAY).shiftId).toBeNull();
    });
  });

  describe("situacao", () => {
    it.each(Object.entries(SITUATION_PARAM))("%s ↔ %s", (situation, param) => {
      expect(parseHistoryFilters({ situacao: param }, TODAY).situation).toBe(
        situation,
      );
    });

    it("desconhecida ou lixo cai em todas", () => {
      for (const value of ["xyz", "awaiting", "", "toString"]) {
        expect(parseHistoryFilters({ situacao: value }, TODAY).situation).toBe(
          "all",
        );
      }
    });
  });
});

describe("SITUATION_PARAM", () => {
  it("valores em pt-BR de URL", () => {
    expect(SITUATION_PARAM).toEqual({
      all: "todas",
      awaiting: "aguardando",
      confirmed: "confirmada",
      unconfirmed: "nao-confirmada",
      missing: "sem-passagem",
      corrected: "corrigida",
    });
  });
});

describe("buildHistoryHref", () => {
  it("filtros padrão: só /passagens", () => {
    expect(buildHistoryHref(DEFAULTS)).toBe("/passagens");
  });

  it("intervalo leva de e ate", () => {
    expect(
      buildHistoryHref({
        ...DEFAULTS,
        period: "range",
        from: "2026-11-01",
        to: "2026-11-10",
      }),
    ).toBe("/passagens?periodo=intervalo&de=2026-11-01&ate=2026-11-10");
  });

  it("turno, situação, setor e página, nessa ordem", () => {
    expect(
      buildHistoryHref(
        { ...DEFAULTS, shiftId: SHIFT, situation: "unconfirmed" },
        { sector: "todos", page: 3 },
      ),
    ).toBe(
      `/passagens?turno=${SHIFT}&situacao=nao-confirmada&setor=todos&pagina=3`,
    );
  });

  it("omite página 1, página inválida e setor ausente", () => {
    expect(buildHistoryHref(DEFAULTS, { page: 1 })).toBe("/passagens");
    expect(buildHistoryHref(DEFAULTS, { page: 0 })).toBe("/passagens");
    expect(buildHistoryHref(DEFAULTS, { page: -2 })).toBe("/passagens");
    expect(buildHistoryHref(DEFAULTS, {})).toBe("/passagens");
  });

  it("ida e volta: o que build escreve, parse devolve", () => {
    const filters: HistoryFilters = {
      period: "range",
      from: "2026-11-01",
      to: "2026-11-10",
      shiftId: SHIFT,
      situation: "corrected",
    };
    const href = buildHistoryHref(filters, { sector: SHIFT, page: 2 });
    const params = Object.fromEntries(new URL(href, "http://x").searchParams);
    expect(parseHistoryFilters(params, TODAY)).toEqual(filters);
  });
});

describe("parseHistoryPeriod", () => {
  const cases: Array<{
    name: string;
    params: Record<string, string | string[] | undefined>;
    expected: HistoryPeriodRange;
  }> = [
    {
      name: "ausente: últimos 7 dias",
      params: {},
      expected: { period: "7", from: "2026-11-15", to: TODAY },
    },
    {
      name: "lixo: últimos 7 dias",
      params: { periodo: "<script>" },
      expected: { period: "7", from: "2026-11-15", to: TODAY },
    },
    {
      name: "30: hoje − 29 até hoje",
      params: { periodo: "30" },
      expected: { period: "30", from: "2026-10-23", to: TODAY },
    },
    {
      name: "intervalo válido",
      params: { periodo: "intervalo", de: "2026-11-01", ate: "2026-11-10" },
      expected: { period: "range", from: "2026-11-01", to: "2026-11-10" },
    },
    {
      name: "intervalo invertido: pontas trocadas",
      params: { periodo: "intervalo", de: "2026-11-10", ate: "2026-11-01" },
      expected: { period: "range", from: "2026-11-01", to: "2026-11-10" },
    },
    {
      name: "ate no futuro: cortado em hoje",
      params: { periodo: "intervalo", de: "2026-11-15", ate: "2026-12-31" },
      expected: { period: "range", from: "2026-11-15", to: TODAY },
    },
    {
      name: "tudo no futuro: últimos 7 dias",
      params: { periodo: "intervalo", de: "2026-12-01", ate: "2026-12-31" },
      expected: { period: "7", from: "2026-11-15", to: TODAY },
    },
    {
      name: "94 dias: de encurtado para ate − 92",
      params: { periodo: "intervalo", de: "2026-08-20", ate: TODAY },
      expected: { period: "range", from: "2026-08-21", to: TODAY },
    },
    {
      name: "data irreal (2026-02-30): últimos 7 dias",
      params: { periodo: "intervalo", de: "2026-02-30", ate: "2026-03-01" },
      expected: { period: "7", from: "2026-11-15", to: TODAY },
    },
    {
      name: "intervalo sem ate: últimos 7 dias",
      params: { periodo: "intervalo", de: "2026-11-01" },
      expected: { period: "7", from: "2026-11-15", to: TODAY },
    },
    {
      name: "parâmetro repetido vale o primeiro",
      params: { periodo: ["30", "7"] },
      expected: { period: "30", from: "2026-10-23", to: TODAY },
    },
  ];

  it.each(cases)("$name", ({ params, expected }) => {
    expect(parseHistoryPeriod(params, TODAY)).toEqual(expected);
  });

  it("é o bloco de período de parseHistoryFilters, em todos os casos", () => {
    for (const { params } of cases) {
      const { period, from, to } = parseHistoryFilters(params, TODAY);
      expect({ period, from, to }).toEqual(parseHistoryPeriod(params, TODAY));
    }
  });

  it("o período de 93 dias cabe inteiro e o limite é o de HISTORY_MAX_DAYS", () => {
    const { from, to } = parseHistoryPeriod(
      { periodo: "intervalo", de: "2026-08-21", ate: TODAY },
      TODAY,
    );
    expect(daysBetween(from, to) + 1).toBe(HISTORY_MAX_DAYS);
    expect(from).toBe("2026-08-21");
  });
});

describe("appendPeriodParams", () => {
  function written(range: HistoryPeriodRange): string {
    const query = new URLSearchParams();
    appendPeriodParams(query, range);
    return query.toString();
  }

  it("7 (o padrão) não escreve nada", () => {
    expect(written({ period: "7", from: "2026-11-15", to: TODAY })).toBe("");
  });

  it("30 escreve periodo=30", () => {
    expect(written({ period: "30", from: "2026-10-23", to: TODAY })).toBe(
      "periodo=30",
    );
  });

  it("intervalo escreve periodo, de e ate, nessa ordem", () => {
    expect(
      written({ period: "range", from: "2026-11-01", to: "2026-11-10" }),
    ).toBe("periodo=intervalo&de=2026-11-01&ate=2026-11-10");
  });

  it("mantém o que já estava na query", () => {
    const query = new URLSearchParams({ setor: "x" });
    appendPeriodParams(query, { period: "30", from: "2026-10-23", to: TODAY });
    expect(query.toString()).toBe("setor=x&periodo=30");
  });

  it("ida e volta: o que escreve, parseHistoryPeriod devolve", () => {
    for (const { params } of [
      { params: {} },
      { params: { periodo: "30" } },
      {
        params: { periodo: "intervalo", de: "2026-11-01", ate: "2026-11-10" },
      },
    ]) {
      const range = parseHistoryPeriod(params, TODAY);
      const query = new URLSearchParams();
      appendPeriodParams(query, range);
      expect(parseHistoryPeriod(Object.fromEntries(query), TODAY)).toEqual(
        range,
      );
    }
  });
});
