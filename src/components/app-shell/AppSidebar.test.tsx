import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/components/app-shell/AppSidebar";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const mocks = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

// Expõe o estado da gaveta do celular e deixa o teste abri-la.
function MobileSheetProbe() {
  const { openMobile, setOpenMobile } = useSidebar();
  return (
    <>
      <output aria-label="gaveta">{openMobile ? "aberta" : "fechada"}</output>
      <button type="button" onClick={() => setOpenMobile(true)}>
        abrir gaveta
      </button>
    </>
  );
}

function renderSidebar(props: Partial<Parameters<typeof AppSidebar>[0]> = {}) {
  return render(
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar
          isAdmin={false}
          userName="Maria Souza"
          userEmail="maria@example.com"
          {...props}
        />
        <MobileSheetProbe />
      </SidebarProvider>
    </TooltipProvider>,
  );
}

describe("AppSidebar", () => {
  beforeEach(() => {
    mocks.pathname = "/";
  });

  it("operador vê Início e Conta, e não vê Administração", () => {
    renderSidebar({ isAdmin: false });

    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Conta" })).toHaveAttribute(
      "href",
      "/conta",
    );
    expect(
      screen.queryByRole("link", { name: "Administração" }),
    ).not.toBeInTheDocument();
  });

  it("admin vê Administração apontando para /admin", () => {
    renderSidebar({ isAdmin: true });

    expect(screen.getByRole("link", { name: "Administração" })).toHaveAttribute(
      "href",
      "/admin",
    );
  });

  it("marca só o item da rota atual com aria-current", () => {
    mocks.pathname = "/conta";
    renderSidebar({ isAdmin: true });

    expect(screen.getByRole("link", { name: "Conta" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Início" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(
      screen.getByRole("link", { name: "Administração" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("Início fica ativo na raiz", () => {
    mocks.pathname = "/";
    renderSidebar();

    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("subrota de /admin mantém Administração ativo", () => {
    mocks.pathname = "/admin/equipe";
    renderSidebar({ isAdmin: true });

    expect(screen.getByRole("link", { name: "Administração" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("rota fora do menu não marca nenhum item", () => {
    mocks.pathname = "/bem-vindo";
    renderSidebar({ isAdmin: true });

    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("mostra nome e e-mail da pessoa no rodapé", () => {
    renderSidebar({ userName: "Maria Souza", userEmail: "maria@example.com" });

    expect(screen.getByText("Maria Souza")).toBeInTheDocument();
    expect(screen.getByText("maria@example.com")).toBeInTheDocument();
  });

  it("fecha a gaveta do celular ao navegar", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: "abrir gaveta" }));
    expect(screen.getByLabelText("gaveta")).toHaveTextContent("aberta");

    await user.click(screen.getByRole("link", { name: "Conta" }));
    expect(screen.getByLabelText("gaveta")).toHaveTextContent("fechada");
  });
});
