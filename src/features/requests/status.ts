import { REQUEST_STATUSES, type RequestStatus } from "@/lib/requestStatuses";

import type { BoardStatus, OpenStatus } from "./types";

// Ordem dos grupos da Lista (e dos status em qualquer lugar da tela).
export const REQUEST_STATUS_ORDER: readonly RequestStatus[] = REQUEST_STATUSES;

// As três colunas do Quadro (Cancelada só aparece na Lista e na Tabela).
export const BOARD_STATUSES: readonly BoardStatus[] = [
  "requested",
  "in_transit",
  "delivered",
];

// Abertas: ainda dependem da equipe.
export const OPEN_STATUSES: readonly OpenStatus[] = ["requested", "in_transit"];

export function isOpenStatus(status: RequestStatus): status is OpenStatus {
  return status === "requested" || status === "in_transit";
}

export function isBoardStatus(status: RequestStatus): status is BoardStatus {
  return status !== "cancelled";
}

export const REQUEST_STATUS_LABEL: Readonly<Record<RequestStatus, string>> = {
  requested: "Solicitada",
  in_transit: "Em separação / Trânsito",
  delivered: "Entregue",
  cancelled: "Cancelada",
};

// Sufixo de ?mais_<status>= na URL.
export const STATUS_PARAM: Readonly<Record<RequestStatus, string>> = {
  requested: "solicitada",
  in_transit: "transito",
  delivered: "entregue",
  cancelled: "cancelada",
};

// O próximo passo que o cartão e a linha da Lista oferecem.
export function nextStep(status: RequestStatus): BoardStatus | null {
  if (status === "requested") return "in_transit";
  if (status === "in_transit") return "delivered";
  return null;
}

// Os destinos do "Mover para" do detalhe: todo status não cancelado diferente do atual.
export function moveTargets(status: RequestStatus): BoardStatus[] {
  return BOARD_STATUSES.filter((target) => target !== status);
}

export function moveLabel(to: RequestStatus): string {
  return `Mover para ${REQUEST_STATUS_LABEL[to]}`;
}
