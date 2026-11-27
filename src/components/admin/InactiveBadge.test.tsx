import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InactiveBadge } from "./InactiveBadge";

describe("InactiveBadge", () => {
  it("mostra o texto 'Inativo' (nunca só cor)", () => {
    render(<InactiveBadge />);
    expect(screen.getByText("Inativo")).toBeInTheDocument();
  });

  it("usa o selo neutro (accent): o secondary é igual ao card na paleta nova e a pílula sumia", () => {
    render(<InactiveBadge />);
    const badge = screen.getByText("Inativo");
    expect(badge).toHaveClass("bg-accent");
    expect(badge).not.toHaveClass("bg-secondary");
  });
});
