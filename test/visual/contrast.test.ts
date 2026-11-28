import { runInNewContext, Script } from "node:vm";
import { describe, expect, it } from "vitest";

import {
  auditScript,
  contrastRatio,
  luminance,
  over,
  parseColor,
  requiredRatio,
} from "../../scripts/visual/contrast.mjs";

// As contas da auditoria de legibilidade (spec §5.3): as mesmas funções rodam no Vitest e,
// montadas pelo auditScript(), dentro da página.

describe("parseColor", () => {
  it("lê rgb, rgba, a sintaxe com espaço e barra, e transparent", () => {
    expect(parseColor("rgb(1, 2, 3)")).toEqual([1, 2, 3, 1]);
    expect(parseColor("rgba(255, 0, 255, 0.5)")).toEqual([255, 0, 255, 0.5]);
    expect(parseColor("rgb(10 20 30 / 0.25)")).toEqual([10, 20, 30, 0.25]);
    expect(parseColor("rgb(10 20 30 / 50%)")).toEqual([10, 20, 30, 0.5]);
    expect(parseColor(" RGB(0, 0, 0) ")).toEqual([0, 0, 0, 1]);
    expect(parseColor("transparent")).toEqual([0, 0, 0, 0]);
  });

  it("converte oklab, oklch e color(srgb) (o color-mix do Tailwind 4) para sRGB", () => {
    const near = (css: string, want: number[]) => {
      const got = parseColor(css);
      expect(got).not.toBeNull();
      for (let i = 0; i < 3; i++) {
        expect(Math.abs((got as number[])[i] - want[i])).toBeLessThan(1.5);
      }
      expect((got as number[])[3]).toBeCloseTo(want[3], 5);
    };
    near("oklab(0.222465 0.000398837 0.00410654 / 0.7)", [28, 27, 25, 0.7]);
    near("oklab(0.320692 -0.000637546 0.00706178 / 0.5)", [52, 51, 47, 0.5]);
    near("oklab(1 0 0)", [255, 255, 255, 1]);
    near("oklab(0 0 0)", [0, 0, 0, 1]);
    near("oklch(1 0 0)", [255, 255, 255, 1]);
    near("oklch(0.5 0 0 / 50%)", [99, 99, 99, 0.5]);
    near("color(srgb 1 0 0.5 / 0.25)", [255, 0, 127.5, 0.25]);
    near("oklab(50% 0 0)", [99, 99, 99, 1]);
  });

  it("o que não é sRGB conhecido, fora da faixa ou lixo vira null", () => {
    expect(parseColor("oklch(0.5 0.1)")).toBeNull();
    expect(parseColor("oklab(a b c)")).toBeNull();
    expect(parseColor("oklab(0.5 0 0 / 2)")).toBeNull();
    expect(parseColor("lab(50 0 0)")).toBeNull();
    expect(parseColor("#ffffff")).toBeNull();
    expect(parseColor("rgb(256, 0, 0)")).toBeNull();
    expect(parseColor("rgba(0, 0, 0, 2)")).toBeNull();
    expect(parseColor("rgb(1, 2)")).toBeNull();
    expect(parseColor("rgb(a, b, c)")).toBeNull();
    expect(parseColor("")).toBeNull();
    expect(parseColor(undefined)).toBeNull();
  });
});

describe("over", () => {
  it("opaco fica como está; transparente mostra o de baixo; metade mistura", () => {
    expect(over([10, 20, 30, 1], [200, 200, 200, 1])).toEqual([10, 20, 30, 1]);
    expect(over([10, 20, 30, 0], [200, 200, 200, 1])).toEqual([
      200, 200, 200, 1,
    ]);
    expect(over([0, 0, 0, 0.5], [255, 255, 255, 1])).toEqual([
      127.5, 127.5, 127.5, 1,
    ]);
  });
});

describe("luminance e contrastRatio", () => {
  it("preto é 0, branco é 1", () => {
    expect(luminance([0, 0, 0])).toBe(0);
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 10);
  });

  it("razões conhecidas: 21 no máximo, 1 com a mesma cor, simétrica", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrastRatio([119, 119, 119], [119, 119, 119])).toBe(1);
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5);
    // #777 sobre branco: 4,48 (o caso clássico que reprova no AA por pouco).
    expect(contrastRatio([119, 119, 119], [255, 255, 255])).toBeCloseTo(
      4.48,
      2,
    );
  });
});

describe("requiredRatio", () => {
  it("4,5 para texto normal; 3 para grande (24px, ou 18,66px em negrito)", () => {
    expect(requiredRatio(16, 400)).toBe(4.5);
    expect(requiredRatio(23.9, 900)).toBe(3);
    expect(requiredRatio(24, 400)).toBe(3);
    expect(requiredRatio(18.66, 700)).toBe(3);
    expect(requiredRatio(18.66, 600)).toBe(4.5);
    expect(requiredRatio(18, 700)).toBe(4.5);
    expect(requiredRatio(0, 0)).toBe(4.5);
  });
});

describe("auditScript", () => {
  it("é uma expressão que compila, com as seis funções dentro", () => {
    const script = auditScript();
    expect(() => new Script(script)).not.toThrow();
    for (const name of [
      "parseColor",
      "over",
      "luminance",
      "contrastRatio",
      "requiredRatio",
      "auditPage",
    ]) {
      expect(script).toContain(`function ${name}(`);
    }
  });

  it("as funções de cor não dependem de nada de fora (rodam sozinhas, num contexto vazio)", () => {
    const source = `${String(parseColor)}\n${String(over)}\n${String(luminance)}\n${String(contrastRatio)}\n${String(requiredRatio)}\n[parseColor("rgba(0, 0, 0, 0.5)"), contrastRatio([0, 0, 0], [255, 255, 255]), requiredRatio(24, 400)]`;
    const [color, ratio, need] = runInNewContext(source, {}) as [
      number[],
      number,
      number,
    ];
    expect([...color]).toEqual([0, 0, 0, 0.5]);
    expect(ratio).toBeCloseTo(21, 5);
    expect(need).toBe(3);
  });

  it("parseColor roda sozinho num contexto vazio também com oklab", () => {
    const [color] = runInNewContext(
      `${String(parseColor)}
[parseColor("oklab(1 0 0 / 0.5)")]`,
      {},
    ) as [number[]];
    expect(Math.round(color[0])).toBe(255);
    expect(color[3]).toBe(0.5);
  });

  it("o script conta os elementos pulados por cor que não foi lida (skipped)", () => {
    expect(auditScript()).toContain("skipped");
  });
});
