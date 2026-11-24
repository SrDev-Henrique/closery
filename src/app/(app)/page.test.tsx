import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomePage, * as pageModule from "./page";

// Os conteúdos reais são async (sessão e banco); aqui eles nunca resolvem,
// então cada Suspense mantém o esqueleto na tela.
vi.mock("@/components/app-shell/Greeting", () => ({
  Greeting: () => {
    throw new Promise(() => {});
  },
}));
vi.mock("@/components/passagens/HomeHandovers", () => ({
  HomeHandovers: () => {
    throw new Promise(() => {});
  },
}));

describe("/ (Início)", () => {
  it("enquanto carrega, o esqueleto tem a saudação e 3 cartões (passagens e solicitações)", () => {
    const { container } = render(
      <HomePage searchParams={Promise.resolve({})} />,
    );

    // 2 linhas da saudação + 3 cartões altos.
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(
      5,
    );
    expect(
      container.querySelectorAll('[data-slot="skeleton"].h-40'),
    ).toHaveLength(3);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("exporta só o componente e o título 'Início'", () => {
    expect(Object.keys(pageModule).sort()).toEqual(["default", "metadata"]);
    expect(pageModule.metadata).toEqual({ title: "Início" });
  });
});
