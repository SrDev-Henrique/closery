import {
  buildHistoryHref,
  type HistoryPeriodRange,
  type HistorySituationFilter,
} from "@/features/handovers/historyFilters";
import { handoverHref } from "@/features/handovers/urls";
import {
  buildRequestsHref,
  defaultRequestFilters,
  type RequestDateRange,
} from "@/features/requests/requestFilters";

// O destino de cada número do dashboard (D-F5-3): sempre a lista filtrada que
// conta exatamente aquilo. Nenhuma query é montada à mão fora daqui.
export type LinkExtras = { sector?: string };

/** O `?setor=` dos links: o admin leva o que escolheu (id ou "todos"); o operador, nenhum. */
export function linkExtras(sectorParam: string | null): LinkExtras {
  return sectorParam === null ? {} : { sector: sectorParam };
}

/**
 * /passagens no período, numa situação. Controles passam também o item (e o
 * turno do segmento) e, como extras, o setor do item (nunca "todos").
 */
export function passagesListHref(
  period: HistoryPeriodRange,
  situation: HistorySituationFilter,
  extras: LinkExtras & { shiftId?: string; itemId?: string } = {},
): string {
  return buildHistoryHref(
    {
      ...period,
      shiftId: extras.shiftId ?? null,
      situation,
      itemId: extras.itemId ?? null,
    },
    { sector: extras.sector },
  );
}

/** A passagem da última contagem do estoque. */
export function lastCountHref(handoverId: string): string {
  return handoverHref(handoverId);
}

/** O mesmo período, no formato dos filtros de /solicitacoes. */
export function toRequestPeriod(period: HistoryPeriodRange): RequestDateRange {
  return { period: period.period, from: period.from, to: period.to };
}

// Quadro e Lista aplicam a janela de 30 dias às fechadas e a contagem não
// bateria: todo link de solicitação abre a Tabela.
function tableFilters() {
  return { ...defaultRequestFilters(), view: "table" as const };
}

export function openRequestsHref(extras: LinkExtras = {}): string {
  return buildRequestsHref({ ...tableFilters(), status: "open" }, extras);
}

export function staleRequestsHref(extras: LinkExtras = {}): string {
  return buildRequestsHref({ ...tableFilters(), stale: true }, extras);
}

/** Solicitações cuja PRIMEIRA entrega caiu no período (qualquer status atual). */
export function deliveredRequestsHref(
  period: HistoryPeriodRange,
  extras: LinkExtras = {},
): string {
  return buildRequestsHref(
    { ...tableFilters(), delivery: toRequestPeriod(period) },
    extras,
  );
}

/** Idem, de um destino: o uuid dele ou "outro" (o texto livre). */
export function destinationDeliveriesHref(
  period: HistoryPeriodRange,
  destinationKey: string,
  extras: LinkExtras = {},
): string {
  return buildRequestsHref(
    {
      ...tableFilters(),
      delivery: toRequestPeriod(period),
      destination: destinationKey,
    },
    extras,
  );
}

/** Solicitações criadas no período, sem as canceladas, que pedem o item. */
export function requestedItemHref(
  period: HistoryPeriodRange,
  itemId: string,
  extras: LinkExtras = {},
): string {
  return buildRequestsHref(
    {
      ...tableFilters(),
      ...toRequestPeriod(period),
      status: "not_cancelled",
      itemId,
    },
    extras,
  );
}
