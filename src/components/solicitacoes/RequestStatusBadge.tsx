import { Badge } from "@/components/ui/badge";
import { REQUEST_STATUS_LABEL } from "@/features/requests/status";
import type { RequestStatus } from "@/lib/requestStatuses";

import { REQUEST_STATUS_STYLE } from "./statusStyle";

// Status sempre com ícone e texto, nunca só cor. Pílula de 24px (size md) que
// nunca quebra linha; a cor vem do `statusStyle`.
export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const { icon: Icon, badgeClass } = REQUEST_STATUS_STYLE[status];
  return (
    <Badge variant="secondary" size="md" className={badgeClass}>
      <Icon aria-hidden="true" />
      {REQUEST_STATUS_LABEL[status]}
    </Badge>
  );
}
