import {
  appendPeriodParams,
  type HistoryPeriodRange,
} from "@/features/handovers/historyFilters";
import { HISTORY_MAX_DAYS } from "@/features/handovers/limits";
import { addDays, daysBetween, isIsoDate } from "@/features/handovers/saoPaulo";

import { DASHBOARD_EXPORT_PATH, DASHBOARD_PATH } from "./limits";
import type { DashboardQuery, DashboardScope, DateRange } from "./types";

// Tabela fixa: o Intl.formatRange do pt-BR dá "14 – 20 de nov.", que não é o
// formato da tela.
const MONTHS = [
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
] as const;

const EN_DASH = "\u{2013}";
const MIDDLE_DOT = "\u{b7}";

/** Quantidade de dias do intervalo, as duas pontas contadas. */
export function periodDays(range: DateRange): number {
  return daysBetween(range.from, range.to) + 1;
}

/** Os N dias imediatamente antes do início do intervalo. */
export function previousPeriod(range: DateRange): DateRange {
  const days = periodDays(range);
  return {
    from: addDays(range.from, -days),
    to: addDays(range.from, -1),
  };
}

type DateParts = { year: string; month: number; day: number };

// Só reformata o texto ISO (nunca passa por Date): data irreal lança.
function partsOf(isoDate: string): DateParts {
  if (!isIsoDate(isoDate)) {
    throw new RangeError(`Data inválida: "${isoDate}"`);
  }
  return {
    year: isoDate.slice(0, 4),
    month: Number(isoDate.slice(5, 7)),
    day: Number(isoDate.slice(8, 10)),
  };
}

function monthName(month: number): string {
  return MONTHS[month - 1] ?? "";
}

function dayAndMonth(parts: DateParts): string {
  return `${parts.day} ${monthName(parts.month)}`;
}

function rangeText(from: DateParts, to: DateParts, todayYear: string): string {
  if (from.year !== to.year) {
    return `${dayAndMonth(from)} ${from.year} ${EN_DASH} ${dayAndMonth(to)} ${to.year}`;
  }
  const suffix = to.year === todayYear ? "" : ` ${to.year}`;
  if (from.month === to.month && from.day === to.day) {
    return `${dayAndMonth(to)}${suffix}`;
  }
  if (from.month === to.month) {
    return `${from.day}${EN_DASH}${dayAndMonth(to)}${suffix}`;
  }
  return `${dayAndMonth(from)} ${EN_DASH} ${dayAndMonth(to)}${suffix}`;
}

/**
 * "últimos 7 dias · 14–20 nov", "28 out – 3 nov", "28 dez 2026 – 3 jan 2027",
 * "20 nov". O ano só aparece quando o fim não é do ano de hoje (ou quando o
 * intervalo atravessa o ano, nas duas pontas).
 */
export function formatPeriodLabel(
  range: HistoryPeriodRange,
  today: string,
): string {
  const text = rangeText(
    partsOf(range.from),
    partsOf(range.to),
    partsOf(today).year,
  );
  if (range.period === "7") return `últimos 7 dias ${MIDDLE_DOT} ${text}`;
  if (range.period === "30") return `últimos 30 dias ${MIDDLE_DOT} ${text}`;
  return text;
}

export function dashboardQueryOf(scope: DashboardScope): DashboardQuery {
  return {
    sectorId: scope.sectorId,
    period: { from: scope.period.from, to: scope.period.to },
    previous: scope.previous,
  };
}

export const RANGE_REQUIRED_MESSAGE = "Informe as duas datas.";
export const RANGE_ORDER_MESSAGE =
  "A data inicial precisa ser igual ou anterior à final.";
export const RANGE_FUTURE_MESSAGE = "Escolha datas até hoje.";
export const RANGE_TOO_LONG_MESSAGE = `O intervalo pode ter no máximo ${HISTORY_MAX_DAYS} dias.`;

export type RangeValidation =
  | { ok: true; range: HistoryPeriodRange }
  | { ok: false; field: "from" | "to"; message: string };

/**
 * Valida o intervalo digitado antes de navegar (o servidor continua corrigindo,
 * mas a tela nunca troca o período em silêncio).
 */
export function validateRangeInput(
  from: string,
  to: string,
  today: string,
): RangeValidation {
  if (!isIsoDate(from)) {
    return { ok: false, field: "from", message: RANGE_REQUIRED_MESSAGE };
  }
  if (!isIsoDate(to)) {
    return { ok: false, field: "to", message: RANGE_REQUIRED_MESSAGE };
  }
  if (from > to) {
    return { ok: false, field: "from", message: RANGE_ORDER_MESSAGE };
  }
  if (to > today) {
    return { ok: false, field: "to", message: RANGE_FUTURE_MESSAGE };
  }
  if (periodDays({ from, to }) > HISTORY_MAX_DAYS) {
    return { ok: false, field: "from", message: RANGE_TOO_LONG_MESSAGE };
  }
  return { ok: true, range: { period: "range", from, to } };
}

type Extras = { sector?: string };

function hrefWith(
  path: string,
  range: HistoryPeriodRange,
  extras: Extras,
): string {
  const query = new URLSearchParams();
  appendPeriodParams(query, range);
  if (extras.sector) query.set("setor", extras.sector);
  const text = query.toString();
  return text === "" ? path : `${path}?${text}`;
}

/** "/dashboard" + período (omitido nos 7 dias) + setor. */
export function buildDashboardHref(
  range: HistoryPeriodRange,
  extras: Extras = {},
): string {
  return hrefWith(DASHBOARD_PATH, range, extras);
}

/** Os dois links fixos do seletor de período. */
export function dashboardPresetHref(
  preset: "7" | "30",
  extras: Extras = {},
): string {
  const query = new URLSearchParams();
  if (preset === "30") query.set("periodo", "30");
  if (extras.sector) query.set("setor", extras.sector);
  const text = query.toString();
  return text === "" ? DASHBOARD_PATH : `${DASHBOARD_PATH}?${text}`;
}

/** O download do CSV, com o mesmo período e setor da tela. */
export function dashboardExportHref(
  range: HistoryPeriodRange,
  extras: Extras = {},
): string {
  return hrefWith(DASHBOARD_EXPORT_PATH, range, extras);
}
