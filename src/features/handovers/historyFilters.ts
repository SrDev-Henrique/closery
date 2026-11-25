import { firstValue, type SearchParams } from "@/lib/searchParams";

import { HISTORY_MAX_DAYS } from "./limits";
import { addDays, daysBetween, isIsoDate } from "./saoPaulo";
import type { HistorySituation } from "./status";

export type HistoryPeriod = "7" | "30" | "range";
export type HistorySituationFilter = "all" | HistorySituation | "corrected";

// Valor de ?situacao= na URL (pt-BR).
export const SITUATION_PARAM: Readonly<Record<HistorySituationFilter, string>> =
  {
    all: "todas",
    awaiting: "aguardando",
    confirmed: "confirmada",
    unconfirmed: "nao-confirmada",
    missing: "sem-passagem",
    corrected: "corrigida",
  };

export type HistoryFilters = {
  period: HistoryPeriod;
  from: string; // "YYYY-MM-DD"
  to: string; // "YYYY-MM-DD"
  shiftId: string | null;
  situation: HistorySituationFilter;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function situationFromParam(param: string | undefined): HistorySituationFilter {
  const entry = Object.entries(SITUATION_PARAM).find(
    ([, value]) => value === param,
  );
  const key = entry?.[0];
  switch (key) {
    case "awaiting":
    case "confirmed":
    case "unconfirmed":
    case "missing":
    case "corrected":
      return key;
    default:
      return "all";
  }
}

function lastDays(today: string, days: number): { from: string; to: string } {
  return { from: addDays(today, -(days - 1)), to: today };
}

// null = intervalo ausente ou inválido (cai nos últimos 7 dias).
function parseRange(
  params: SearchParams,
  today: string,
): { from: string; to: string } | null {
  const rawFrom = firstValue(params.de);
  const rawTo = firstValue(params.ate);
  if (
    rawFrom === undefined ||
    rawTo === undefined ||
    !isIsoDate(rawFrom) ||
    !isIsoDate(rawTo)
  ) {
    return null;
  }
  // Pontas invertidas são trocadas.
  const [low, high] = rawFrom <= rawTo ? [rawFrom, rawTo] : [rawTo, rawFrom];
  // Intervalo inteiro no futuro não diz nada: volta ao padrão.
  if (low > today) return null;
  const to = high > today ? today : high;
  let from = low;
  if (daysBetween(from, to) + 1 > HISTORY_MAX_DAYS) {
    from = addDays(to, -(HISTORY_MAX_DAYS - 1));
  }
  return { from, to };
}

export type HistoryPeriodRange = Pick<HistoryFilters, "period" | "from" | "to">;

/**
 * O período da URL (`periodo`, `de`, `ate`), sempre válido: ausente ou lixo
 * = últimos 7 dias; `30` = últimos 30; `intervalo` com pontas trocadas, futuro
 * cortado e no máximo HISTORY_MAX_DAYS. Nunca lança. É o mesmo parse do
 * histórico e do dashboard.
 */
export function parseHistoryPeriod(
  params: SearchParams,
  today: string,
): HistoryPeriodRange {
  const period = firstValue(params.periodo);
  if (period === "30") return { period: "30", ...lastDays(today, 30) };
  const range = period === "intervalo" ? parseRange(params, today) : null;
  return range
    ? { period: "range", ...range }
    : { period: "7", ...lastDays(today, 7) };
}

/** Escreve o período na query: "7" (o padrão) não escreve nada. */
export function appendPeriodParams(
  query: URLSearchParams,
  range: HistoryPeriodRange,
): void {
  if (range.period === "30") query.set("periodo", "30");
  if (range.period === "range") {
    query.set("periodo", "intervalo");
    query.set("de", range.from);
    query.set("ate", range.to);
  }
}

/**
 * Lê os filtros da URL. Nada aqui lança: valor desconhecido cai no padrão
 * (últimos 7 dias, todos os turnos, todas as situações).
 */
export function parseHistoryFilters(
  params: SearchParams,
  today: string,
): HistoryFilters {
  const shift = firstValue(params.turno);
  return {
    ...parseHistoryPeriod(params, today),
    shiftId:
      shift !== undefined && UUID.test(shift) ? shift.toLowerCase() : null,
    situation: situationFromParam(firstValue(params.situacao)),
  };
}

/** URL do histórico; omite o que é padrão (período 7, situação todas, sem turno, página 1). */
export function buildHistoryHref(
  filters: HistoryFilters,
  extras: { sector?: string; page?: number } = {},
): string {
  const query = new URLSearchParams();
  appendPeriodParams(query, filters);
  if (filters.shiftId) query.set("turno", filters.shiftId);
  if (filters.situation !== "all") {
    query.set("situacao", SITUATION_PARAM[filters.situation]);
  }
  if (extras.sector) query.set("setor", extras.sector);
  if (extras.page !== undefined && extras.page > 1) {
    query.set("pagina", String(extras.page));
  }
  const text = query.toString();
  return text === "" ? "/passagens" : `/passagens?${text}`;
}
