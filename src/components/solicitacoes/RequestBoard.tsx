"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { CLOSED_WINDOW_DAYS } from "@/features/requests/limits";
import {
  BOARD_STATUSES,
  REQUEST_STATUS_LABEL,
} from "@/features/requests/status";
import type { BoardStatus, RequestGroup } from "@/features/requests/types";
import { cn } from "@/lib/utils";

import { RequestColumn } from "./RequestColumn";
import { useRequestMove } from "./useRequestMove";

// Quadro: três colunas lado a lado a partir de `lg`, empilhadas entre `md` e
// `lg`; abaixo de `md` uma coluna por vez, escolhida pelos botões. O seletor é
// SÓ CSS (as três colunas ficam montadas): o servidor não sabe a largura da
// tela, então nada aqui usa matchMedia (a hidratação divergiria).
export function RequestBoard({
  groups,
  moreHrefs,
  showSector,
  closedWindow,
}: {
  groups: Readonly<Record<BoardStatus, RequestGroup>>;
  moreHrefs: Readonly<Record<BoardStatus, string | null>>;
  showSector: boolean;
  closedWindow: boolean;
}) {
  const view = useRequestMove(groups);
  const [chosen, setChosen] = useState<BoardStatus>("requested");

  return (
    <div className="flex flex-col gap-4">
      <FieldSet className="md:hidden">
        <FieldLegend className="sr-only">Coluna</FieldLegend>
        <div className="flex flex-wrap gap-2">
          {BOARD_STATUSES.map((status) => (
            <Button
              key={status}
              type="button"
              variant={status === chosen ? "default" : "outline"}
              aria-pressed={status === chosen}
              onClick={() => setChosen(status)}
            >
              {`${REQUEST_STATUS_LABEL[status]} (${view.groups[status].total})`}
            </Button>
          ))}
        </div>
      </FieldSet>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        {BOARD_STATUSES.map((status) => (
          <RequestColumn
            key={status}
            group={view.groups[status]}
            moreHref={moreHrefs[status]}
            showSector={showSector}
            note={
              status === "delivered" && closedWindow
                ? `Últimos ${CLOSED_WINDOW_DAYS} dias`
                : null
            }
            onMove={view.move}
            className={cn(status !== chosen && "max-md:hidden")}
          />
        ))}
      </div>
    </div>
  );
}
