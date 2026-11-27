import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge, badgeVariants } from "./badge";

function badge(text: string): HTMLElement {
  return screen.getByText(text);
}

describe("Badge — forma", () => {
  it("é pílula e nunca quebra linha", () => {
    render(<Badge>Rascunho</Badge>);
    expect(badge("Rascunho")).toHaveClass("rounded-full", "whitespace-nowrap");
    expect(badge("Rascunho")).not.toHaveClass("rounded-4xl");
  });

  it("o tamanho padrão continua com 20px (h-5), text-xs e font-medium", () => {
    render(<Badge>Padrão</Badge>);
    expect(badge("Padrão")).toHaveClass(
      "h-5",
      "px-2",
      "text-xs",
      "font-medium",
    );
  });

  it("size=md tem 24px, px 10px, 12px/600 e não carrega o h-5", () => {
    render(<Badge size="md">Médio</Badge>);
    const el = badge("Médio");
    expect(el).toHaveClass("h-6", "px-2.5", "text-xs", "font-semibold");
    expect(el).not.toHaveClass("h-5");
    expect(el).not.toHaveClass("font-medium");
  });

  it("size=md não tem a borda de 1px da base: o padding de 10px é a folga toda, como no protótipo", () => {
    render(<Badge size="md">Sem borda</Badge>);
    expect(badge("Sem borda")).toHaveClass("border-0");
  });

  it("size=md usa a altura de linha normal da fonte (o texto fica centrado como no protótipo)", () => {
    render(<Badge size="md">Linha</Badge>);
    expect(badge("Linha")).toHaveClass("leading-[normal]");
  });
});

describe("Badge — variantes novas só com tokens", () => {
  it.each([
    ["warning", "bg-warning", "text-warning-foreground"],
    ["info", "bg-info", "text-info-foreground"],
    ["success", "bg-success", "text-success-foreground"],
    ["neutral", "bg-accent", "text-foreground"],
  ] as const)("variant=%s usa %s e %s", (variant, background, foreground) => {
    render(<Badge variant={variant}>Texto</Badge>);
    expect(badge("Texto")).toHaveClass(background, foreground);
  });

  it("className de quem usa ainda vence a variante (o StaleBadge depende disso)", () => {
    render(
      <Badge variant="secondary" className="bg-warning text-warning-foreground">
        Parada
      </Badge>,
    );
    expect(badge("Parada")).toHaveClass(
      "bg-warning",
      "text-warning-foreground",
    );
    expect(badge("Parada")).not.toHaveClass("bg-secondary");
  });

  it("as variantes pastel-pending e pastel-confirmed saíram (o cartão de turno usa blocos, spec §6.4.1)", () => {
    // @ts-expect-error variante removida no pack de correção do Início
    const pending = badgeVariants({ variant: "pastel-pending" });
    // @ts-expect-error variante removida no pack de correção do Início
    const confirmed = badgeVariants({ variant: "pastel-confirmed" });
    expect(pending).not.toMatch(/pastel/);
    expect(confirmed).not.toMatch(/pastel/);
  });

  it("nenhuma variante usa hex cru nem cor crua do Tailwind", () => {
    for (const variant of ["warning", "info", "success", "neutral"] as const) {
      expect(badgeVariants({ variant })).not.toMatch(
        /#[0-9a-f]{3,8}\b|\b(?:bg|text|border)-(?:red|blue|green|yellow|pink|purple|gray|slate|zinc|neutral|stone|amber|orange|white|black)\b/i,
      );
    }
  });

  it("badgeVariants cru (sem twMerge) tem uma altura só por tamanho", () => {
    const padrao = badgeVariants({}).split(/\s+/);
    const medio = badgeVariants({ size: "md" }).split(/\s+/);
    expect(padrao.filter((name) => /^h-\d/.test(name))).toEqual(["h-5"]);
    expect(medio.filter((name) => /^h-\d/.test(name))).toEqual(["h-6"]);
    expect(
      medio.filter((name) => /^font-(?:medium|semibold)$/.test(name)),
    ).toEqual(["font-semibold"]);
  });
});
