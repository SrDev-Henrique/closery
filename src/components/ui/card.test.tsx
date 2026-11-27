import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./card";

function card(): HTMLElement {
  const el = document.querySelector('[data-slot="card"]');
  if (!(el instanceof HTMLElement)) throw new Error("Card não renderizou");
  return el;
}

describe("Card — variante default (as outras telas não mudam)", () => {
  it("mantém raio, anel e espaçamento de hoje", () => {
    render(<Card>Conteúdo</Card>);
    expect(card()).toHaveAttribute("data-variant", "default");
    expect(card()).toHaveClass(
      "rounded-xl",
      "ring-1",
      "ring-foreground/10",
      "gap-(--card-spacing)",
      "py-(--card-spacing)",
      "bg-card",
    );
    expect(card()).not.toHaveClass("rounded-[32px]");
  });

  it("size=sm continua trocando o espaçamento", () => {
    render(<Card size="sm">Conteúdo</Card>);
    expect(card()).toHaveAttribute("data-size", "sm");
    expect(card()).toHaveClass("data-[size=sm]:[--card-spacing:--spacing(3)]");
  });
});

describe("Card — variante feature", () => {
  it("tem raio 32px, padding 32px (22px no celular), sem anel, sem sombra e gap 0", () => {
    render(<Card variant="feature">Conteúdo</Card>);
    const el = card();
    expect(el).toHaveAttribute("data-variant", "feature");
    expect(el).toHaveClass(
      "rounded-[32px]",
      "p-(--card-spacing)",
      "[--card-spacing:--spacing(8)]",
      "max-md:[--card-spacing:--spacing(5.5)]",
      "gap-0",
      "bg-card",
    );
    expect(el.className).not.toMatch(/\bring(?:-\d|\b)/);
    expect(el.className).not.toMatch(/\bshadow/);
    expect(el.className).not.toMatch(/\bborder/);
    expect(el).not.toHaveClass("rounded-xl");
    expect(el).not.toHaveClass("gap-(--card-spacing)");
  });

  it("className de quem usa vence o fundo (card colorido)", () => {
    render(
      <Card variant="feature" className="bg-highlight text-on-pastel">
        Conteúdo
      </Card>,
    );
    expect(card()).toHaveClass("bg-highlight", "text-on-pastel");
    expect(card()).not.toHaveClass("bg-card");
  });

  it("não declara hex cru nem cor crua do Tailwind", () => {
    render(<Card variant="feature">Conteúdo</Card>);
    expect(card().className).not.toMatch(
      /#[0-9a-f]{3,8}\b|\b(?:bg|text|border|ring)-(?:red|blue|green|yellow|pink|purple|gray|slate|zinc|neutral|stone|amber|orange|white|black)\b/i,
    );
  });
});

describe("Card — subcomponentes", () => {
  it("continuam renderizando nas duas variantes", () => {
    for (const variant of ["default", "feature"] as const) {
      const { unmount } = render(
        <Card variant={variant}>
          <CardHeader>
            <CardTitle>Título {variant}</CardTitle>
          </CardHeader>
          <CardContent>Corpo {variant}</CardContent>
        </Card>,
      );
      expect(screen.getByText(`Título ${variant}`)).toHaveAttribute(
        "data-slot",
        "card-title",
      );
      expect(screen.getByText(`Corpo ${variant}`)).toHaveAttribute(
        "data-slot",
        "card-content",
      );
      unmount();
    }
  });
});

describe("CardFooter — rodapé em accent (P83)", () => {
  it("se separa do corpo com bg-accent/50 (o bg-muted/50 de antes era o próprio card)", () => {
    render(
      <Card>
        <CardFooter>Rodapé</CardFooter>
      </Card>,
    );
    const footer = screen.getByText("Rodapé");
    expect(footer).toHaveAttribute("data-slot", "card-footer");
    expect(footer).toHaveClass("bg-accent/50");
    expect(footer.className).not.toMatch(/bg-muted/);
  });
});
