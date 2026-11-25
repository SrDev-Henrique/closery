"use client";

import { CLOSED_WINDOW_DAYS } from "@/features/requests/limits";
import { isOpenStatus, REQUEST_STATUS_ORDER } from "@/features/requests/status";
import type {
  BoardStatus,
  RequestGroups,
  RequestGroupView,
  RequestListItem,
  RequestStatus,
} from "@/features/requests/types";

import { RequestGroupSection } from "./RequestGroupSection";
import { RequestListRow } from "./RequestListRow";
import { useRequestMove } from "./useRequestMove";

function ListGroup({
  group,
  moreHref,
  showSector,
  note,
  onMove,
}: {
  group: RequestGroupView;
  moreHref: string | null;
  showSector: boolean;
  note: string | null;
  onMove: (request: RequestListItem, to: BoardStatus) => void;
}) {
  return (
    <RequestGroupSection
      group={group}
      moreHref={moreHref}
      note={note}
      className="flex flex-col gap-2"
      renderRow={(row) => (
        <RequestListRow
          key={row.id}
          request={row}
          showSector={showSector}
          onMove={(to) => onMove(row, to)}
        />
      )}
    />
  );
}

// Lista agrupada por status (os quatro, incluindo Cancelada): padrão no celular.
export function RequestList({
  groups,
  moreHrefs,
  showSector,
  closedWindow,
}: {
  groups: RequestGroups;
  moreHrefs: Readonly<Record<RequestStatus, string | null>>;
  showSector: boolean;
  closedWindow: boolean;
}) {
  const view = useRequestMove(groups);
  return (
    <div className="flex flex-col gap-6">
      {REQUEST_STATUS_ORDER.map((status: RequestStatus) => (
        <ListGroup
          key={status}
          group={view.groups[status]}
          moreHref={moreHrefs[status]}
          showSector={showSector}
          note={
            closedWindow && !isOpenStatus(status)
              ? `Últimos ${CLOSED_WINDOW_DAYS} dias`
              : null
          }
          onMove={view.move}
        />
      ))}
    </div>
  );
}
