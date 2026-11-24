import { ClockAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { staleLabel } from "@/features/requests/stale";

// "Parada há N dias": ícone e texto, nunca só cor.
export function StaleBadge({ days }: { days: number }) {
  return (
    <Badge
      variant="secondary"
      className="h-6 bg-warning text-warning-foreground"
    >
      <ClockAlert aria-hidden="true" />
      {staleLabel(days)}
    </Badge>
  );
}
