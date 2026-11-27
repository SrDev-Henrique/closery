import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { REQUEST_STATUS_LABEL } from "@/features/requests/status";
import { requestPreview } from "@/features/requests/text";
import type { OpenRequestSummary } from "@/features/requests/types";
import { requestHref } from "@/features/requests/urls";
import type { RequestStatus } from "@/lib/requestStatuses";

import { RequestStatusBadge } from "./RequestStatusBadge";
import { StaleBadge } from "./StaleBadge";

// Uma solicitação aberta nas seções da passagem e no cartão do Início. A linha
// inteira é clicável (link esticado: o `after:inset-0` do link cobre a linha,
// então o nome acessível continua sendo só a prévia). O link abre o detalhe
// rápido (Sheet interceptado, scroll={false}); `statusNow` só vem no resumo da
// entrega e diz onde a solicitação está hoje. `badgeIcons={false}` tira o
// ícone dos dois selos (status e parada): só o cartão do Início usa, como no
// protótipo; as seções da passagem mantêm os ícones.
export function OpenRequestItem({
  request,
  statusNow,
  badgeIcons = true,
}: {
  request: OpenRequestSummary;
  statusNow?: RequestStatus;
  badgeIcons?: boolean;
}) {
  return (
    <li className="border-t border-border">
      <div
        data-slot="open-request-row"
        className="relative -mx-2.5 flex items-center gap-3 rounded-[18px] px-2.5 py-3.5 transition-colors duration-150 hover:bg-accent motion-reduce:transition-none"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Link
            href={requestHref(request.id)}
            scroll={false}
            className="text-[15px] leading-[1.3] font-semibold break-words outline-none after:absolute after:inset-0 after:rounded-[18px] focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
          >
            {requestPreview(request.description)}
          </Link>
          <p className="text-[13px] leading-[normal] break-words text-muted-foreground">
            Para {request.destinationName}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <RequestStatusBadge status={request.status} showIcon={badgeIcons} />
            {request.stale && (
              <StaleBadge days={request.daysInStatus} showIcon={badgeIcons} />
            )}
            {statusNow !== undefined && statusNow !== request.status && (
              <span className="text-[13px] text-muted-foreground">
                Agora: {REQUEST_STATUS_LABEL[statusNow]}
              </span>
            )}
          </div>
        </div>
        <ChevronRight
          aria-hidden="true"
          strokeWidth={2.2}
          className="size-[18px] shrink-0 text-muted-foreground"
        />
      </div>
    </li>
  );
}
