import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminPageHeader } from "./AdminPageHeader";

describe("AdminPageHeader", () => {
  it("mostra o título como h1 e a descrição", () => {
    render(
      <AdminPageHeader title="Setores" description="Onde cada um trabalha." />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Setores" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Onde cada um trabalha.")).toBeInTheDocument();
  });

  it("sem backHref não mostra o link de voltar", () => {
    render(<AdminPageHeader title="Administração" description="Cadastros." />);

    expect(
      screen.queryByRole("link", { name: "Voltar para Administração" }),
    ).not.toBeInTheDocument();
  });

  it("com backHref mostra o link 'Voltar para Administração' para /admin", () => {
    render(
      <AdminPageHeader
        title="Setores"
        description="Onde cada um trabalha."
        backHref="/admin"
      />,
    );

    expect(
      screen.getByRole("link", { name: "Voltar para Administração" }),
    ).toHaveAttribute("href", "/admin");
  });
});
