import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  heightUnit,
  MIN_DESKTOP_UNIT,
  TOUCH_UNIT,
} from "../../../test/touchTargets";

describe("SidebarMenuButton — alvos de toque (ui-rules §1.4)", () => {
  it("o tamanho default tem h-9 no desktop e h-11 abaixo de md", () => {
    render(
      <TooltipProvider>
        <SidebarProvider>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>Início</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarProvider>
      </TooltipProvider>,
    );
    const className = screen.getByRole("button", { name: "Início" }).className;
    expect(heightUnit(className, "")).toBeGreaterThanOrEqual(MIN_DESKTOP_UNIT);
    expect(heightUnit(className, "max-md:")).toBe(TOUCH_UNIT);
  });
});
