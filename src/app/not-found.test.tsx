import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NotFound from "@/app/not-found";

describe("not-found.tsx", () => {
  it("mostra o título 'Página não encontrada'", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: "Página não encontrada" }),
    ).toBeInTheDocument();
  });

  it("o link 'Voltar ao início' aponta para / e é um link, não um botão", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("link", { name: "Voltar ao início" }),
    ).toHaveAttribute("href", "/");
  });
});
