import { cn } from "cn";
import { describe, expect, it } from "vitest";

import { buttonVariants } from "@/components/ui/button";

const VARIANTS = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
  "surface",
  "on-pastel",
  "on-pastel-secondary",
] as const;

const SIZES = [
  "default",
  "xs",
  "sm",
  "lg",
  "icon",
  "icon-xs",
  "icon-sm",
  "icon-lg",
  "pill",
  "icon-pill",
] as const;

function classesOf(options: Parameters<typeof buttonVariants>[0]): string[] {
  return buttonVariants(options).split(/\s+/);
}

describe("buttonVariants — forma de pílula (C-V2)", () => {
  it.each(SIZES)("size=%s é rounded-full", (size) => {
    expect(classesOf({ size })).toContain("rounded-full");
  });

  it.each(
    SIZES,
  )("size=%s não carrega raio próprio (nenhum rounded-lg nem rounded-[min(...)])", (size) => {
    const radii = classesOf({ size }).filter((name) =>
      name.includes("rounded"),
    );
    expect(radii).toEqual(["rounded-full"]);
  });

  it.each(
    VARIANTS,
  )("variant=%s mantém a pílula e o anel de foco", (variant) => {
    const classes = classesOf({ variant });
    expect(classes).toContain("rounded-full");
    expect(classes).toContain("focus-visible:ring-3");
  });
});

describe("buttonVariants — variantes novas só com tokens", () => {
  it("surface usa card e vai para accent no hover", () => {
    const classes = classesOf({ variant: "surface" });
    expect(classes).toEqual(
      expect.arrayContaining([
        "bg-card",
        "text-card-foreground",
        "hover:bg-accent",
      ]),
    );
  });

  it("on-pastel usa tinta e texto fixos e encolhe ao apertar", () => {
    const classes = classesOf({ variant: "on-pastel" });
    expect(classes).toEqual(
      expect.arrayContaining([
        "bg-on-pastel",
        "text-on-pastel-ink",
        "active:scale-[.97]",
      ]),
    );
  });

  it("on-pastel-secondary usa o fundo translúcido e o hover próprio", () => {
    const classes = classesOf({ variant: "on-pastel-secondary" });
    expect(classes).toEqual(
      expect.arrayContaining([
        "bg-on-pastel-secondary",
        "hover:bg-on-pastel-secondary-hover",
        "text-on-pastel",
      ]),
    );
  });

  it("nenhuma variante usa hex cru nem cor crua do Tailwind", () => {
    for (const variant of VARIANTS) {
      expect(buttonVariants({ variant })).not.toMatch(
        /#[0-9a-f]{3,8}\b|\b(?:bg|text|border|ring)-(?:red|blue|green|yellow|pink|purple|gray|slate|zinc|neutral|stone|amber|orange|white|black)\b/i,
      );
    }
  });
});

describe("buttonVariants — tamanhos novos", () => {
  it("pill: 48px, Satoshi 16px/700, px 22px, gap 10px, ícone de 18px", () => {
    const classes = classesOf({ size: "pill" });
    expect(classes).toEqual(
      expect.arrayContaining([
        "h-12",
        "font-heading",
        "text-base",
        "font-bold",
        "px-[22px]",
        "gap-2.5",
        "[&_svg:not([class*='size-'])]:size-[18px]",
      ]),
    );
  });

  it("os botões pílula de 20px do protótipo (surface, default e secundários on-pastel) trocam o px pelo cn, sem dois paddings", () => {
    // Protótipo: 22px só nos primários dentro de card colorido; "Ver o
    // dashboard", "Ver solicitações", "Agora não" e "Ver todas as passagens"
    // usam 20px.
    const classes = cn(
      buttonVariants({ variant: "surface", size: "pill" }),
      "px-5",
    ).split(/\s+/);
    expect(classes).toContain("px-5");
    expect(classes).not.toContain("px-[22px]");
  });

  it("icon-pill: redondo de 44px", () => {
    expect(classesOf({ size: "icon-pill" })).toEqual(
      expect.arrayContaining(["size-11", "rounded-full"]),
    );
  });

  it("a base não traz mais tamanho de texto: cada size declara o seu (sem font-size duplicado)", () => {
    for (const size of SIZES) {
      const fontSizes = classesOf({ size }).filter((name) =>
        /^text-(?:xs|sm|base|lg|\[0\.8rem\])$/.test(name),
      );
      expect(fontSizes, `size=${size}`).toHaveLength(1);
    }
  });

  it("os tamanhos antigos mantêm o texto de antes", () => {
    expect(classesOf({ size: "default" })).toContain("text-sm");
    expect(classesOf({ size: "xs" })).toContain("text-xs");
    expect(classesOf({ size: "sm" })).toContain("text-[0.8rem]");
    expect(classesOf({ size: "lg" })).toContain("text-sm");
  });
});
