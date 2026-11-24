import { useId } from "react";

import { REQUEST_STATUS_LABEL } from "@/features/requests/status";
import type {
  BoardStatus,
  RequestGroupView,
  RequestListItem,
} from "@/features/requests/types";
import { cn } from "@/lib/utils";

import { LoadMoreButton } from "./LoadMoreButton";
import { RequestCard } from "./RequestCard";
import { REQUEST_STATUS_STYLE } from "./statusStyle";

// Coluna do Quadro: contagem do servidor (total), cartões, "Carregar mais".
// O id do título vem de useId: sem `visao` o Quadro e a Lista estão os dois
// no DOM e um id derivado do status se repetiria.
export function RequestColumn({
  group,
  moreHref,
  showSector,
  note,
  onMove,
  className,
}: {
  group: RequestGroupView;
  moreHref: string | null;
  showSector: boolean;
  note: string | null;
  onMove: (request: RequestListItem, to: BoardStatus) => void;
  className?: string;
}) {
  const headingId = useId();
  const { icon: Icon, badgeClass } = REQUEST_STATUS_STYLE[group.status];
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-lg border bg-muted/30 p-3",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <h2
          id={headingId}
          className="flex items-center gap-2 text-base font-medium"
        >
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full",
              badgeClass,
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
          {REQUEST_STATUS_LABEL[group.status]}
        </h2>
        <span className="text-sm text-muted-foreground tabular-nums">
          {group.total}
          <span className="sr-only"> solicitações</span>
        </span>
      </header>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {group.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma solicitação.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {group.rows.map((row) => (
            <li key={row.id}>
              <RequestCard
                request={row}
                showSector={showSector}
                onMove={(to) => onMove(row, to)}
              />
            </li>
          ))}
        </ul>
      )}
      {moreHref && (
        <LoadMoreButton
          href={moreHref}
          shown={group.rows.length}
          total={group.total}
        />
      )}
    </section>
  );
}
