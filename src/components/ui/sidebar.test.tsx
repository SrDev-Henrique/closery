import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Sidebar,
  SidebarContent,
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

describe("Sidebar — visual novo (280px, sem borda)", () => {
  function renderDesktop() {
    return render(
      <TooltipProvider>
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>conteúdo</SidebarContent>
          </Sidebar>
        </SidebarProvider>
      </TooltipProvider>,
    );
  }

  it("a largura da barra é 17.5rem (280px)", () => {
    const { container } = renderDesktop();
    const wrapper = container.querySelector<HTMLElement>(
      '[data-slot="sidebar-wrapper"]',
    );
    expect(wrapper?.style.getPropertyValue("--sidebar-width")).toBe("17.5rem");
  });

  it("no desktop a barra não tem borda lateral", () => {
    const { container } = renderDesktop();
    const panel = container.querySelector<HTMLElement>(
      '[data-slot="sidebar-container"]',
    );
    expect(panel).not.toBeNull();
    expect(panel?.className).not.toMatch(/(^|[\s:])border-[rl]($|\s)/);
  });

  it("o corpo da barra usa o token bg-sidebar", () => {
    const { container } = renderDesktop();
    const inner = container.querySelector<HTMLElement>(
      '[data-slot="sidebar-inner"]',
    );
    expect(inner?.className).toContain("bg-sidebar");
  });
});
