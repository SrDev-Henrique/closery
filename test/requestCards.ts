import { randomUUID } from "node:crypto";

import { BOARD_PAGE_SIZE } from "@/features/requests/limits";
import { REQUEST_STATUS_ORDER } from "@/features/requests/status";
import type {
  RequestGroup,
  RequestGroups,
  RequestListItem,
  RequestStatus,
} from "@/features/requests/types";

// Construtores dos testes de componente e do reducer do Quadro. Datas fixas
// (2026-11-20T12:00:00Z): o teste que depende do tempo passa as suas.
const DEFAULT_AT = new Date("2026-11-20T12:00:00Z");

/** Uma linha do Quadro/Lista/Tabela com id único, Solicitada, contadores zerados. */
export function requestListItem(
  overrides: Partial<RequestListItem> = {},
): RequestListItem {
  return {
    id: randomUUID(),
    sectorId: "00000000-0000-4000-8000-0000000000a1",
    sectorName: "Setor Teste",
    description: "Solicitação de teste",
    destinationName: "Doca 3",
    destinationIsOther: false,
    status: "requested",
    createdByName: "Ana Teste",
    createdAt: DEFAULT_AT,
    statusChangedAt: DEFAULT_AT,
    daysInStatus: 0,
    stale: false,
    itemCount: 0,
    commentCount: 0,
    ...overrides,
  };
}

/**
 * Agrupa as linhas pelo status (os 4 grupos, na ordem da Lista). `total` =
 * quantas linhas o status tem, ou o que o teste informar (total maior que as
 * linhas = "Carregar mais" pendente); `limit` = BOARD_PAGE_SIZE.
 */
export function requestGroups(
  rows: readonly RequestListItem[],
  totals: Partial<Record<RequestStatus, number>> = {},
): RequestGroups {
  const group = (status: RequestStatus): RequestGroup => {
    const own = rows.filter((row) => row.status === status);
    return {
      status,
      total: totals[status] ?? own.length,
      limit: BOARD_PAGE_SIZE,
      rows: own,
    };
  };
  const [requested, in_transit, delivered, cancelled] =
    REQUEST_STATUS_ORDER.map(group);
  if (!requested || !in_transit || !delivered || !cancelled) {
    throw new Error("requestGroups: faltou um grupo");
  }
  return { requested, in_transit, delivered, cancelled };
}
