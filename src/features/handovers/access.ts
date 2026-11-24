import type { HandoverStatus } from "@/db/schema/handovers";
import { type Authz, canAccessSector, isAdmin } from "@/features/authz/authz";

import type { FormMode } from "./types";

export type HandoverCapabilities = {
  canView: boolean; // canAccessSector(actor, sectorId)
  canEditDirectly: boolean; // rascunho: canView; entregue: admin OU quem entregou; confirmada: false
  canDeliver: boolean; // status draft && canView
  canConfirm: boolean; // status delivered && canView && deliveredBy !== actor.userId
  canCorrectWithReason: boolean; // status confirmed && admin
};

/**
 * Única fonte da regra de quem pode o quê numa passagem: o domínio e a tela
 * usam esta função, para nunca divergirem (F3-4).
 */
export function handoverCapabilities(
  actor: Authz,
  handover: {
    status: HandoverStatus;
    sectorId: string;
    deliveredBy: string | null;
  },
): HandoverCapabilities {
  const canView = canAccessSector(actor, handover.sectorId);
  const admin = isAdmin(actor);
  const isDeliverer =
    handover.deliveredBy !== null && handover.deliveredBy === actor.userId;

  return {
    canView,
    canEditDirectly:
      canView &&
      (handover.status === "draft" ||
        (handover.status === "delivered" && (admin || isDeliverer))),
    canDeliver: canView && handover.status === "draft",
    canConfirm: canView && handover.status === "delivered" && !isDeliverer,
    canCorrectWithReason: canView && handover.status === "confirmed" && admin,
  };
}

/** Qual formulário a pessoa vê; null = nenhum (a página mostra o resumo). */
export function formModeOf(
  status: HandoverStatus | null,
  capabilities: HandoverCapabilities,
): FormMode | null {
  if ((status === null || status === "draft") && capabilities.canEditDirectly) {
    return "draft";
  }
  if (status === "delivered" && capabilities.canEditDirectly) return "edit";
  if (status === "confirmed" && capabilities.canCorrectWithReason) {
    return "correction";
  }
  return null;
}
