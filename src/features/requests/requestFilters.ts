import { parsePage } from "@/features/admin/pagination";
import { addDays, isIsoDate } from "@/features/handovers/saoPaulo";
import { firstValue } from "@/lib/searchParams";

import { BOARD_MAX_LIMIT, BOARD_PAGE_SIZE, DESTINATION_OTHER } from "./limits";
import { normalizeSearch } from "./search";
import { REQUEST_STATUS_ORDER, STATUS_PARAM } from "./status";
import type { RequestStatus } from "./types";
import { REQUESTS_PATH } from "./urls";

// Filtros da tela de solicitações, todos na URL. O parse nunca lança e só
// devolve valores que o formulário sabe mostrar.
export type RequestView = "board" | "list" | "table";
export const VIEW_PARAM: Readonly<Record<RequestView, string>> = {
  board: "quadro",
  list: "lista",
  table: "tabela",
};

export type RequestPeriod = "all" | "7" | "30" | "range";

export type RequestFilters = {
  view: RequestView | null; // null = padrão responsivo (Lista abaixo de md, Quadro em md+)
  destination: string | null; // uuid | DESTINATION_OTHER | null (todos)
  period: RequestPeriod;
  from: string | null; // "YYYY-MM-DD" em "7"/"30"/"range"; null em "all"
  to: string | null;
  creatorId: string | null; // user.id
  search: string; // normalizeSearch; "" = sem busca
  limits: Record<RequestStatus, number>; // múltiplo de BOARD_PAGE_SIZE entre 20 e 200
  page: number; // Tabela
};

type Params = Record<string, string | string[] | undefined>;
type Extras = { sector?: string };

// Minúsculo de propósito: um uuid em maiúsculas não é um valor que o seletor gera.
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER_ID = /^[A-Za-z0-9_-]{1,64}$/;

export const LIMIT_PARAM: Readonly<Record<RequestStatus, string>> = {
  requested: `mais_${STATUS_PARAM.requested}`,
  in_transit: `mais_${STATUS_PARAM.in_transit}`,
  delivered: `mais_${STATUS_PARAM.delivered}`,
  cancelled: `mais_${STATUS_PARAM.cancelled}`,
};

function defaultLimits(): Record<RequestStatus, number> {
  return {
    requested: BOARD_PAGE_SIZE,
    in_transit: BOARD_PAGE_SIZE,
    delivered: BOARD_PAGE_SIZE,
    cancelled: BOARD_PAGE_SIZE,
  };
}

export function defaultRequestFilters(): RequestFilters {
  return {
    view: null,
    destination: null,
    period: "all",
    from: null,
    to: null,
    creatorId: null,
    search: "",
    limits: defaultLimits(),
    page: 1,
  };
}

function viewFromParam(param: string | undefined): RequestView | null {
  for (const view of ["board", "list", "table"] as const) {
    if (VIEW_PARAM[view] === param) return view;
  }
  return null;
}

// "0", "45", "999" e lixo viram um múltiplo do passo entre 20 e 200.
function limitFromParam(raw: string | string[] | undefined): number {
  const value = firstValue(raw);
  if (value === undefined || !/^\d+$/.test(value)) return BOARD_PAGE_SIZE;
  const rounded = Math.floor(Number(value) / BOARD_PAGE_SIZE) * BOARD_PAGE_SIZE;
  return Math.min(Math.max(rounded, BOARD_PAGE_SIZE), BOARD_MAX_LIMIT);
}

type Range = { period: RequestPeriod; from: string | null; to: string | null };
const ALL_PERIOD: Range = { period: "all", from: null, to: null };

// Intervalo: invertido é trocado, `ate` futuro é cortado em hoje; tudo no
// futuro ou data inválida cai em "Todo o período". Sem teto de extensão.
function rangeFrom(
  de: string | undefined,
  ate: string | undefined,
  today: string,
): Range {
  if (de === undefined || ate === undefined) return ALL_PERIOD;
  if (!isIsoDate(de) || !isIsoDate(ate)) return ALL_PERIOD;
  const [first, last] = de <= ate ? [de, ate] : [ate, de];
  const to = last > today ? today : last;
  if (first > to) return ALL_PERIOD;
  return { period: "range", from: first, to };
}

function periodFrom(params: Params, today: string): Range {
  switch (firstValue(params.periodo)) {
    case "7":
      return { period: "7", from: addDays(today, -6), to: today };
    case "30":
      return { period: "30", from: addDays(today, -29), to: today };
    case "intervalo":
      return rangeFrom(firstValue(params.de), firstValue(params.ate), today);
    default:
      return ALL_PERIOD;
  }
}

function destinationFrom(param: string | undefined): string | null {
  if (param === DESTINATION_OTHER) return DESTINATION_OTHER;
  return param !== undefined && UUID.test(param) ? param : null;
}

export function parseRequestFilters(
  params: Params,
  today: string,
): RequestFilters {
  const creator = firstValue(params.criador);
  return {
    view: viewFromParam(firstValue(params.visao)),
    destination: destinationFrom(firstValue(params.destino)),
    ...periodFrom(params, today),
    creatorId: creator !== undefined && USER_ID.test(creator) ? creator : null,
    search: normalizeSearch(firstValue(params.busca) ?? ""),
    limits: {
      requested: limitFromParam(params[LIMIT_PARAM.requested]),
      in_transit: limitFromParam(params[LIMIT_PARAM.in_transit]),
      delivered: limitFromParam(params[LIMIT_PARAM.delivered]),
      cancelled: limitFromParam(params[LIMIT_PARAM.cancelled]),
    },
    page: parsePage(params.pagina),
  };
}

/** A URL dos filtros, sem nenhum parâmetro que seja o padrão. */
export function buildRequestsHref(
  filters: RequestFilters,
  extras: Extras = {},
): string {
  const search = new URLSearchParams();
  if (filters.view !== null) search.set("visao", VIEW_PARAM[filters.view]);
  if (filters.destination !== null) search.set("destino", filters.destination);
  if (filters.period === "7" || filters.period === "30") {
    search.set("periodo", filters.period);
  }
  if (filters.period === "range" && filters.from && filters.to) {
    search.set("periodo", "intervalo");
    search.set("de", filters.from);
    search.set("ate", filters.to);
  }
  if (filters.creatorId !== null) search.set("criador", filters.creatorId);
  if (filters.search !== "") search.set("busca", filters.search);
  if (extras.sector) search.set("setor", extras.sector);
  for (const status of REQUEST_STATUS_ORDER) {
    if (filters.limits[status] > BOARD_PAGE_SIZE) {
      search.set(LIMIT_PARAM[status], String(filters.limits[status]));
    }
  }
  if (filters.page > 1) search.set("pagina", String(filters.page));
  const query = search.toString();
  return query === "" ? REQUESTS_PATH : `${REQUESTS_PATH}?${query}`;
}

/** Aplicar filtros volta ao começo: limites em 20 e página 1. */
export function resetPaging(filters: RequestFilters): RequestFilters {
  return { ...filters, limits: defaultLimits(), page: 1 };
}

/** Algum filtro além da visão (decide entre "vazio novo" e "vazio filtrado"). */
export function filtersActive(filters: RequestFilters): boolean {
  return (
    filters.destination !== null ||
    filters.period !== "all" ||
    filters.creatorId !== null ||
    filters.search !== ""
  );
}

/** "Limpar filtros" mantém a visão e o setor. */
export function clearFiltersHref(
  view: RequestView | null,
  extras: Extras = {},
): string {
  return buildRequestsHref({ ...defaultRequestFilters(), view }, extras);
}

/** "Carregar mais" de uma coluna/grupo: mais 20, até 200, mantendo o resto. */
export function moreHref(
  filters: RequestFilters,
  status: RequestStatus,
  extras: Extras = {},
): string {
  const next = Math.min(
    filters.limits[status] + BOARD_PAGE_SIZE,
    BOARD_MAX_LIMIT,
  );
  return buildRequestsHref(
    { ...filters, limits: { ...filters.limits, [status]: next }, page: 1 },
    extras,
  );
}

/** Os três links do seletor de visão: mantêm os filtros e zeram a paginação. */
export function viewHrefs(
  filters: RequestFilters,
  extras: Extras = {},
): Record<RequestView, string> {
  const base = resetPaging(filters);
  return {
    board: buildRequestsHref({ ...base, view: "board" }, extras),
    list: buildRequestsHref({ ...base, view: "list" }, extras),
    table: buildRequestsHref({ ...base, view: "table" }, extras),
  };
}
