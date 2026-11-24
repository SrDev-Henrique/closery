import type { HandoverStatus } from "@/db/schema/handovers";

export const HISTORY_SITUATIONS = [
  "awaiting",
  "confirmed",
  "unconfirmed",
  "missing",
] as const;
export type HistorySituation = (typeof HISTORY_SITUATIONS)[number];

/** Rótulo da situação. "Confirmada por {nome}" quando o nome é conhecido. */
export function situationLabel(
  situation: HistorySituation,
  confirmedByName?: string | null,
): string {
  switch (situation) {
    case "awaiting":
      return "Aguardando recebimento";
    case "confirmed": {
      const name = confirmedByName?.trim();
      return name ? `Confirmada por ${name}` : "Confirmada";
    }
    case "unconfirmed":
      return "Não confirmada";
    case "missing":
      return "Sem passagem";
  }
}

// Selo à parte (uma passagem confirmada pode ser também "Corrigida").
export const CORRECTED_LABEL = "Corrigida";

export const STATUS_DESCRIPTION: Readonly<Record<HandoverStatus, string>> = {
  draft: "Rascunho",
  delivered: "Entregue",
  confirmed: "Confirmada",
};
