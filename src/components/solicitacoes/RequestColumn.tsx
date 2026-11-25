import type {
  BoardStatus,
  RequestGroupView,
  RequestListItem,
} from "@/features/requests/types";
import { cn } from "@/lib/utils";

import { RequestCard } from "./RequestCard";
import { RequestGroupSection } from "./RequestGroupSection";

// Coluna do Quadro: a seção do status (RequestGroupSection) com um cartão por
// linha.
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
  return (
    <RequestGroupSection
      group={group}
      moreHref={moreHref}
      note={note}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-lg border bg-muted/30 p-3",
        className,
      )}
      renderRow={(row) => (
        <li key={row.id}>
          <RequestCard
            request={row}
            showSector={showSector}
            onMove={(to) => onMove(row, to)}
          />
        </li>
      )}
    />
  );
}
