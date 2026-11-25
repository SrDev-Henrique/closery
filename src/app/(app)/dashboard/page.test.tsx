import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardPage, * as pageModule from "./page";

// O conteúdo real é async (sessão e banco); aqui ele nunca resolve, então o
// Suspense mantém o esqueleto na tela.
vi.mock("@/components/dashboard/DashboardScreen", () => ({
  DashboardScreen: () => {
    throw new Promise(() => {});
  },
}));

describe("/dashboard", () => {
  it("enquanto carrega, mostra o esqueleto com os quatro blocos e nenhum número", () => {
    const { container } = render(
      <DashboardPage searchParams={Promise.resolve({})} />,
    );

    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(["Passagens", "Controles", "Estoque", "Solicitações"]);
    expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(4);
    expect(container.textContent).not.toMatch(/\d/);
  });

  it("exporta só o componente e o título 'Dashboard'", () => {
    expect(Object.keys(pageModule).sort()).toEqual(["default", "metadata"]);
    expect(pageModule.metadata).toEqual({ title: "Dashboard" });
  });
});
