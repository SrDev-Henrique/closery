"use client";

import { Menu, PanelLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Botão só com ícone: aria-label + tooltip (regra do AGENTS.md). Redondo, 44px
// (`icon-pill`). O ícone troca por CSS, sem esperar o JavaScript: acima de
// 860px é o PanelLeft (recolhe e expande a barra, estado em cookie do
// SidebarProvider); abaixo disso é o Menu (abre a gaveta). `max-md:` é o mesmo
// corte de 860px do useIsMobile.
export function MenuToggle() {
  const { toggleSidebar, isMobile, open, openMobile } = useSidebar();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="surface"
            size="icon-pill"
            aria-label="Alternar menu"
            aria-expanded={isMobile ? openMobile : open}
            onClick={toggleSidebar}
          />
        }
      >
        <PanelLeft
          data-viewport="desktop"
          strokeWidth={2.2}
          aria-hidden="true"
          className="size-[18px] max-md:hidden"
        />
        <Menu
          data-viewport="mobile"
          strokeWidth={2.2}
          aria-hidden="true"
          className="hidden size-[18px] max-md:block"
        />
        <span className="sr-only">Alternar menu</span>
      </TooltipTrigger>
      <TooltipContent>Alternar menu</TooltipContent>
    </Tooltip>
  );
}
