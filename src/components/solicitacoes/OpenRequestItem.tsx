import Link from "next/link";

import { REQUEST_STATUS_LABEL } from "@/features/requests/status";
import { requestPreview } from "@/features/requests/text";
import type { OpenRequestSummary } from "@/features/requests/types";
import { requestHref } from "@/features/requests/urls";
import type { RequestStatus } from "@/lib/requestStatuses";

import { RequestStatusBadge } from "./RequestStatusBadge";
import { StaleBadge } from "./StaleBadge";

// Uma solicitação aberta nas seções da passagem e no cartão do Início. O link
// abre o detalhe rápido (Sheet interceptado, scroll={false}); `statusNow` só
// vem no resumo da entrega e diz onde a solicitação está hoje.
export function OpenRequestItem({
  request,
  statusNow,
}: {
  request: OpenRequestSummary;
  statusNow?: RequestStatus;
}) {
  return (
    <li className="flex flex-col gap-1 py-3">
      <Link
        href={requestHref(request.id)}
        scroll={false}
        className="inline-flex min-h-9 w-fit items-center font-medium underline-offset-4 hover:underline max-md:min-h-11"
      >
        {requestPreview(request.description)}
      </Link>
      <p className="text-sm text-muted-foreground">
        Para {request.destinationName}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <RequestStatusBadge status={request.status} />
        {request.stale && <StaleBadge days={request.daysInStatus} />}
        {statusNow !== undefined && statusNow !== request.status && (
          <span className="text-sm text-muted-foreground">
            Agora: {REQUEST_STATUS_LABEL[statusNow]}
          </span>
        )}
      </div>
    </li>
  );
}
