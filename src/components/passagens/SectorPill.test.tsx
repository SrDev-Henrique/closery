import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SECTOR_COLORS } from "@/features/sectors/colors";
import { SectorPill } from "./SectorPill";

describe("SectorPill", () => {
  it("mostra o rótulo 'Setor' e o nome do setor", () => {
    const { container } = render(<SectorPill name="ULD" color="lilac" />);

    const pill = container.querySelector('[data-slot="sector-pill"]');
    expect(pill).toHaveTextContent("Setor");
    expect(pill).toHaveTextContent("ULD");
    expect(screen.getByText("ULD")).toHaveClass("font-heading", "font-bold");
  });

  it("é só leitura: não é botão, link nem campo", () => {
    render(<SectorPill name="ULD" color="lilac" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it.each(
    SECTOR_COLORS.map((color) => [color, `bg-sector-${color}`]),
  )("a bolinha de %s usa %s e some para o leitor de tela", (color, token) => {
    const { container } = render(
      <SectorPill
        name="Carga"
        color={color as (typeof SECTOR_COLORS)[number]}
      />,
    );

    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).toHaveClass(token, "size-2.5", "rounded-full");
  });

  it("tem 48px de altura, fundo de card e formato de pílula", () => {
    const { container } = render(<SectorPill name="ULD" color="sky" />);

    expect(container.firstElementChild).toHaveClass(
      "h-12",
      "rounded-full",
      "bg-card",
    );
  });

  it("nome longo vira reticências em vez de quebrar a linha", () => {
    render(
      <SectorPill
        name="Operações de carga internacional e transbordo"
        color="peach"
      />,
    );

    expect(
      screen.getByText("Operações de carga internacional e transbordo"),
    ).toHaveClass("truncate", "min-w-0");
  });
});
