"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Botão só com ícone: aria-label + tooltip (regra do AGENTS.md).
export function MenuToggle() {
  return (
    <Tooltip>
      <TooltipTrigger render={<SidebarTrigger aria-label="Alternar menu" />} />
      <TooltipContent>Alternar menu</TooltipContent>
    </Tooltip>
  );
}
