import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StaleBadge } from "./StaleBadge";

describe("StaleBadge", () => {
  it("plural: 'Parada há 5 dias', com ícone e a cor do token warning", () => {
    const { container } = render(<StaleBadge days={5} />);

    const badge = screen.getByText("Parada há 5 dias");
    expect(badge).toHaveClass("bg-warning", "text-warning-foreground");
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("é pílula de 24px e nunca quebra linha", () => {
    render(<StaleBadge days={12} />);

    expect(screen.getByText("Parada há 12 dias")).toHaveClass(
      "h-6",
      "rounded-full",
      "whitespace-nowrap",
    );
  });

  it("singular: 'Parada há 1 dia'", () => {
    render(<StaleBadge days={1} />);

    expect(screen.getByText("Parada há 1 dia")).toBeInTheDocument();
  });

  it("zero dias (parada por horas, ainda no 1º dia completo): 'Parada há 0 dias'", () => {
    render(<StaleBadge days={0} />);

    expect(screen.getByText("Parada há 0 dias")).toBeInTheDocument();
  });

  it("usa só tokens de cor", () => {
    const { container } = render(<StaleBadge days={3} />);

    expect(container.innerHTML).not.toMatch(
      /\b(?:bg|text|border)-(?:red|green|blue|yellow|amber|orange|gray|slate|zinc)-\d+/,
    );
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
