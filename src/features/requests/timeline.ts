import { isOpenStatus, REQUEST_STATUS_LABEL } from "./status";
import type {
  RequestStatus,
  RequestTimelineEntry,
  RequestTimelineKind,
} from "./types";

// from nulo = a criação; ir para Cancelada = cancelou; voltar de Entregue ou
// Cancelada para uma aberta = reabriu; o resto é só uma mudança.
export function timelineKind(
  from: RequestStatus | null,
  to: RequestStatus,
): RequestTimelineKind {
  if (from === null) return "created";
  if (to === "cancelled") return "cancelled";
  if ((from === "delivered" || from === "cancelled") && isOpenStatus(to)) {
    return "reopened";
  }
  return "moved";
}

export function timelineSentence(
  entry: Pick<RequestTimelineEntry, "kind" | "to" | "byName">,
): string {
  switch (entry.kind) {
    case "created":
      return `Criada por ${entry.byName}`;
    case "moved":
      return `${entry.byName} moveu para ${REQUEST_STATUS_LABEL[entry.to]}`;
    case "cancelled":
      return `${entry.byName} cancelou`;
    case "reopened":
      return `${entry.byName} reabriu como ${REQUEST_STATUS_LABEL[entry.to]}`;
  }
}
