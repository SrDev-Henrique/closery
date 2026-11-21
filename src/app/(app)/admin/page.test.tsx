import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminPage, * as pageModule from "./page";

// O conteúdo real é async (sessão e banco); aqui ele nunca resolve, então o
// Suspense mantém o fallback na tela.
vi.mock("@/components/app-shell/AdminOverview", () => ({
  AdminOverview: () => {
    throw new Promise(() => {});
  },
}));

describe("/admin (página)", () => {
  it("enquanto carrega, mostra o esqueleto dos 5 cartões e nenhum título", () => {
    const { container } = render(<AdminPage />);

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(
      7,
    );
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("não exporta metadata (o <title> revelaria a página ao operador)", () => {
    expect(Object.keys(pageModule)).toEqual(["default"]);
  });
});
