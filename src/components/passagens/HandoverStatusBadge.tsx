import {
  CircleCheck,
  CircleSlash,
  Clock,
  PencilLine,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  CORRECTED_LABEL,
  type HistorySituation,
  situationLabel,
} from "@/features/handovers/status";

export const SITUATION_STYLE = {
  awaiting: { icon: Clock, className: "bg-info text-info-foreground" },
  confirmed: {
    icon: CircleCheck,
    className: "bg-success text-success-foreground",
  },
  unconfirmed: {
    icon: TriangleAlert,
    className: "bg-warning text-warning-foreground",
  },
  // `accent`, não `muted`: na paleta nova muted = card, e a pílula sumia na
  // linha do histórico (mesmo motivo da "Cancelada" das solicitações).
  missing: {
    icon: CircleSlash,
    className: "bg-accent text-muted-foreground",
  },
} as const satisfies Record<
  HistorySituation,
  { icon: typeof Clock; className: string }
>;

// Situação sempre com ícone e texto, nunca só cor.
export function HandoverStatusBadge({
  situation,
  confirmedByName,
  corrected = false,
}: {
  situation: HistorySituation;
  confirmedByName?: string | null;
  corrected?: boolean;
}) {
  const { icon: Icon, className } = SITUATION_STYLE[situation];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary" className={`h-6 ${className}`}>
        <Icon aria-hidden="true" />
        {situationLabel(situation, confirmedByName)}
      </Badge>
      {corrected && (
        <Badge variant="outline" className="h-6">
          <PencilLine aria-hidden="true" />
          {CORRECTED_LABEL}
        </Badge>
      )}
    </span>
  );
}
