import { ClockAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { staleLabel } from "@/features/requests/stale";

// "Parada há N dias": o texto sempre, o ícone por padrão (nunca só cor).
// `showIcon={false}` só nas linhas do cartão do Início, como no protótipo.
export function StaleBadge({
  days,
  showIcon = true,
}: {
  days: number;
  showIcon?: boolean;
}) {
  return (
    <Badge variant="warning" size="md">
      {showIcon && <ClockAlert aria-hidden="true" />}
      {staleLabel(days)}
    </Badge>
  );
}
