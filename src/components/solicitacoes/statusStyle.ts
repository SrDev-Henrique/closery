import {
  CircleCheck,
  CircleDot,
  CircleX,
  type LucideIcon,
  Truck,
} from "lucide-react";

import type { RequestStatus } from "@/lib/requestStatuses";

// Ícone e cor de cada status (a cor pertence ao status e nunca é ciclada).
// `buttonClass` é a cor do botão que MOVE PARA o status: o mesmo token do selo,
// mais borda transparente e o hover do próprio token. Classes sempre inteiras
// no texto, para o Tailwind enxergá-las. O botão de cancelar usa
// variant="destructive", não este mapa.
export const REQUEST_STATUS_STYLE: Readonly<
  Record<
    RequestStatus,
    { icon: LucideIcon; badgeClass: string; buttonClass: string }
  >
> = {
  requested: {
    icon: CircleDot,
    badgeClass: "bg-info text-info-foreground",
    buttonClass:
      "bg-info text-info-foreground border-transparent hover:bg-info/80",
  },
  in_transit: {
    icon: Truck,
    badgeClass: "bg-warning text-warning-foreground",
    buttonClass:
      "bg-warning text-warning-foreground border-transparent hover:bg-warning/80",
  },
  delivered: {
    icon: CircleCheck,
    badgeClass: "bg-success text-success-foreground",
    buttonClass:
      "bg-success text-success-foreground border-transparent hover:bg-success/80",
  },
  cancelled: {
    icon: CircleX,
    badgeClass: "bg-muted text-muted-foreground",
    buttonClass:
      "bg-muted text-muted-foreground border-transparent hover:bg-muted/80",
  },
};
