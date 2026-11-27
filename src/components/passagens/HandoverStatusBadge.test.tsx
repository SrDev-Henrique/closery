import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HandoverStatusBadge, SITUATION_STYLE } from "./HandoverStatusBadge";

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

describe("SITUATION_STYLE", () => {
  it("exporta o ícone e as classes de token de cada situação (o anel do dashboard reusa o ícone)", () => {
    expect(
      Object.fromEntries(
        Object.entries(SITUATION_STYLE).map(([situation, style]) => [
          situation,
          style.className,
        ]),
      ),
    ).toEqual({
      awaiting: "bg-info text-info-foreground",
      confirmed: "bg-success text-success-foreground",
      unconfirmed: "bg-warning text-warning-foreground",
      missing: "bg-accent text-muted-foreground",
    });
    for (const { icon: Icon } of Object.values(SITUATION_STYLE)) {
      const { container, unmount } = render(<Icon aria-hidden="true" />);
      expect(container.querySelector("svg")).not.toBeNull();
      unmount();
    }
  });

  it("nenhuma situação usa o fundo do próprio card (no tema novo muted = secondary = card, e o selo sumia na linha)", () => {
    for (const style of Object.values(SITUATION_STYLE)) {
      expect(style.className).not.toMatch(
        /(?:^|\s)bg-(?:muted|secondary|card|background)(?:\s|$)/,
      );
    }
  });
});
