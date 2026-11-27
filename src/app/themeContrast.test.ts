/**
 * Guarda de CONTRASTE do visual novo (spec 2026-11-27, §4.1 e §7). Lê `src/app/globals.css` e mede,
 * nos dois temas, o par texto/fundo de cada superfície e de cada card pastel (AA para texto normal,
 * 4,5:1). Par que reprova se corrige no token; o piso nunca se afrouxa para a paleta passar.
 *
 * Rodar: `bunx vitest run src/app/themeContrast.test.ts`
 * (`VITEST_PRINT_THEME_CONTRAST=1` imprime a matriz medida, para colar em `.context/ui-tokens.md`).
 *
 * Os tokens lidos ficam em `#rrggbb` ou `rgba(r, g, b, a)` (o `rgba` é o dos blocos translúcidos dos
 * cards pastel: o teste compõe o bloco sobre o fundo antes de medir). O CSS é lido por regex: se a folha
 * ganhar nesting que quebre o corte, o teste falha alto (fail-closed).
 *
 * As cores fixas (iguais nos dois temas) vivem só em `:root`; o `.dark` herda. Um teste abaixo
 * garante que o `.dark` não as redefine.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Texto normal (WCAG AA). */
const TEXT_MIN = 4.5;

// ---------------------------------------------------------------- cor
/** sRGB codificado (gama aplicada), cada canal em 0..1. */
type Rgb = [number, number, number];
type Color = { rgb: Rgb; alpha: number };

const HEX = /^#([0-9a-fA-F]{6})$/;
const RGBA =
  /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0?\.\d+|0|1)\s*\)$/;

/** Aceita `#rrggbb` e `rgba(r, g, b, a)`. Qualquer outra forma lança. */
function parseColor(value: string): Color {
  const text = value.trim();
  const hex = HEX.exec(text);
  if (hex?.[1]) {
    const digits = hex[1];
    const channel = (i: number) =>
      Number.parseInt(digits.slice(i, i + 2), 16) / 255;
    return { rgb: [channel(0), channel(2), channel(4)], alpha: 1 };
  }
  const rgba = RGBA.exec(text);
  if (rgba) {
    const [r, g, b] = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
    if (r <= 255 && g <= 255 && b <= 255) {
      return { rgb: [r / 255, g / 255, b / 255], alpha: Number(rgba[4]) };
    }
  }
  throw new Error(`cor não suportada pelo guarda: "${value}"`);
}

const toLin = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

function luminance(rgb: Rgb) {
  return (
    0.2126 * toLin(rgb[0]) + 0.7152 * toLin(rgb[1]) + 0.0722 * toLin(rgb[2])
  );
}

/** Razão de contraste WCAG entre duas cores opacas. */
function contrast(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

/** A cor translúcida `top` composta sobre a base opaca (o que o olho vê). */
function over(top: Color, base: Rgb): Rgb {
  const mix = (t: number, b: number) => t * top.alpha + b * (1 - top.alpha);
  return [
    mix(top.rgb[0], base[0]),
    mix(top.rgb[1], base[1]),
    mix(top.rgb[2], base[2]),
  ];
}

/** O RGB de uma cor opaca; translúcida lança (é preciso compor com `over`). */
function solid(color: Color, name: string): Rgb {
  if (color.alpha !== 1) {
    throw new Error(`--${name} é translúcido: componha com over()`);
  }
  return color.rgb;
}

// ---------------------------------------------------------------- leitura do CSS
function blockOf(source: string, opener: string): string {
  const start = source.indexOf(`${opener} {`);
  if (start < 0) throw new Error(`seletor ${opener} não encontrado`);
  return source.slice(start, source.indexOf("\n}", start));
}

/** Lê `--name` do corpo de um seletor de topo. Falha alto se faltar. */
function readToken(source: string, selector: string, name: string): Color {
  // `\s` antes do `--` impede casar `--color-seg` ao procurar `--seg`.
  const hit = new RegExp(`\\s--${name}:\\s*([^;]+);`).exec(
    blockOf(source, selector),
  );
  if (!hit?.[1]) throw new Error(`--${name} ausente em ${selector}`);
  return parseColor(hit[1]);
}

// CRLF (checkout no Windows) vira LF: o corte por "\n}" depende disso.
const css = readFileSync(
  join(import.meta.dirname, "globals.css"),
  "utf8",
).replaceAll("\r\n", "\n");
const useMobileSource = readFileSync(
  join(import.meta.dirname, "..", "hooks", "use-mobile.ts"),
  "utf8",
).replaceAll("\r\n", "\n");

const THEMES = [
  ["claro", ":root"],
  ["escuro", ".dark"],
] as const;

/** Cores fixas: só em `:root`. */
const fixed = (name: string) => readToken(css, ":root", name);

// ---------------------------------------------------------------- tokens do contrato
const SECTOR_TOKENS = [
  "sector-lilac",
  "sector-peach",
  "sector-sky",
  "sector-green",
  "sector-pink",
];
/** Fundos pastel sobre os quais a tinta `on-pastel` escreve. */
const PASTEL_BASES = [...SECTOR_TOKENS, "highlight", "invite"];

const FIXED_TOKENS = [
  "on-pastel",
  "on-pastel-ink",
  "on-pastel-muted",
  "on-pastel-soft",
  "on-pastel-secondary",
  "on-pastel-secondary-hover",
  "on-pastel-track",
  "on-pastel-line",
  "highlight",
  "on-highlight-muted",
  "on-highlight-soft",
  "invite",
  "on-invite-muted",
  "on-invite-soft",
  ...SECTOR_TOKENS,
  "pastel-pending",
  "pastel-pending-foreground",
  "pastel-confirmed",
  "pastel-confirmed-foreground",
];
/** Novos tokens que mudam com o tema (existem em `:root` e em `.dark`). */
const THEMED_TOKENS = ["seg", "thumb", "thumb-foreground", "frame"];

// ---------------------------------------------------------------- testes da matemática
describe("parseColor", () => {
  it("lê hex de 6 dígitos", () => {
    expect(parseColor("#ff0000")).toEqual({ rgb: [1, 0, 0], alpha: 1 });
    expect(parseColor(" #000000 ")).toEqual({ rgb: [0, 0, 0], alpha: 1 });
  });

  it("lê rgba com alfa em 0,08, .1, 0 e 1", () => {
    expect(parseColor("rgba(255, 255, 255, 0.08)")).toEqual({
      rgb: [1, 1, 1],
      alpha: 0.08,
    });
    expect(parseColor("rgba(28,27,25,.1)").alpha).toBe(0.1);
    expect(parseColor("rgba(0, 0, 0, 0)").alpha).toBe(0);
    expect(parseColor("rgba(0, 0, 0, 1)").alpha).toBe(1);
  });

  it.each([
    "red",
    "#fff",
    "#ff000080",
    "rgb(1, 2, 3)",
    "rgba(1, 2, 3)",
    "rgba(300, 0, 0, 0.5)",
    "oklch(0.5 0 0)",
    "",
  ])("lança para a forma não suportada %j", (value) => {
    expect(() => parseColor(value)).toThrow("cor não suportada");
  });
});

describe("contrast, over e solid", () => {
  it("preto sobre branco é 21:1 e a ordem dos argumentos não importa", () => {
    const black: Rgb = [0, 0, 0];
    const white: Rgb = [1, 1, 1];
    expect(contrast(black, white)).toBeCloseTo(21, 5);
    expect(contrast(white, black)).toBeCloseTo(21, 5);
    expect(contrast(white, white)).toBeCloseTo(1, 5);
  });

  it("over compõe: 50% de preto sobre branco é cinza médio; alfa 1 e 0 são os extremos", () => {
    const white: Rgb = [1, 1, 1];
    expect(over(parseColor("rgba(0, 0, 0, 0.5)"), white)).toEqual([
      0.5, 0.5, 0.5,
    ]);
    expect(over(parseColor("rgba(0, 0, 0, 1)"), white)).toEqual([0, 0, 0]);
    expect(over(parseColor("rgba(0, 0, 0, 0)"), white)).toEqual(white);
  });

  it("solid recusa cor translúcida (medir sem compor mentiria)", () => {
    expect(() => solid(parseColor("rgba(0, 0, 0, 0.5)"), "x")).toThrow(
      "--x é translúcido",
    );
    expect(solid(parseColor("#ffffff"), "x")).toEqual([1, 1, 1]);
  });
});

describe("leitura do CSS", () => {
  const sample =
    ":root {\n  --color-seg: #000000;\n  --seg: #ffffff;\n}\n.dark {\n  --seg: #101010;\n}\n";

  it("não confunde --seg com --color-seg", () => {
    expect(readToken(sample, ":root", "seg").rgb).toEqual([1, 1, 1]);
  });

  it("falha alto quando o token ou o seletor não existem", () => {
    expect(() => readToken(sample, ":root", "thumb")).toThrow(
      "--thumb ausente em :root",
    );
    expect(() => readToken(sample, ".escuro", "seg")).toThrow(
      "seletor .escuro não encontrado",
    );
  });
});

// ---------------------------------------------------------------- estrutura da folha
describe("estrutura do globals.css", () => {
  it.each(THEMED_TOKENS)("--%s existe em :root e em .dark", (name) => {
    for (const [, selector] of THEMES) {
      expect(() => readToken(css, selector, name)).not.toThrow();
    }
  });

  it.each(
    FIXED_TOKENS,
  )("--%s existe em :root e o .dark não a redefine", (name) => {
    expect(() => fixed(name)).not.toThrow();
    expect(blockOf(css, ".dark")).not.toMatch(new RegExp(`\\s--${name}:`));
  });

  it.each([
    ...THEMED_TOKENS,
    ...FIXED_TOKENS,
  ])("a ponte --color-%s existe no @theme inline", (name) => {
    // Sem a ponte, `bg-<nome>` não gera CSS e o fundo sai transparente, em silêncio.
    expect(blockOf(css, "@theme inline")).toMatch(
      new RegExp(`--color-${name}:\\s*var\\(\\s*--${name}\\s*\\)\\s*;`),
    );
  });

  it("o @theme tem as sombras e o véu do visual novo (valores literais, nunca em .tsx)", () => {
    const theme = blockOf(css, "@theme");
    expect(theme).toMatch(/--shadow-thumb:\s*0 2px 8px/);
    expect(theme).toMatch(/--shadow-drawer:\s*20px 0 60px/);
    expect(theme).toMatch(/--color-scrim:\s*rgba\(0, 0, 0, 0?\.45\)\s*;/);
  });
});

describe("celular é abaixo de 860px (C-V3)", () => {
  it("o --breakpoint-md do Tailwind é 53,75rem (860px)", () => {
    expect(blockOf(css, "@theme")).toMatch(/--breakpoint-md:\s*53\.75rem\s*;/);
  });

  it("o MOBILE_BREAKPOINT da sidebar é o mesmo número, em px", () => {
    const rem = Number(
      /--breakpoint-md:\s*([\d.]+)rem/.exec(blockOf(css, "@theme"))?.[1],
    );
    const hook = Number(
      /const MOBILE_BREAKPOINT = (\d+);/.exec(useMobileSource)?.[1],
    );
    expect(hook).toBe(860);
    expect(rem * 16).toBe(hook);
  });
});

// ---------------------------------------------------------------- a tabela do §4.1
/** `[token que recebe o valor, token de origem]` (spec §4.1). */
const ALIASES: [string, string][] = [
  ["sidebar", "background"],
  ["popover", "card"],
  ["secondary", "card"],
  ["muted", "card"],
  ["sidebar-accent", "accent"],
  ["card-foreground", "foreground"],
  ["popover-foreground", "foreground"],
  ["secondary-foreground", "foreground"],
  ["accent-foreground", "foreground"],
  ["sidebar-foreground", "foreground"],
  ["sidebar-accent-foreground", "foreground"],
  ["sidebar-primary", "primary"],
  ["sidebar-primary-foreground", "primary-foreground"],
  ["sidebar-border", "border"],
  ["ring", "muted-foreground"],
  ["sidebar-ring", "muted-foreground"],
];

/** Os valores do §4.1, tema a tema. */
const SPEC: Record<string, Record<string, string>> = {
  ":root": {
    background: "#f4f1ea",
    card: "#ffffff",
    accent: "#ebe7de",
    foreground: "#1c1b19",
    "muted-foreground": "#67635b",
    border: "rgba(28, 27, 25, 0.09)",
    input: "rgba(28, 27, 25, 0.15)",
    primary: "#1c1b19",
    "primary-foreground": "#f4f1ea",
    seg: "#e4e0d6",
    thumb: "#ffffff",
    "thumb-foreground": "#1c1b19",
    frame: "#1c1b19",
  },
  ".dark": {
    background: "#1c1b19",
    card: "#282724",
    accent: "#34332f",
    foreground: "#f2efe8",
    "muted-foreground": "#a9a49a",
    border: "rgba(255, 255, 255, 0.08)",
    input: "rgba(255, 255, 255, 0.15)",
    primary: "#f2efe8",
    "primary-foreground": "#1c1b19",
    seg: "#282724",
    thumb: "#f2efe8",
    "thumb-foreground": "#1c1b19",
    frame: "#0f0e0d",
  },
};

/** As cores fixas do §4.1 (iguais nos dois temas). */
const SPEC_FIXED: Record<string, string> = {
  "on-pastel": "#1c1b19",
  "on-pastel-ink": "#f2efe8",
  "on-pastel-muted": "#33302a",
  "on-pastel-soft": "rgba(28, 27, 25, 0.08)",
  "on-pastel-secondary": "rgba(28, 27, 25, 0.1)",
  "on-pastel-secondary-hover": "rgba(28, 27, 25, 0.16)",
  "on-pastel-track": "rgba(28, 27, 25, 0.14)",
  "on-pastel-line": "rgba(28, 27, 25, 0.12)",
  highlight: "#ffd23f",
  "on-highlight-muted": "#3b3628",
  "on-highlight-soft": "#4a4332",
  invite: "#f2a7c6",
  "on-invite-muted": "#3a2730",
  "on-invite-soft": "#4a2c3a",
  "sector-lilac": "#b3a6e6",
  "sector-peach": "#f6b48f",
  "sector-sky": "#8ecae6",
  "sector-green": "#a7d49b",
  "sector-pink": "#f2a7c6",
  "pastel-pending": "#cbe4f6",
  "pastel-pending-foreground": "#1d4a72",
  "pastel-confirmed": "#d3eedd",
  "pastel-confirmed-foreground": "#1f5131",
};

for (const [theme, selector] of THEMES) {
  describe(`tabela do §4.1 — tema ${theme}`, () => {
    it.each(
      Object.entries(SPEC[selector] ?? {}),
    )("--%s tem o valor do handoff (%s)", (name, expected) => {
      expect(readToken(css, selector, name)).toEqual(parseColor(expected));
    });

    it.each(ALIASES)("--%s tem o mesmo valor de --%s", (alias, source) => {
      expect(readToken(css, selector, alias)).toEqual(
        readToken(css, selector, source),
      );
    });

    it("warning, info e success ficam como estavam (os do handoff são os de hoje)", () => {
      const expected: Record<string, string> =
        selector === ":root"
          ? {
              success: "#d3eedd",
              "success-foreground": "#1f5131",
              warning: "#f5e0bc",
              "warning-foreground": "#6a451b",
              info: "#cbe4f6",
              "info-foreground": "#1d4a72",
            }
          : {
              success: "#1d3526",
              "success-foreground": "#75d799",
              warning: "#372d1b",
              "warning-foreground": "#e4bb67",
              info: "#1b2a37",
              "info-foreground": "#74b1e7",
            };
      for (const [name, value] of Object.entries(expected)) {
        expect(readToken(css, selector, name)).toEqual(parseColor(value));
      }
    });
  });
}

describe("tabela do §4.1 — cores fixas", () => {
  it.each(
    Object.entries(SPEC_FIXED),
  )("--%s tem o valor do handoff (%s)", (name, expected) => {
    expect(fixed(name)).toEqual(parseColor(expected));
  });
});

// ---------------------------------------------------------------- contraste: superfícies e status
/** `[texto, fundo]` das superfícies do app, em cada tema. */
const SURFACE_PAIRS: [string, string][] = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "accent"],
  ["muted-foreground", "seg"],
  ["foreground", "seg"],
  ["primary-foreground", "primary"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["thumb-foreground", "thumb"],
  ["success-foreground", "success"],
  ["warning-foreground", "warning"],
  ["info-foreground", "info"],
];

for (const [theme, selector] of THEMES) {
  describe(`contraste das superfícies e do status — tema ${theme}`, () => {
    const measure = (fg: string, bg: string) =>
      contrast(
        solid(readToken(css, selector, fg), fg),
        solid(readToken(css, selector, bg), bg),
      );

    if (process.env.VITEST_PRINT_THEME_CONTRAST) {
      it("imprime a matriz medida", () => {
        const lines = SURFACE_PAIRS.map(
          ([fg, bg]) => `${fg} sobre ${bg}: ${measure(fg, bg).toFixed(2)}:1`,
        );
        console.log(`\n[superfícies · ${theme}]\n${lines.join("\n")}`);
        expect(lines).toHaveLength(SURFACE_PAIRS.length);
      });
    }

    it.each(SURFACE_PAIRS)("%s sobre %s (≥4,5:1)", (fg, bg) => {
      const ratio = measure(fg, bg);
      expect(
        ratio,
        `${fg} sobre ${bg}: ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(TEXT_MIN);
    });
  });
}

// ---------------------------------------------------------------- contraste: cards pastel (iguais nos dois temas)
/** `[texto, fundo]` sobre fundo opaco. */
const PASTEL_PAIRS: [string, string][] = [
  ...PASTEL_BASES.map((bg): [string, string] => ["on-pastel", bg]),
  ...SECTOR_TOKENS.map((bg): [string, string] => ["on-pastel-muted", bg]),
  ["on-highlight-muted", "highlight"],
  ["on-highlight-soft", "highlight"],
  ["on-invite-muted", "invite"],
  ["on-invite-soft", "invite"],
  ["on-pastel-ink", "on-pastel"],
  ["pastel-pending-foreground", "pastel-pending"],
  ["pastel-confirmed-foreground", "pastel-confirmed"],
];

const OVERLAYS = [
  "on-pastel-soft",
  "on-pastel-secondary",
  "on-pastel-secondary-hover",
];

/** `[texto, bloco translúcido, fundo pastel]`: o bloco é composto sobre o fundo antes de medir. */
const OVERLAY_CASES: [string, string, string][] = [
  ...PASTEL_BASES.flatMap((base) =>
    OVERLAYS.map((overlay): [string, string, string] => [
      "on-pastel",
      overlay,
      base,
    ]),
  ),
  ...SECTOR_TOKENS.map((base): [string, string, string] => [
    "on-pastel-muted",
    "on-pastel-soft",
    base,
  ]),
  ["on-highlight-muted", "on-pastel-soft", "highlight"],
  ["on-highlight-soft", "on-pastel-soft", "highlight"],
  ["on-invite-muted", "on-pastel-soft", "invite"],
  ["on-invite-soft", "on-pastel-soft", "invite"],
];

describe("contraste dos cards pastel (cores fixas, iguais nos dois temas)", () => {
  if (process.env.VITEST_PRINT_THEME_CONTRAST) {
    it("imprime a matriz medida", () => {
      const direct = PASTEL_PAIRS.map(
        ([fg, bg]) =>
          `${fg} sobre ${bg}: ${contrast(solid(fixed(fg), fg), solid(fixed(bg), bg)).toFixed(2)}:1`,
      );
      const blended = OVERLAY_CASES.map(
        ([fg, overlay, base]) =>
          `${fg} sobre ${overlay} em ${base}: ${contrast(solid(fixed(fg), fg), over(fixed(overlay), solid(fixed(base), base))).toFixed(2)}:1`,
      );
      console.log(`\n[pastéis]\n${[...direct, ...blended].join("\n")}`);
      expect(direct.length + blended.length).toBeGreaterThan(0);
    });
  }

  it.each(PASTEL_PAIRS)("%s sobre %s (≥4,5:1)", (fg, bg) => {
    const ratio = contrast(solid(fixed(fg), fg), solid(fixed(bg), bg));
    expect(
      ratio,
      `${fg} sobre ${bg}: ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it.each(
    OVERLAY_CASES,
  )("%s sobre o bloco %s em cima de %s (≥4,5:1)", (fg, overlay, base) => {
    const ratio = contrast(
      solid(fixed(fg), fg),
      over(fixed(overlay), solid(fixed(base), base)),
    );
    expect(
      ratio,
      `${fg} sobre ${overlay} em ${base}: ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(TEXT_MIN);
  });
});

// ---------------------------------------------------------------- o validador reprova o que deve
/** O CASO NEGATIVO: sem ele, os testes acima poderiam virar constante e seguir verdes. */
describe("o validador reprova o que deve reprovar", () => {
  it("cinza claro sobre branco reprova", () => {
    expect(contrast([0.8, 0.8, 0.8], [1, 1, 1])).toBeLessThan(TEXT_MIN);
  });

  it("branco sobre o amarelo do cartão pendente reprova: por isso a tinta é on-pastel", () => {
    expect(
      contrast([1, 1, 1], solid(fixed("highlight"), "highlight")),
    ).toBeLessThan(TEXT_MIN);
  });

  it("a tinta clara dos botões sobre o card pastel reprova (ela só vale sobre on-pastel)", () => {
    for (const base of PASTEL_BASES) {
      expect(
        contrast(
          solid(fixed("on-pastel-ink"), "on-pastel-ink"),
          solid(fixed(base), base),
        ),
        base,
      ).toBeLessThan(TEXT_MIN);
    }
  });

  it("o bloco translúcido muda o fundo medido (compor não é no-op)", () => {
    const base = solid(fixed("sector-lilac"), "sector-lilac");
    expect(over(fixed("on-pastel-soft"), base)).not.toEqual(base);
  });
});
