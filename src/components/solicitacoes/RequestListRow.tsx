import { nextStep } from "@/features/requests/status";
import type { BoardStatus, RequestCardView } from "@/features/requests/types";
import { cn } from "@/lib/utils";

import { MoveStatusButton } from "./MoveStatusButton";
import { RequestHeadline, RequestMeta } from "./RequestCard";
import { StaleBadge } from "./StaleBadge";

// Linha da Lista (padrão no celular): o mesmo conteúdo do cartão, em linha, e
// o mesmo próximo passo (a Lista é onde se avança no celular).
export function RequestListRow({
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
    <li
      className={cn(
        "relative flex flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground sm:flex-row sm:items-center sm:justify-between",
        request.pending && "opacity-70",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <RequestHeadline request={request} />
        <RequestMeta request={request} showSector={showSector} />
        {request.stale && <StaleBadge days={request.daysInStatus} />}
      </div>
      {onMove && next !== null && (
        <MoveStatusButton
          to={next}
          disabled={request.pending}
          className="relative z-10 w-fit shrink-0"
          onClick={() => onMove(next)}
        />
      )}
    </li>
  );
}
