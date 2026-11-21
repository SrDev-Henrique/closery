import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HandoverStatusBadge } from "./HandoverStatusBadge";

describe("HandoverStatusBadge", () => {
  it.each([
    ["awaiting", "Aguardando recebimento"],
    ["unconfirmed", "Não confirmada"],
    ["missing", "Sem passagem"],
    ["confirmed", "Confirmada"],
  ] as const)("%s mostra o texto e um ícone (nunca só cor)", (situation, text) => {
    const { container } = render(<HandoverStatusBadge situation={situation} />);

    expect(screen.getByText(text)).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("confirmada com nome diz quem confirmou", () => {
    render(
      <HandoverStatusBadge situation="confirmed" confirmedByName="Bia Teste" />,
    );

    expect(screen.getByText("Confirmada por Bia Teste")).toBeInTheDocument();
  });

  it("sem 'corrected' não mostra o selo Corrigida", () => {
    render(<HandoverStatusBadge situation="awaiting" />);

    expect(screen.queryByText("Corrigida")).not.toBeInTheDocument();
  });

  it("com 'corrected' mostra o selo Corrigida ao lado da situação", () => {
    render(<HandoverStatusBadge situation="confirmed" corrected />);

    expect(screen.getByText("Corrigida")).toBeInTheDocument();
    expect(screen.getByText("Confirmada")).toBeInTheDocument();
  });

  it("usa só tokens de cor (sem classe crua do Tailwind)", () => {
    const { container } = render(
      <HandoverStatusBadge situation="unconfirmed" corrected />,
    );

    expect(container.innerHTML).not.toMatch(
      /\b(?:bg|text|border)-(?:red|green|blue|yellow|amber|orange|gray|slate|zinc)-\d+/,
    );
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
