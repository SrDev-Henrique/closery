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

// "open" = solicitada + em trânsito; "not_cancelled" = tudo menos cancelada
// (o link da quantidade pedida precisa contar o mesmo que a soma).
export type RequestStatusFilter =
  | "all"
  | "open"
  | "not_cancelled"
  | RequestStatus;

// Valor de ?status= na URL (pt-BR). Os quatro status reusam o sufixo de ?mais_<status>=.
export const STATUS_FILTER_PARAM: Readonly<
  Record<Exclude<RequestStatusFilter, "all">, string>
> = {
  open: "abertas",
  not_cancelled: "nao-canceladas",
  requested: STATUS_PARAM.requested,
  in_transit: STATUS_PARAM.in_transit,
  delivered: STATUS_PARAM.delivered,
  cancelled: STATUS_PARAM.cancelled,
};

export type RequestDateRange = {
  period: RequestPeriod;
  from: string | null;
  to: string | null;
};

// Os três parâmetros do período; o da entrega é o mesmo período com outras chaves.
type PeriodKeys = { period: string; from: string; to: string };
const CREATED_PARAMS: PeriodKeys = { period: "periodo", from: "de", to: "ate" };
export const DELIVERY_PARAMS = {
  period: "entrega",
  from: "entrega_de",
  to: "entrega_ate",
} as const satisfies PeriodKeys;

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
  status: RequestStatusFilter;
  stale: boolean; // só as paradas agora (> 72 h no mesmo status)
  delivery: RequestDateRange; // período pela PRIMEIRA entrega (o `period` é pela criação)
  itemId: string | null; // item pedido (request_item)
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
    status: "all",
    stale: false,
    delivery: { period: "all", from: null, to: null },
    itemId: null,
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

const ALL_PERIOD: RequestDateRange = { period: "all", from: null, to: null };

// Intervalo: invertido é trocado, `ate` futuro é cortado em hoje; tudo no
// futuro ou data inválida cai em "Todo o período". Sem teto de extensão.
function rangeFrom(
  de: string | undefined,
  ate: string | undefined,
  today: string,
): RequestDateRange {
  if (de === undefined || ate === undefined) return ALL_PERIOD;
  if (!isIsoDate(de) || !isIsoDate(ate)) return ALL_PERIOD;
  const [first, last] = de <= ate ? [de, ate] : [ate, de];
  const to = last > today ? today : last;
  if (first > to) return ALL_PERIOD;
  return { period: "range", from: first, to };
}

function periodFrom(
  params: Params,
  keys: PeriodKeys,
  today: string,
): RequestDateRange {
  switch (firstValue(params[keys.period])) {
    case "7":
      return { period: "7", from: addDays(today, -6), to: today };
    case "30":
      return { period: "30", from: addDays(today, -29), to: today };
    case "intervalo":
      return rangeFrom(
        firstValue(params[keys.from]),
        firstValue(params[keys.to]),
        today,
      );
    default:
      return ALL_PERIOD;
  }
}

const STATUS_FILTERS = [
  "open",
  "not_cancelled",
  "requested",
  "in_transit",
  "delivered",
  "cancelled",
] as const;

function statusFromParam(param: string | undefined): RequestStatusFilter {
  for (const status of STATUS_FILTERS) {
    if (STATUS_FILTER_PARAM[status] === param) return status;
  }
  return "all";
}

function destinationFrom(param: string | undefined): string | null {
  if (param === DESTINATION_OTHER) return DESTINATION_OTHER;
  return param !== undefined && UUID.test(param) ? param : null;
}

function itemFrom(param: string | undefined): string | null {
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
    ...periodFrom(params, CREATED_PARAMS, today),
    status: statusFromParam(firstValue(params.status)),
    stale: firstValue(params.parada) === "1",
    delivery: periodFrom(params, DELIVERY_PARAMS, today),
    itemId: itemFrom(firstValue(params.item)),
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
  if (filters.status !== "all") {
    search.set("status", STATUS_FILTER_PARAM[filters.status]);
  }
  if (filters.stale) search.set("parada", "1");
  const { delivery } = filters;
  if (delivery.period === "7" || delivery.period === "30") {
    search.set(DELIVERY_PARAMS.period, delivery.period);
  }
  if (delivery.period === "range" && delivery.from && delivery.to) {
    search.set(DELIVERY_PARAMS.period, "intervalo");
    search.set(DELIVERY_PARAMS.from, delivery.from);
    search.set(DELIVERY_PARAMS.to, delivery.to);
  }
  if (filters.itemId !== null) search.set("item", filters.itemId);
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
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.stale ||
    filters.delivery.period !== "all" ||
    filters.itemId !== null
  );
}

/**
 * A janela de 30 dias das fechadas (Quadro e Lista) só vale sem nenhum filtro
 * de tempo: com período de criação ou de entrega a contagem tem de bater com
 * o intervalo escolhido.
 */
export function closedWindowApplies(filters: RequestFilters): boolean {
  return filters.period === "all" && filters.delivery.period === "all";
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
