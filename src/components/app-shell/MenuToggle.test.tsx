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
});
