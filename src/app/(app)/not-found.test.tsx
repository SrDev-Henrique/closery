import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AppNotFound from "@/app/(app)/not-found";

describe("(app)/not-found.tsx", () => {
  it("mostra o título 'Página não encontrada'", () => {
    render(<AppNotFound />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Página não encontrada" }),
    ).toBeInTheDocument();
  });

  it("não cria um <main> próprio: o SidebarInset do shell já é o main", () => {
    render(<AppNotFound />);

    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });

  it("o link 'Voltar ao início' aponta para / e é um link, não um botão", () => {
    render(<AppNotFound />);

    expect(
      screen.getByRole("link", { name: "Voltar ao início" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.queryByRole("button", { name: "Voltar ao início" }),
    ).not.toBeInTheDocument();
  });
});
