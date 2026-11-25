import { type ReactNode, useId } from "react";

import { REQUEST_STATUS_LABEL } from "@/features/requests/status";
import type {
  RequestCardView,
  RequestGroupView,
} from "@/features/requests/types";
import { cn } from "@/lib/utils";

import { LoadMoreButton } from "./LoadMoreButton";
import { REQUEST_STATUS_STYLE } from "./statusStyle";

// Seção de um status: cabeçalho (ícone, nome, total do servidor), nota, linhas
// e "Carregar mais". É o miolo que o Quadro (RequestColumn) e a Lista
// (RequestList) compartilham; cada um só diz as classes da <section> e como
// desenhar uma linha (`renderRow` devolve o <li> já com key).
// O id do título vem de useId: sem `visao` o Quadro e a Lista estão os dois no
// DOM e um id derivado do status se repetiria.
export function RequestGroupSection({
  group,
  moreHref,
  note,
  className,
  renderRow,
}: {
  group: RequestGroupView;
  moreHref: string | null;
  note: string | null;
  className: string;
  renderRow: (row: RequestCardView) => ReactNode;
}) {
  const headingId = useId();
  const { icon: Icon, badgeClass } = REQUEST_STATUS_STYLE[group.status];
  return (
    <section aria-labelledby={headingId} className={className}>
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
          {group.rows.map((row) => renderRow(row))}
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
