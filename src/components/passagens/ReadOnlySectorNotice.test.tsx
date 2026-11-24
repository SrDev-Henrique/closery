import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReadOnlySectorNotice } from "./ReadOnlySectorNotice";

describe("ReadOnlySectorNotice", () => {
  it("avisa que o setor está inativo e o que fazer, com ícone e texto", () => {
    const { container } = render(<ReadOnlySectorNotice />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Setor inativo: só leitura.");
    expect(alert).toHaveTextContent("Peça a um administrador para reativá-lo.");
    // O ícone é decorativo: o texto já diz tudo.
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("usa só tokens de cor, sem cor crua", () => {
    const { container } = render(<ReadOnlySectorNotice />);

    expect(container.innerHTML).not.toMatch(
      /\b(?:text|bg|border)-(?:red|green|blue|yellow|orange|amber|slate|gray)-\d/,
    );
  });
});
