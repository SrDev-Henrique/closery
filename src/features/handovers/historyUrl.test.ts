import { describe, expect, it } from "vitest";

import {
  buildHistoryHref,
  type HistoryFilters,
  parseHistoryFilters,
} from "./historyFilters";

const TODAY = "2026-11-21";
const SHIFT = "11111111-1111-4111-8111-111111111111";

function paramsOf(href: string): Record<string, string> {
  return Object.fromEntries(new URL(href, "http://closery.local").searchParams);
}

// O que a tela monta (buildHistoryHref) tem de voltar igual pelo servidor
// (parseHistoryFilters): a URL é a única memória dos filtros.
describe("filtros do histórico: ida e volta pela URL", () => {
  const cases: [string, HistoryFilters][] = [
    [
      "padrão (7 dias, todas, sem turno)",
      {
        period: "7",
        from: "2026-11-15",
        to: TODAY,
        shiftId: null,
        situation: "all",
      },
    ],
    [
      "30 dias",
      {
        period: "30",
        from: "2026-10-23",
        to: TODAY,
        shiftId: null,
        situation: "all",
      },
    ],
    [
      "intervalo com turno e situação",
      {
        period: "range",
        from: "2026-11-01",
        to: "2026-11-10",
        shiftId: SHIFT,
        situation: "unconfirmed",
      },
    ],
    [
      "7 dias só com situação corrigida",
      {
        period: "7",
        from: "2026-11-15",
        to: TODAY,
        shiftId: null,
        situation: "corrected",
      },
    ],
    [
      "intervalo de um dia",
      {
        period: "range",
        from: "2026-11-21",
        to: "2026-11-21",
        shiftId: null,
        situation: "missing",
      },
    ],
  ];

  it.each(cases)("%s", (_name, filters) => {
    const href = buildHistoryHref(filters);
    expect(parseHistoryFilters(paramsOf(href), TODAY)).toEqual(filters);
  });

  it("o padrão vira /passagens sem parâmetros", () => {
    expect(buildHistoryHref(parseHistoryFilters({}, TODAY))).toBe("/passagens");
  });

  it("o setor e a página acompanham os filtros, e a página 1 some", () => {
    const filters = parseHistoryFilters({ periodo: "30" }, TODAY);
    const href = buildHistoryHref(filters, { sector: "todos", page: 3 });
    expect(paramsOf(href)).toEqual({
      periodo: "30",
      setor: "todos",
      pagina: "3",
    });
    expect(paramsOf(buildHistoryHref(filters, { page: 1 }))).toEqual({
      periodo: "30",
    });
  });

  it("intervalo invertido volta na ordem certa depois de ida e volta", () => {
    const parsed = parseHistoryFilters(
      { periodo: "intervalo", de: "2026-11-10", ate: "2026-11-01" },
      TODAY,
    );
    expect(parsed.from).toBe("2026-11-01");
    expect(
      parseHistoryFilters(paramsOf(buildHistoryHref(parsed)), TODAY),
    ).toEqual(parsed);
  });
});
