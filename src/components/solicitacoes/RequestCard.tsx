import { MessageSquare, SquareArrowOutUpRight } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDateBR, saoPauloParts } from "@/features/handovers/saoPaulo";
import { nextStep } from "@/features/requests/status";
import {
  commentCountLabel,
  itemCountLabel,
  requestPreview,
} from "@/features/requests/text";
import type { BoardStatus, RequestCardView } from "@/features/requests/types";
import { requestHref } from "@/features/requests/urls";
import { cn } from "@/lib/utils";

import { MoveStatusButton } from "./MoveStatusButton";
import { StaleBadge } from "./StaleBadge";

// A descrição abre o detalhe rápido (Link: a navegação no cliente é
// interceptada pelo slot @detalhe); o ↗ é um <a> comum, que abre a página
// completa (uma navegação no cliente para a mesma URL seria interceptada de novo).
export function RequestHeadline({ request }: { request: RequestCardView }) {
  return (
    <div className="flex items-start gap-2">
      <Link
        href={requestHref(request.id)}
        scroll={false}
        className="line-clamp-2 min-w-0 flex-1 break-words font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
      >
        {request.description}
      </Link>
      <Tooltip>
        <TooltipTrigger
          render={(triggerProps) => (
            <a
              {...triggerProps}
              href={requestHref(request.id)}
              aria-label={`Abrir página completa de ${requestPreview(request.description)}`}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "relative z-10 shrink-0",
              )}
            >
              <SquareArrowOutUpRight aria-hidden="true" />
            </a>
          )}
        />
        <TooltipContent>Abrir página completa</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function RequestMeta({
  request,
  showSector,
}: {
  request: RequestCardView;
  showSector: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span>Para {request.destinationName}</span>
      {showSector && <span>{request.sectorName}</span>}
      {request.itemCount > 0 && (
        <span>{itemCountLabel(request.itemCount)}</span>
      )}
      {request.commentCount > 0 && (
        <span className="inline-flex items-center gap-1 tabular-nums">
          <MessageSquare className="size-3" aria-hidden="true" />
          <span aria-hidden="true">{request.commentCount}</span>
          <span className="sr-only">
            {commentCountLabel(request.commentCount)}
          </span>
        </span>
      )}
      <span>
        Criada por {request.createdByName} em{" "}
        {formatDateBR(saoPauloParts(request.createdAt).date)}
      </span>
    </div>
  );
}

// Cartão do Quadro. O link estica pelo cartão (after:absolute); os botões ficam
// acima dele (relative z-10).
export function RequestCard({
  request,
  showSector,
  onMove,
}: {
  request: RequestCardView;
  showSector: boolean;
  onMove?: (to: BoardStatus) => void;
}) {
  const next = nextStep(request.status);
  return (
    <article
      className={cn(
        "relative flex flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground",
        request.pending && "opacity-70",
      )}
    >
      <RequestHeadline request={request} />
      <RequestMeta request={request} showSector={showSector} />
      {request.stale && <StaleBadge days={request.daysInStatus} />}
      {onMove && next !== null && (
        <MoveStatusButton
          to={next}
          disabled={request.pending}
          className="relative z-10 w-fit"
          onClick={() => onMove(next)}
        />
      )}
    </article>
  );
}
