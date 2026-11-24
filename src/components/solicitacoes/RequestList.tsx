"use client";

import { useId } from "react";

import { CLOSED_WINDOW_DAYS } from "@/features/requests/limits";
import {
  isOpenStatus,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_ORDER,
} from "@/features/requests/status";
import type {
  BoardStatus,
  RequestGroups,
  RequestGroupView,
  RequestListItem,
  RequestStatus,
} from "@/features/requests/types";
import { cn } from "@/lib/utils";

import { LoadMoreButton } from "./LoadMoreButton";
import { RequestListRow } from "./RequestListRow";
import { REQUEST_STATUS_STYLE } from "./statusStyle";
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
  const headingId = useId();
  const { icon: Icon, badgeClass } = REQUEST_STATUS_STYLE[group.status];
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
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
            <RequestListRow
              key={row.id}
              request={row}
              showSector={showSector}
              onMove={(to) => onMove(row, to)}
            />
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
