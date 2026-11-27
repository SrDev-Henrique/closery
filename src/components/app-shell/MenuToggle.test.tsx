import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MenuToggle } from "@/components/app-shell/MenuToggle";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

function SidebarState() {
  const { state } = useSidebar();
  return <output aria-label="estado da barra">{state}</output>;
}

function setup() {
  return render(
    <TooltipProvider>
      <SidebarProvider>
        <MenuToggle />
        <SidebarState />
      </SidebarProvider>
    </TooltipProvider>,
  );
}

describe("MenuToggle", () => {
  it("é um botão chamado 'Alternar menu'", () => {
    setup();
    expect(
      screen.getByRole("button", { name: "Alternar menu" }),
    ).toBeInTheDocument();
  });

  it("mostra o tooltip 'Alternar menu' ao passar o mouse", async () => {
    setup();
    const button = screen.getByRole("button", { name: "Alternar menu" });
    // Antes do hover só existe o texto sr-only do próprio botão.
    expect(screen.getAllByText("Alternar menu")).toHaveLength(1);
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    fireEvent.mouseEnter(button);
    fireEvent.pointerMove(button, { pointerType: "mouse" });
    fireEvent.mouseMove(button);
    await waitFor(() =>
      expect(screen.getAllByText("Alternar menu")).toHaveLength(2),
    );
  });

  it("clicar alterna a barra lateral", async () => {
    setup();
    const state = screen.getByLabelText("estado da barra");
    expect(state).toHaveTextContent("expanded");
    await userEvent.click(
      screen.getByRole("button", { name: "Alternar menu" }),
    );
    expect(state).toHaveTextContent("collapsed");
  });

  it("clicar duas vezes recolhe e expande de novo (o estado é do SidebarProvider)", async () => {
    setup();
    const state = screen.getByLabelText("estado da barra");
    const button = screen.getByRole("button", { name: "Alternar menu" });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(state).toHaveTextContent("expanded");
  });

  it("é o botão redondo de 44px (surface, icon-pill)", () => {
    setup();
    const classes = screen
      .getByRole("button", { name: "Alternar menu" })
      .className.split(" ");
    expect(classes).toContain("rounded-full");
    // `icon-pill` (Task 4) é `size-11` em qualquer tela, sem `max-md:`.
    expect(classes).toContain("size-11");
    expect(classes).toContain("bg-card");
  });

  it("tem os dois ícones: PanelLeft só no desktop e Menu só no celular", () => {
    const { container } = setup();
    const desktop = container.querySelector<SVGElement>(
      '[data-viewport="desktop"]',
    );
    const mobile = container.querySelector<SVGElement>(
      '[data-viewport="mobile"]',
    );

    expect(desktop).not.toBeNull();
    expect(mobile).not.toBeNull();
    expect(desktop?.getAttribute("class")).toContain("max-md:hidden");
    expect(mobile?.getAttribute("class")).toContain("hidden");
    expect(mobile?.getAttribute("class")).toContain("max-md:block");
    expect(desktop).toHaveAttribute("aria-hidden", "true");
    expect(mobile).toHaveAttribute("aria-hidden", "true");
  });
});
