import { describe, expect, it } from "vitest";

import {
  buildHistoryHref,
  type HistoryFilters,
  parseHistoryFilters,
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
