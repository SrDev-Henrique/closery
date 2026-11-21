"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SortDirection } from "@/features/admin/reorder";

// Botões só com ícone: aria-label (cita o item) + tooltip (regra do AGENTS.md).
export function MoveButtons({
  label,
  canMoveUp,
  canMoveDown,
  pending = false,
  onMove,
}: {
  label: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  pending?: boolean;
  onMove: (direction: SortDirection) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Subir ${label}`}
              disabled={!canMoveUp || pending}
              onClick={() => onMove("up")}
            />
          }
        >
          <ChevronUp />
        </TooltipTrigger>
        <TooltipContent>Subir</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Descer ${label}`}
              disabled={!canMoveDown || pending}
              onClick={() => onMove("down")}
            />
          }
        >
          <ChevronDown />
        </TooltipTrigger>
        <TooltipContent>Descer</TooltipContent>
      </Tooltip>
    </div>
  );
}
