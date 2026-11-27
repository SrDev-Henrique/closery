import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AppLayout from "./layout";

vi.mock("@/components/app-shell/AuthedSidebar", () => ({
  AuthedSidebar: () => null,
}));
vi.mock("@/components/app-shell/SessionKeepAlive", () => ({
  SessionKeepAlive: () => <div data-testid="keep-alive" />,
}));
vi.mock("@/components/app-shell/ThemeSwitch", () => ({
  ThemeSwitch: () => <div data-testid="theme-switch" />,
}));

function renderLayout(detalhe: React.ReactNode = <p>conteúdo do slot</p>) {
  return render(
    AppLayout({
      params: Promise.resolve({}),
      children: <p>conteúdo da página</p>,
      detalhe,
    }),
  );
}

describe("AppLayout", () => {
  it("renderiza a página (children) e o slot detalhe", () => {
    renderLayout();

    expect(screen.getByText("conteúdo da página")).toBeInTheDocument();
    expect(screen.getByText("conteúdo do slot")).toBeInTheDocument();
  });

  it("o slot vem depois da página (o Sheet fica por cima)", () => {
    renderLayout();

    const page = screen.getByText("conteúdo da página");
    const slot = screen.getByText("conteúdo do slot");
    expect(
      page.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("slot vazio (null) não quebra o layout", () => {
    renderLayout(null);

    expect(screen.getByText("conteúdo da página")).toBeInTheDocument();
  });

  it("monta o SessionKeepAlive", () => {
    renderLayout();

    expect(screen.getByTestId("keep-alive")).toBeInTheDocument();
  });

  it("o cabeçalho (menu e tema) fica no topo, antes da página", () => {
    renderLayout();

    const toggle = screen.getByRole("button", { name: "Alternar menu" });
    const theme = screen.getByTestId("theme-switch");
    const page = screen.getByText("conteúdo da página");
    expect(
      toggle.compareDocumentPosition(page) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      theme.compareDocumentPosition(page) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("o @container/main é um invólucro SEM padding na largura toda do SidebarInset (a área útil do protótipo: tela menos sidebar)", () => {
    const { container } = renderLayout();

    const main = container.querySelector<HTMLElement>(
      '[class*="@container/main"]',
    );
    expect(main).not.toBeNull();
    const classes = (main?.className ?? "").split(" ");
    for (const name of [
      "@container/main",
      "flex",
      "w-full",
      "flex-1",
      "flex-col",
    ]) {
      expect(classes).toContain(name);
    }
    // O protótipo mede `mainW` = largura do <main> inteiro, com os 40px de
    // padding dentro: o contêiner da query não pode ter padding nem max-width.
    expect(classes.some((name) => /^(?:max-md:)?p[xlrb]?-/.test(name))).toBe(
      false,
    );
    expect(classes.some((name) => name.startsWith("max-w-"))).toBe(false);
    expect(main?.parentElement).toHaveAttribute("data-slot", "sidebar-inset");
  });

  it("dentro dele, o conteúdo fica centrado em até 1240px, com 40px de padding (16px no celular) e 48px embaixo", () => {
    const { container } = renderLayout();

    const content = container.querySelector<HTMLElement>(
      '[class*="@container/main"] > div',
    );
    expect(content).not.toBeNull();
    const classes = (content?.className ?? "").split(" ");
    for (const name of [
      "mx-auto",
      "flex",
      "w-full",
      "max-w-[1240px]",
      "flex-1",
      "flex-col",
      "px-10",
      "pb-12",
      "max-md:px-4",
    ]) {
      expect(classes).toContain(name);
    }
  });

  it("cabeçalho e página ficam dentro do contêiner; o slot detalhe fica fora dele", () => {
    const { container } = renderLayout();

    const content = container.querySelector<HTMLElement>(
      '[class*="@container/main"]',
    );
    expect(content).toContainElement(
      screen.getByRole("button", { name: "Alternar menu" }),
    );
    expect(content).toContainElement(screen.getByText("conteúdo da página"));
    expect(content).not.toContainElement(screen.getByText("conteúdo do slot"));
  });

  it("não cria um segundo <main> (o SidebarInset já é o <main>)", () => {
    const { container } = renderLayout();

    expect(container.querySelectorAll("main")).toHaveLength(1);
  });
});
