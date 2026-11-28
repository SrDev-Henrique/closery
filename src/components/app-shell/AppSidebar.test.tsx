import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/components/app-shell/AppSidebar";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const mocks = vi.hoisted(() => ({ pathname: "/", isMobile: false }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

// O jsdom não mede viewport: o teste decide se a barra é a do desktop ou a
// gaveta do celular.
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mocks.isMobile,
}));

const AVATAR = "data:image/svg+xml;utf8,avatar-de-teste";

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
          avatarSrc={AVATAR}
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
    mocks.isMobile = false;
  });

  it("operador vê Início, Passagens e Conta, e não vê Administração", () => {
    renderSidebar({ isAdmin: false });

    expect(screen.getByRole("link", { name: "Passagens" })).toHaveAttribute(
      "href",
      "/passagens",
    );

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

  it("operador e admin veem o Dashboard apontando para /dashboard", () => {
    const { unmount } = renderSidebar({ isAdmin: false });
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    unmount();

    renderSidebar({ isAdmin: true });
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("Dashboard fica ativo em /dashboard e só nele", () => {
    mocks.pathname = "/dashboard";
    renderSidebar();

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Passagens" })).not.toHaveAttribute(
      "aria-current",
    );
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

  it("Passagens fica ativo em /passagens/nova e Início não", () => {
    mocks.pathname = "/passagens/nova";
    renderSidebar();

    expect(screen.getByRole("link", { name: "Passagens" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Início" })).not.toHaveAttribute(
      "aria-current",
    );
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

  it("mostra nome e e-mail da pessoa no card do usuário", () => {
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

describe("AppSidebar: forma nova", () => {
  beforeEach(() => {
    mocks.pathname = "/";
    mocks.isMobile = false;
  });

  it("mostra o wordmark Closery", () => {
    renderSidebar();

    const wordmark = screen.getByText("Closery");
    expect(wordmark.className).toContain("font-heading");
    expect(wordmark.className).toContain("font-black");
  });

  it("o grupo Principal tem os cinco itens, na ordem", () => {
    renderSidebar();

    const main = screen.getByRole("navigation", { name: "Principal" });
    expect(
      within(main)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Início", "Passagens", "Solicitações", "Dashboard", "Conta"]);
  });

  it("o grupo Administração existe só para o admin e tem só um item", () => {
    const { unmount } = renderSidebar({ isAdmin: false });
    expect(
      screen.queryByRole("navigation", { name: "Administração" }),
    ).not.toBeInTheDocument();
    unmount();

    renderSidebar({ isAdmin: true });
    const admin = screen.getByRole("navigation", { name: "Administração" });
    expect(within(admin).getAllByRole("link")).toHaveLength(1);
    expect(
      within(admin).getByRole("link", { name: "Administração" }),
    ).toHaveAttribute("href", "/admin");
  });

  it("os itens são pílulas de 48px com a fonte display", () => {
    renderSidebar();

    const classes = screen
      .getByRole("link", { name: "Passagens" })
      .className.split(" ");
    expect(classes).toContain("h-12");
    expect(classes).toContain("rounded-full");
    expect(classes).toContain("font-heading");
    expect(classes).toContain("data-active:bg-primary");
    expect(classes).not.toContain("h-9");
  });

  it("o card do usuário mostra o avatar decorativo e o chip COLEGA", () => {
    const { container } = renderSidebar({ isAdmin: false });

    const avatar = container.querySelector("img");
    expect(avatar).not.toBeNull();
    expect(avatar).toHaveAttribute("src", AVATAR);
    expect(avatar).toHaveAttribute("alt", "");
    expect(screen.getByText("COLEGA")).toBeInTheDocument();
    expect(screen.queryByText("ADMIN")).not.toBeInTheDocument();
  });

  it("admin vê o chip ADMIN, e não COLEGA", () => {
    renderSidebar({ isAdmin: true });

    expect(screen.getByText("ADMIN")).toBeInTheDocument();
    expect(screen.queryByText("COLEGA")).not.toBeInTheDocument();
  });

  it("nome e e-mail muito longos ficam truncados (não estouram o card)", () => {
    renderSidebar({
      userName: "Fulana de Tal da Silva Sauro Teste Muito Comprida",
      userEmail: "endereco.muito.comprido.de.teste@example.com",
    });

    expect(
      screen.getByText("Fulana de Tal da Silva Sauro Teste Muito Comprida")
        .className,
    ).toContain("truncate");
    expect(
      screen.getByText("endereco.muito.comprido.de.teste@example.com")
        .className,
    ).toContain("truncate");
  });

  it("no desktop não existe o botão Fechar menu (ele é só do drawer)", () => {
    renderSidebar();

    expect(
      screen.queryByRole("button", { name: "Fechar menu" }),
    ).not.toBeInTheDocument();
  });
});

describe("AppSidebar: drawer do celular", () => {
  beforeEach(() => {
    mocks.pathname = "/";
    mocks.isMobile = true;
  });

  it("aberto, mostra o botão X e ele fecha a gaveta", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: "abrir gaveta" }));
    expect(screen.getByLabelText("gaveta")).toHaveTextContent("aberta");

    await user.click(
      await screen.findByRole("button", { name: "Fechar menu" }),
    );
    expect(screen.getByLabelText("gaveta")).toHaveTextContent("fechada");
  });

  it("tocar num item fecha a gaveta e o item ativo mantém aria-current", async () => {
    const user = userEvent.setup();
    mocks.pathname = "/conta";
    renderSidebar();

    await user.click(screen.getByRole("button", { name: "abrir gaveta" }));
    const conta = await screen.findByRole("link", { name: "Conta" });
    expect(conta).toHaveAttribute("aria-current", "page");

    await user.click(conta);
    expect(screen.getByLabelText("gaveta")).toHaveTextContent("fechada");
  });

  it("a gaveta tem 280px, sem borda, com a sombra do token, e o scrim é o token bg-scrim sem blur", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: "abrir gaveta" }));
    await screen.findByRole("button", { name: "Fechar menu" });

    const panel = document.querySelector<HTMLElement>('[data-mobile="true"]');
    const scrim = document.querySelector<HTMLElement>(
      '[data-slot="sheet-overlay"]',
    );
    expect(panel).not.toBeNull();
    expect(scrim).not.toBeNull();

    const panelClasses = (panel?.className ?? "").split(" ");
    expect(panelClasses).toContain("data-[side=left]:w-(--sidebar-width)");
    expect(panelClasses).not.toContain("data-[side=left]:w-3/4");
    expect(panelClasses).toContain("data-[side=left]:border-r-0");
    expect(panelClasses).not.toContain("data-[side=left]:border-r");
    expect(panelClasses).toContain("data-[side=left]:shadow-drawer");
    expect(panel?.className ?? "").not.toMatch(/rgba?\(/);
    // O deslize é do Motion (SheetContent motionKind="drawer"): da borda
    // (−105%), opaca, sem transição nem estado inicial de CSS (os dois
    // correriam atrás do Motion). Sem a MotionTree, fica no primeiro quadro.
    expect(panel?.style.transform).toBe("translateX(-105%)");
    expect(panel?.style.opacity).toBe("1");
    expect(panel?.className ?? "").not.toMatch(
      /duration-|ease-\[|data-starting-style|data-ending-style|motion-reduce/,
    );

    const scrimClasses = (scrim?.className ?? "").split(" ");
    expect(scrimClasses).toContain("bg-scrim");
    expect(scrimClasses).not.toContain("bg-black/10");
    expect(scrimClasses).toContain(
      "supports-backdrop-filter:backdrop-blur-none",
    );
  });

  it("o botão X tem 44px (icon-pill) e o rótulo acessível do protótipo", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: "abrir gaveta" }));
    const close = await screen.findByRole("button", {
      name: "Fechar menu",
    });
    expect(close).toHaveAttribute("aria-label", "Fechar menu");
    // O tamanho em si é testado no Button (Task 4): o `icon-pill` é `size-11`
    // (44px) em qualquer tela; o guarda de 44px do E2E mede de verdade.
    expect(close.className.split(" ")).toContain("size-11");
    expect(close.className).toContain("bg-card");
  });
});
