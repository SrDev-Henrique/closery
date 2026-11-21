import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("mostra título e descrição", () => {
    render(
      <EmptyState
        title="Nenhum setor ainda."
        description="Crie o primeiro setor acima."
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Nenhum setor ainda." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Crie o primeiro setor acima."),
    ).toBeInTheDocument();
  });

  it("sem ação não mostra link", () => {
    render(<EmptyState title="Nenhum setor ainda." />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("a ação é um link (role link) para o destino", () => {
    render(
      <EmptyState
        title="Nenhum setor ativo."
        action={{ label: "Ir para Setores", href: "/admin/setores" }}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Ir para Setores" }),
    ).toHaveAttribute("href", "/admin/setores");
  });
});
