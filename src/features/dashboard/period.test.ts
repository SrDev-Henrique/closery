import { describe, expect, it } from "vitest";

import { parseHistoryPeriod } from "@/features/handovers/historyFilters";
import { addDays, daysBetween } from "@/features/handovers/saoPaulo";

import {
  buildDashboardHref,
  dashboardExportHref,
  dashboardPresetHref,
  dashboardQueryOf,
  formatPeriodLabel,
  periodDays,
  previousPeriod,
  RANGE_FUTURE_MESSAGE,
  RANGE_ORDER_MESSAGE,
  RANGE_REQUIRED_MESSAGE,
  RANGE_TOO_LONG_MESSAGE,
  validateRangeInput,
} from "./period";
import type { DashboardScope } from "./types";

const TODAY = "2026-11-20";
const DASH = "\u{2013}";
const DOT = "\u{b7}";

const SEVEN = { period: "7", from: "2026-11-14", to: TODAY } as const;

describe("periodDays", () => {
  it("conta as duas pontas", () => {
    expect(periodDays({ from: TODAY, to: TODAY })).toBe(1);
    expect(periodDays({ from: "2026-11-14", to: TODAY })).toBe(7);
    expect(periodDays({ from: "2026-10-22", to: TODAY })).toBe(30);
  });

  it("atravessa a virada de mês e de ano", () => {
    expect(periodDays({ from: "2026-12-28", to: "2027-01-03" })).toBe(7);
    expect(periodDays({ from: "2028-02-27", to: "2028-03-01" })).toBe(4);
  });

  it("data irreal lança RangeError", () => {
    expect(() => periodDays({ from: "2026-02-30", to: TODAY })).toThrow(
      RangeError,
    );
  });
});

describe("previousPeriod", () => {
  it("1 dia: o dia anterior", () => {
    expect(previousPeriod({ from: TODAY, to: TODAY })).toEqual({
      from: "2026-11-19",
      to: "2026-11-19",
    });
  });

  it("7 dias: os 7 imediatamente antes", () => {
    expect(previousPeriod({ from: "2026-11-14", to: TODAY })).toEqual({
      from: "2026-11-07",
      to: "2026-11-13",
    });
  });

  it("30 dias", () => {
    expect(previousPeriod({ from: "2026-10-22", to: TODAY })).toEqual({
      from: "2026-09-22",
      to: "2026-10-21",
    });
  });

  it("93 dias: tem 93 dias e termina na véspera do início", () => {
    const range = { from: addDays(TODAY, -92), to: TODAY };
    const previous = previousPeriod(range);
    expect(periodDays(previous)).toBe(93);
    expect(previous.to).toBe(addDays(range.from, -1));
  });

  it("atravessa a virada de mês e de ano", () => {
    expect(previousPeriod({ from: "2026-12-01", to: "2026-12-07" })).toEqual({
      from: "2026-11-24",
      to: "2026-11-30",
    });
    expect(previousPeriod({ from: "2027-01-01", to: "2027-01-03" })).toEqual({
      from: "2026-12-29",
      to: "2026-12-31",
    });
  });

  it("fevereiro bissexto", () => {
    expect(previousPeriod({ from: "2028-03-01", to: "2028-03-02" })).toEqual({
      from: "2028-02-28",
      to: "2028-02-29",
    });
  });

  it("o anterior e o atual são contíguos e do mesmo tamanho (1 a 93 dias)", () => {
    for (const days of [1, 2, 7, 30, 31, 93]) {
      const range = { from: addDays(TODAY, -(days - 1)), to: TODAY };
      const previous = previousPeriod(range);
      expect(periodDays(previous)).toBe(days);
      expect(daysBetween(previous.to, range.from)).toBe(1);
    }
  });
});

describe("formatPeriodLabel", () => {
  it("7 dias no mesmo mês", () => {
    expect(formatPeriodLabel(SEVEN, TODAY)).toBe(
      `últimos 7 dias ${DOT} 14${DASH}20 nov`,
    );
  });

  it("30 dias atravessando o mês", () => {
    expect(
      formatPeriodLabel({ period: "30", from: "2026-10-22", to: TODAY }, TODAY),
    ).toBe(`últimos 30 dias ${DOT} 22 out ${DASH} 20 nov`);
  });

  it("30 dias atravessando o ano põe o ano nas duas pontas", () => {
    expect(
      formatPeriodLabel(
        { period: "30", from: "2026-12-12", to: "2027-01-10" },
        "2027-01-10",
      ),
    ).toBe(`últimos 30 dias ${DOT} 12 dez 2026 ${DASH} 10 jan 2027`);
  });

  it("intervalo em meses diferentes (sem prefixo)", () => {
    expect(
      formatPeriodLabel(
        { period: "range", from: "2026-10-28", to: "2026-11-03" },
        TODAY,
      ),
    ).toBe(`28 out ${DASH} 3 nov`);
  });

  it("intervalo em anos diferentes", () => {
    expect(
      formatPeriodLabel(
        { period: "range", from: "2026-12-28", to: "2027-01-03" },
        "2027-01-10",
      ),
    ).toBe(`28 dez 2026 ${DASH} 3 jan 2027`);
  });

  it("um dia só", () => {
    expect(
      formatPeriodLabel({ period: "range", from: TODAY, to: TODAY }, TODAY),
    ).toBe("20 nov");
  });

  it("o ano aparece no fim quando não é o de hoje", () => {
    expect(
      formatPeriodLabel(
        { period: "range", from: "2025-11-14", to: "2025-11-20" },
        TODAY,
      ),
    ).toBe(`14${DASH}20 nov 2025`);
    expect(
      formatPeriodLabel(
        { period: "range", from: "2025-11-20", to: "2025-11-20" },
        TODAY,
      ),
    ).toBe("20 nov 2025");
    expect(
      formatPeriodLabel(
        { period: "range", from: "2025-10-28", to: "2025-11-03" },
        TODAY,
      ),
    ).toBe(`28 out ${DASH} 3 nov 2025`);
  });

  it("dia sem zero à esquerda e todos os meses da tabela", () => {
    const months = [
      "jan",
      "fev",
      "mar",
      "abr",
      "mai",
      "jun",
      "jul",
      "ago",
      "set",
      "out",
      "nov",
      "dez",
    ];
    months.forEach((name, index) => {
      const month = String(index + 1).padStart(2, "0");
      expect(
        formatPeriodLabel(
          { period: "range", from: `2026-${month}-01`, to: `2026-${month}-09` },
          TODAY,
        ),
      ).toBe(`1${DASH}9 ${name}`);
    });
  });

  it("data irreal lança RangeError (nunca devolve texto torto)", () => {
    expect(() =>
      formatPeriodLabel({ period: "7", from: "2026-02-30", to: TODAY }, TODAY),
    ).toThrow(RangeError);
    expect(() => formatPeriodLabel(SEVEN, "não é data")).toThrow(RangeError);
  });

  it("o rótulo de um período que veio da URL (parse real)", () => {
    expect(formatPeriodLabel(parseHistoryPeriod({}, TODAY), TODAY)).toBe(
      `últimos 7 dias ${DOT} 14${DASH}20 nov`,
    );
    expect(
      formatPeriodLabel(
        parseHistoryPeriod(
          { periodo: "intervalo", de: "2026-11-18", ate: "2026-11-18" },
          TODAY,
        ),
        TODAY,
      ),
    ).toBe("18 nov");
  });
});

describe("validateRangeInput", () => {
  it("vazio em qualquer campo: aponta o campo vazio", () => {
    expect(validateRangeInput("", TODAY, TODAY)).toEqual({
      ok: false,
      field: "from",
      message: RANGE_REQUIRED_MESSAGE,
    });
    expect(validateRangeInput("2026-11-14", "", TODAY)).toEqual({
      ok: false,
      field: "to",
      message: RANGE_REQUIRED_MESSAGE,
    });
  });

  it("data irreal (2026-02-30) em cada campo", () => {
    expect(validateRangeInput("2026-02-30", TODAY, TODAY)).toMatchObject({
      ok: false,
      field: "from",
      message: RANGE_REQUIRED_MESSAGE,
    });
    expect(validateRangeInput("2026-11-14", "2026-02-30", TODAY)).toMatchObject(
      { ok: false, field: "to", message: RANGE_REQUIRED_MESSAGE },
    );
  });

  it("início depois do fim", () => {
    expect(validateRangeInput("2026-11-20", "2026-11-14", TODAY)).toEqual({
      ok: false,
      field: "from",
      message: RANGE_ORDER_MESSAGE,
    });
  });

  it("fim depois de hoje", () => {
    expect(validateRangeInput("2026-11-14", "2026-11-21", TODAY)).toEqual({
      ok: false,
      field: "to",
      message: RANGE_FUTURE_MESSAGE,
    });
  });

  it("94 dias reprova; 93 dias passa", () => {
    expect(validateRangeInput(addDays(TODAY, -93), TODAY, TODAY)).toEqual({
      ok: false,
      field: "from",
      message: RANGE_TOO_LONG_MESSAGE,
    });
    const from = addDays(TODAY, -92);
    expect(validateRangeInput(from, TODAY, TODAY)).toEqual({
      ok: true,
      range: { period: "range", from, to: TODAY },
    });
  });

  it("um dia (e hoje) passa", () => {
    expect(validateRangeInput(TODAY, TODAY, TODAY)).toEqual({
      ok: true,
      range: { period: "range", from: TODAY, to: TODAY },
    });
  });

  it("as mensagens são as do contrato", () => {
    expect(RANGE_REQUIRED_MESSAGE).toBe("Informe as duas datas.");
    expect(RANGE_ORDER_MESSAGE).toBe(
      "A data inicial precisa ser igual ou anterior à final.",
    );
    expect(RANGE_FUTURE_MESSAGE).toBe("Escolha datas até hoje.");
    expect(RANGE_TOO_LONG_MESSAGE).toBe(
      "O intervalo pode ter no máximo 93 dias.",
    );
  });
});

describe("hrefs do dashboard", () => {
  const range = {
    period: "range",
    from: "2026-11-01",
    to: "2026-11-10",
  } as const;
  const thirty = { period: "30", from: "2026-10-22", to: TODAY } as const;
  const SECTOR = "11111111-1111-4111-8111-111111111111";

  it("buildDashboardHref: 7 dias é o padrão e não leva parâmetro", () => {
    expect(buildDashboardHref(SEVEN)).toBe("/dashboard");
  });

  it("buildDashboardHref: 30 dias e intervalo", () => {
    expect(buildDashboardHref(thirty)).toBe("/dashboard?periodo=30");
    expect(buildDashboardHref(range)).toBe(
      "/dashboard?periodo=intervalo&de=2026-11-01&ate=2026-11-10",
    );
  });

  it("buildDashboardHref: setor por id e todos, depois do período", () => {
    expect(buildDashboardHref(SEVEN, { sector: SECTOR })).toBe(
      `/dashboard?setor=${SECTOR}`,
    );
    expect(buildDashboardHref(thirty, { sector: "todos" })).toBe(
      "/dashboard?periodo=30&setor=todos",
    );
    expect(buildDashboardHref(range, { sector: SECTOR })).toBe(
      `/dashboard?periodo=intervalo&de=2026-11-01&ate=2026-11-10&setor=${SECTOR}`,
    );
  });

  it("dashboardPresetHref", () => {
    expect(dashboardPresetHref("7")).toBe("/dashboard");
    expect(dashboardPresetHref("30")).toBe("/dashboard?periodo=30");
    expect(dashboardPresetHref("7", { sector: "todos" })).toBe(
      "/dashboard?setor=todos",
    );
    expect(dashboardPresetHref("30", { sector: SECTOR })).toBe(
      `/dashboard?periodo=30&setor=${SECTOR}`,
    );
  });

  it("dashboardExportHref usa os mesmos parâmetros, no caminho do CSV", () => {
    expect(dashboardExportHref(SEVEN)).toBe("/api/dashboard/export");
    expect(dashboardExportHref(thirty, { sector: "todos" })).toBe(
      "/api/dashboard/export?periodo=30&setor=todos",
    );
    expect(dashboardExportHref(range, { sector: SECTOR })).toBe(
      `/api/dashboard/export?periodo=intervalo&de=2026-11-01&ate=2026-11-10&setor=${SECTOR}`,
    );
  });

  it("o href relido pelo parse devolve o mesmo período (ida e volta)", () => {
    for (const period of [SEVEN, thirty, range]) {
      const query = Object.fromEntries(
        new URL(buildDashboardHref(period), "http://closery.local")
          .searchParams,
      );
      expect(parseHistoryPeriod(query, TODAY)).toEqual(period);
    }
  });
});

describe("dashboardQueryOf", () => {
  it("copia setor, período e anterior do escopo", () => {
    const scope: DashboardScope = {
      sectorId: "setor-1",
      sectorName: "ULD Teste",
      sectorParam: "setor-1",
      showSector: false,
      period: SEVEN,
      previous: { from: "2026-11-07", to: "2026-11-13" },
      days: 7,
      today: TODAY,
    };
    expect(dashboardQueryOf(scope)).toEqual({
      sectorId: "setor-1",
      period: { from: "2026-11-14", to: TODAY },
      previous: { from: "2026-11-07", to: "2026-11-13" },
    });
  });

  it("todos os setores: sectorId nulo", () => {
    const scope: DashboardScope = {
      sectorId: null,
      sectorName: null,
      sectorParam: "todos",
      showSector: true,
      period: SEVEN,
      previous: { from: "2026-11-07", to: "2026-11-13" },
      days: 7,
      today: TODAY,
    };
    expect(dashboardQueryOf(scope).sectorId).toBeNull();
  });
});
