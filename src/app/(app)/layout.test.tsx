import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AppLayout from "./layout";

vi.mock("@/components/app-shell/AuthedSidebar", () => ({
  AuthedSidebar: () => null,
}));
vi.mock("@/components/app-shell/SessionKeepAlive", () => ({
  SessionKeepAlive: () => null,
}));

describe("AppLayout", () => {
  it("renderiza a página (children) e o slot detalhe", () => {
    render(
      AppLayout({
        params: Promise.resolve({}),
        children: <p>conteúdo da página</p>,
        detalhe: <p>conteúdo do slot</p>,
      }),
    );

    expect(screen.getByText("conteúdo da página")).toBeInTheDocument();
    expect(screen.getByText("conteúdo do slot")).toBeInTheDocument();
  });

  it("o slot vem depois da página (o Sheet fica por cima)", () => {
    render(
      AppLayout({
        params: Promise.resolve({}),
        children: <p>conteúdo da página</p>,
        detalhe: <p>conteúdo do slot</p>,
      }),
    );

    const page = screen.getByText("conteúdo da página");
    const slot = screen.getByText("conteúdo do slot");
    expect(
      page.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("slot vazio (null) não quebra o layout", () => {
    render(
      AppLayout({
        params: Promise.resolve({}),
        children: <p>conteúdo da página</p>,
        detalhe: null,
      }),
    );

    expect(screen.getByText("conteúdo da página")).toBeInTheDocument();
  });
});
