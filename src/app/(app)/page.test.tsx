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
  it("enquanto carrega, o esqueleto tem o eyebrow, o título, a linha do hero e 2 cartões de 32px", () => {
    const { container } = render(
      <HomePage searchParams={Promise.resolve({})} />,
    );

    // eyebrow + título + linha do seletor + 2 cartões.
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(
      5,
    );
    expect(
      container.querySelectorAll(
        '[data-slot="skeleton"][class~="rounded-[32px]"]',
      ),
    ).toHaveLength(2);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("os esqueletos reproduzem o espaçamento do hero (sem gap no contêiner da página)", () => {
    const { container } = render(
      <HomePage searchParams={Promise.resolve({})} />,
    );

    expect(container.firstElementChild).toHaveClass("flex", "flex-col");
    expect(container.firstElementChild).not.toHaveClass("gap-6");
    const [eyebrow, title] = container.querySelectorAll(
      '[data-slot="skeleton"]',
    );
    expect(eyebrow).toHaveClass("h-3.5");
    expect(title).toHaveClass("rounded-2xl");
    expect(title?.parentElement).toHaveClass("gap-3.5", "pt-7", "max-md:pt-3");
    expect(
      container.querySelector('[data-slot="skeleton-hero-row"]'),
    ).toHaveClass("pt-8", "pb-10", "max-md:pt-6", "max-md:pb-7");
  });

  it("exporta só o componente e o título 'Início'", () => {
    expect(Object.keys(pageModule).sort()).toEqual(["default", "metadata"]);
    expect(pageModule.metadata).toEqual({ title: "Início" });
  });
});
