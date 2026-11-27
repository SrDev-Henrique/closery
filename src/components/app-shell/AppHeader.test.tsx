import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppHeader } from "@/components/app-shell/AppHeader";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/components/app-shell/ThemeSwitch", () => ({
  ThemeSwitch: () => <div data-testid="theme-switch" />,
}));

function setup() {
  return render(
    <TooltipProvider>
      <SidebarProvider>
        <AppHeader />
      </SidebarProvider>
    </TooltipProvider>,
  );
}

describe("AppHeader", () => {
  it("tem 76px de altura, sem borda inferior", () => {
    const { container } = setup();
    const header = container.querySelector("header");

    expect(header).not.toBeNull();
    const classes = (header?.className ?? "").split(" ");
    expect(classes).toContain("h-[76px]");
    expect(classes).toContain("justify-between");
    expect(classes.some((name) => name.startsWith("border"))).toBe(false);
  });

  it("o botão de menu fica à esquerda e o ThemeSwitch à direita", () => {
    const { container } = setup();
    const header = container.querySelector("header");
    const toggle = screen.getByRole("button", { name: "Alternar menu" });
    const theme = screen.getByTestId("theme-switch");

    expect(header).toContainElement(toggle);
    expect(header).toContainElement(theme);
    expect(
      toggle.compareDocumentPosition(theme) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(header?.lastElementChild).toBe(theme);
  });

  it("o wordmark do cabeçalho só aparece abaixo de 860px (max-md)", () => {
    const { container } = setup();
    const header = container.querySelector("header");
    const wordmark = screen.getByText("Closery");

    expect(header).toContainElement(wordmark);
    const classes = wordmark.className.split(" ");
    expect(classes).toContain("hidden");
    expect(classes).toContain("max-md:inline");
    expect(classes).toContain("font-heading");
    expect(classes).toContain("text-2xl");
  });
});
