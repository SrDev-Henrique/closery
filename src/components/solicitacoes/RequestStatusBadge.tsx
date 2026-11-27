import { Badge } from "@/components/ui/badge";
import { REQUEST_STATUS_LABEL } from "@/features/requests/status";
import type { RequestStatus } from "@/lib/requestStatuses";

import { REQUEST_STATUS_STYLE } from "./statusStyle";

// Status nunca só cor: o texto vem sempre e, por padrão, o ícone junto.
// `showIcon={false}` só nas linhas do cartão do Início (o protótipo não tem
// ícone ali; o texto continua dizendo o status). Pílula de 24px (size md) que
// nunca quebra linha; a cor vem do `statusStyle`.
export function RequestStatusBadge({
  status,
  showIcon = true,
}: {
  status: RequestStatus;
  showIcon?: boolean;
}) {
  const { icon: Icon, badgeClass } = REQUEST_STATUS_STYLE[status];
  return (
    <Badge variant="secondary" size="md" className={badgeClass}>
      {showIcon && <Icon aria-hidden="true" />}
      {REQUEST_STATUS_LABEL[status]}
    </Badge>
  );
}
