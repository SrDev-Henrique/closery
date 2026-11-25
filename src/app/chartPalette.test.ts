/**
 * Guarda EXECUTÁVEL da paleta (pendências P4 e P9): lê `src/app/globals.css` e mede, nos dois
 * temas, (1) a série `--chart-1..4` e (2) os pares `success`/`warning`/`info` com o `-foreground`.
 *
 * Portado do `chartPaletteGuard.test.ts` do klauve. Os pisos são os de lá, medidos agora contra
 * as superfícies do shadcn neutral (P9). Ficou de fora o que é do klauve (severidade, status de
 * ocorrências, anel do chip, mídia) e a leitura de componentes de gráfico.
 *
 * Rodar: `bun run test -- src/app/chartPalette.test.ts`
 * (`VITEST_PRINT_PALETTE=1` imprime a matriz medida, para colar em `.context/ui-tokens.md`).
 *
 * Os tokens podem estar em hex (`#8d3e0f`) ou em `oklch(L C H)` (os neutros do shadcn). O CSS é
 * lido por regex, não por parser: se a folha ganhar nesting que quebre o corte, o teste falha
 * alto (fail-closed), que é o comportamento desejado.
 *
 * Piso nunca se afrouxa para a paleta passar: reprovou, ajuste o token.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Nº de cores da série. `chart-5` é o neutro de "Outros" (o `foreground`, P13) e NÃO é série. */
const SERIES = 4;
/** Pisos: banda de lightness OKLCH, croma mínimo, contraste WCAG (não-texto) e ΔE2000. */
const L_BAND = [0.43, 0.77] as const;
const C_MIN = 0.06;
const CONTRAST_MIN = 3;
const DELTA_E_MIN = 15;
/** Texto normal (WCAG AA): vale para os pares `-foreground` de status. */
const TEXT_MIN = 4.5;

// ---------------------------------------------------------------- cor
/** sRGB codificado (gama aplicada), cada canal em 0..1. */
type Rgb = [number, number, number];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const toLin = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const toSrgb = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
const toLinRgb = (rgb: Rgb): Rgb => [
  toLin(rgb[0]),
  toLin(rgb[1]),
  toLin(rgb[2]),
];

const HEX = /^#([0-9a-fA-F]{6})$/;
const OKLCH =
  /^oklch\(\s*(-?[\d.]+)(%?)\s+(-?[\d.]+)\s+(-?[\d.]+)(?:deg)?\s*\)$/;

/** oklch → sRGB pela matriz de Ottosson; o que cai fora do gamut é recortado (clamp). */
function oklchToRgb(L: number, C: number, hueDegrees: number): Rgb {
  const h = (hueDegrees * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [toSrgb(clamp01(r)), toSrgb(clamp01(g)), toSrgb(clamp01(bl))];
}

/** Aceita `#rrggbb` e `oklch(L C H)`. Qualquer outra forma (inclusive com alfa) lança. */
function parseColor(value: string): Rgb {
  const text = value.trim();
  const hex = HEX.exec(text);
  if (hex?.[1]) {
    const digits = hex[1];
    const channel = (i: number) =>
      Number.parseInt(digits.slice(i, i + 2), 16) / 255;
    return [channel(0), channel(2), channel(4)];
  }
  const oklch = OKLCH.exec(text);
  if (oklch) {
    const lightness = Number(oklch[1]) / (oklch[2] === "%" ? 100 : 1);
    return oklchToRgb(lightness, Number(oklch[3]), Number(oklch[4]));
  }
  throw new Error(`cor não suportada pelo guarda: "${value}"`);
}

function relLuminance(rgb: Rgb) {
  const [r, g, b] = toLinRgb(rgb);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG entre duas cores. */
function contrast(a: Rgb, b: Rgb) {
  const [hi, lo] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

/** OKLab (Ottosson): daqui saem a lightness e o croma. */
function oklchOf(rgb: Rgb) {
  const [r, g, b] = toLinRgb(rgb);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B) };
}

/** Simulação de dicromacia: Viénot, Brettel & Mollon (1999), em RGB linear. */
const CVD = {
  normal: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  deuteranopia: [
    [0.29275, 0.70725, 0],
    [0.29275, 0.70725, 0],
    [-0.02234, 0.02234, 1],
  ],
  protanopia: [
    [0.11238, 0.88762, 0],
    [0.11238, 0.88762, 0],
    [0.00401, -0.00401, 1],
  ],
  tritanopia: [
    [1, 0.14461, -0.14461],
    [0, 0.85659, 0.14341],
    [0, 0.85659, 0.14341],
  ],
} as const;
type Vision = keyof typeof CVD;
const VISIONS = Object.keys(CVD) as Vision[];

function simulate(rgb: Rgb, vision: Vision): Rgb {
  const lin = toLinRgb(rgb);
  const [r, g, b] = CVD[vision].map((row) =>
    toSrgb(clamp01(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2])),
  );
  return [r ?? 0, g ?? 0, b ?? 0];
}

/** CIELab (D65). */
function lab(rgb: Rgb): [number, number, number] {
  const [r, g, b] = toLinRgb(rgb);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) =>
    t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE2000(p: [number, number, number], q: [number, number, number]) {
  const rad = Math.PI / 180;
  const [L1, a1, b1] = p;
  const [L2, a2, b2] = q;
  const Cbar = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1;
  const ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1);
  const Cp2 = Math.hypot(ap2, b2);
  const ang = (y: number, x: number) => {
    if (y === 0 && x === 0) return 0;
    const d = Math.atan2(y, x) / rad;
    return d >= 0 ? d : d + 360;
  };
  const hp1 = ang(b1, ap1);
  const hp2 = ang(b2, ap2);
  const dLp = L2 - L1;
  const dCp = Cp2 - Cp1;
  let dhp = 0;
  if (Cp1 * Cp2 !== 0) {
    dhp = hp2 - hp1;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dhp * rad) / 2);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (Cp1 + Cp2) / 2;
  let hbp = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(hp1 - hp2) > 180) hbp += hp1 + hp2 < 360 ? 360 : -360;
    hbp /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * rad) +
    0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) -
    0.2 * Math.cos((4 * hbp - 63) * rad);
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt =
    -Math.sin(2 * (30 * Math.exp(-(((hbp - 275) / 25) ** 2))) * rad) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 +
      (dCp / Sc) ** 2 +
      (dHp / Sh) ** 2 +
      Rt * (dCp / Sc) * (dHp / Sh),
  );
}

const pairDeltaE = (a: Rgb, b: Rgb, vision: Vision) =>
  deltaE2000(lab(simulate(a, vision)), lab(simulate(b, vision)));

// ---------------------------------------------------------------- leitura do CSS
/** Lê `--name` do corpo de um seletor de topo (`:root` / `.dark`). Falha alto se faltar. */
function readToken(css: string, selector: string, name: string): Rgb {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`seletor ${selector} não encontrado`);
  const body = css.slice(start, css.indexOf("\n}", start));
  // `\s` antes do `--` impede casar `--color-chart-1` ao procurar `--chart-1`.
  const hit = new RegExp(`\\s--${name}:\\s*([^;]+);`).exec(body);
  if (!hit?.[1]) throw new Error(`--${name} ausente em ${selector}`);
  return parseColor(hit[1]);
}

const cssPath = join(import.meta.dirname, "globals.css");
// CRLF (checkout no Windows) vira LF: o corte por "\n}" depende disso.
const css = readFileSync(cssPath, "utf8").replaceAll("\r\n", "\n");

const THEMES = [
  ["claro", ":root"],
  ["escuro", ".dark"],
] as const;

const PAIRS: [number, number][] = [];
for (let i = 0; i < SERIES; i++)
  for (let j = i + 1; j < SERIES; j++) PAIRS.push([i, j]);

// ---------------------------------------------------------------- testes da matemática
describe("parseColor", () => {
  it("lê hex de 6 dígitos", () => {
    expect(parseColor("#ff0000")).toEqual([1, 0, 0]);
    expect(parseColor(" #000000 ")).toEqual([0, 0, 0]);
  });

  it("oklch(1 0 0) é branco e oklch(0 0 0) é preto", () => {
    for (const c of parseColor("oklch(1 0 0)")) expect(c).toBeCloseTo(1, 3);
    for (const c of parseColor("oklch(0 0 0)")) expect(c).toBeCloseTo(0, 3);
  });

  it("oklch neutro do shadcn dá o cinza esperado (0.205 ≈ #171717)", () => {
    for (const c of parseColor("oklch(0.205 0 0)"))
      expect(Math.round(c * 255)).toBe(0x17);
  });

  it("oklch cromático bate com a referência (vermelho do shadcn ≈ rgb(231, 0, 11))", () => {
    const [r, g, b] = parseColor("oklch(0.577 0.245 27.325)").map((c) =>
      Math.round(c * 255),
    );
    expect(Math.abs((r ?? 0) - 231)).toBeLessThanOrEqual(2);
    expect(g).toBe(0);
    expect(Math.abs((b ?? 0) - 11)).toBeLessThanOrEqual(3);
  });

  it("recorta (clamp) o que cai fora do gamut sRGB", () => {
    for (const c of parseColor("oklch(0.7 0.4 150)")) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });

  it("aceita lightness em porcentagem", () => {
    expect(parseColor("oklch(50% 0 0)")).toEqual(parseColor("oklch(0.5 0 0)"));
  });

  it.each([
    "red",
    "#fff",
    "rgb(1, 2, 3)",
    "oklch(1 0 0 / 10%)",
    "",
  ])("lança para a forma não suportada %j", (value) => {
    expect(() => parseColor(value)).toThrow("cor não suportada");
  });
});

describe("readToken", () => {
  const sample =
    ":root {\n  --color-chart-1: #000000;\n  --chart-1: #ffffff;\n}\n";

  it("não confunde --chart-1 com --color-chart-1", () => {
    expect(readToken(sample, ":root", "chart-1")).toEqual([1, 1, 1]);
  });

  it("falha alto quando o token ou o seletor não existem", () => {
    expect(() => readToken(sample, ":root", "chart-9")).toThrow(
      "--chart-9 ausente",
    );
    expect(() => readToken(sample, ".dark", "chart-1")).toThrow(
      "seletor .dark não encontrado",
    );
  });
});

// ---------------------------------------------------------------- série chart-1..4
for (const [theme, selector] of THEMES) {
  describe(`série de gráfico (chart-1..${SERIES}) — tema ${theme}`, () => {
    const card = readToken(css, selector, "card");
    const series = Array.from({ length: SERIES }, (_, i) =>
      readToken(css, selector, `chart-${i + 1}`),
    );

    if (process.env.VITEST_PRINT_PALETTE) {
      it("imprime a matriz medida", () => {
        const lines = series.map((rgb, i) => {
          const { L, C } = oklchOf(rgb);
          return `chart-${i + 1}  L ${L.toFixed(3)}  C ${C.toFixed(3)}  contraste/card ${contrast(rgb, card).toFixed(2)}:1`;
        });
        for (const vision of VISIONS) {
          const des = PAIRS.map(([i, j]) =>
            pairDeltaE(series[i] ?? card, series[j] ?? card, vision),
          );
          lines.push(`${vision}: ΔE2000 mínimo ${Math.min(...des).toFixed(1)}`);
        }
        console.log(`\n[${theme}]\n${lines.join("\n")}`);
        expect(series).toHaveLength(SERIES);
      });
    }

    it.each(
      Array.from({ length: SERIES }, (_, i) => i + 1),
    )("chart-%i fica na banda de lightness e tem croma suficiente", (n) => {
      const { L, C } = oklchOf(series[n - 1] ?? card);
      expect(L, `chart-${n} L`).toBeGreaterThanOrEqual(L_BAND[0]);
      expect(L, `chart-${n} L`).toBeLessThanOrEqual(L_BAND[1]);
      expect(C, `chart-${n} croma`).toBeGreaterThanOrEqual(C_MIN);
    });

    it.each(
      Array.from({ length: SERIES }, (_, i) => i + 1),
    )("chart-%i tem contraste ≥3:1 sobre o card do tema", (n) => {
      const ratio = contrast(series[n - 1] ?? card, card);
      expect(
        ratio,
        `chart-${n} sobre card: ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(CONTRAST_MIN);
    });

    it.each(VISIONS)("separa todos os pares em %s (ΔE2000 ≥ 15)", (vision) => {
      for (const [i, j] of PAIRS) {
        const de = pairDeltaE(series[i] ?? card, series[j] ?? card, vision);
        expect(
          de,
          `chart-${i + 1} × chart-${j + 1} em ${vision}: ΔE ${de.toFixed(1)}`,
        ).toBeGreaterThanOrEqual(DELTA_E_MIN);
      }
    });
  });
}

// ---------------------------------------------------------------- neutro de "Outros" (P13)
/**
 * O neutro de "Outros" (e do 5º turno em diante nos gráficos) é o `foreground` do tema:
 * `muted-foreground` passa o contraste, mas reprova a separação em tritanopia contra `chart-4`
 * (ver o caso negativo abaixo). `--chart-5` tem o mesmo valor, para o token deixar de ser a
 * armadilha de um cinza que some no tema escuro.
 */
for (const [theme, selector] of THEMES) {
  describe(`neutro de Outros (P13) — tema ${theme}`, () => {
    const card = readToken(css, selector, "card");
    const foreground = readToken(css, selector, "foreground");
    const others = readToken(css, selector, "chart-5");
    const series = Array.from({ length: SERIES }, (_, i) =>
      readToken(css, selector, `chart-${i + 1}`),
    );

    it("chart-5 tem o mesmo valor de foreground", () => {
      expect(others).toEqual(foreground);
    });

    it("tem contraste ≥3:1 sobre o card do tema", () => {
      const ratio = contrast(others, card);
      expect(
        ratio,
        `chart-5 sobre card: ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(CONTRAST_MIN);
    });

    it.each(VISIONS)("separa de chart-1..4 em %s (ΔE2000 ≥ 15)", (vision) => {
      series.forEach((rgb, i) => {
        const de = pairDeltaE(others, rgb, vision);
        expect(
          de,
          `chart-5 × chart-${i + 1} em ${vision}: ΔE ${de.toFixed(1)}`,
        ).toBeGreaterThanOrEqual(DELTA_E_MIN);
      });
    });
  });
}

// ---------------------------------------------------------------- pares de status
const STATUS_TOKENS = ["success", "warning", "info"] as const;

for (const [theme, selector] of THEMES) {
  describe(`pares de status — tema ${theme}`, () => {
    if (process.env.VITEST_PRINT_PALETTE) {
      it("imprime a matriz de status medida", () => {
        const lines = STATUS_TOKENS.map((name) => {
          const ratio = contrast(
            readToken(css, selector, `${name}-foreground`),
            readToken(css, selector, name),
          );
          return `${name}-foreground sobre ${name}: ${ratio.toFixed(2)}:1`;
        });
        console.log(`\n[status · ${theme}]\n${lines.join("\n")}`);
        expect(lines).toHaveLength(STATUS_TOKENS.length);
      });
    }

    it.each(
      STATUS_TOKENS,
    )("%s-foreground lê sobre o fundo do par (≥4,5:1)", (name) => {
      const ratio = contrast(
        readToken(css, selector, `${name}-foreground`),
        readToken(css, selector, name),
      );
      expect(ratio, `${name}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        TEXT_MIN,
      );
    });
  });
}

describe("os tokens de status têm a ponte no @theme inline", () => {
  it.each([
    "success",
    "success-foreground",
    "warning",
    "warning-foreground",
    "info",
    "info-foreground",
  ])("a ponte --color-%s existe", (name) => {
    // Sem a ponte, `bg-success` não gera CSS e o fundo sai transparente, em silêncio.
    const start = css.indexOf("@theme inline {");
    if (start < 0) throw new Error("@theme inline não encontrado");
    const theme = css.slice(start, css.indexOf("\n}", start));
    expect(theme).toMatch(
      new RegExp(`--color-${name}:\\s*var\\(\\s*--${name}\\s*\\)\\s*;`),
    );
  });
});

// ---------------------------------------------------------------- o validador reprova o que deve
/**
 * O CASO NEGATIVO. Sem ele, todo o bloco de daltonismo acima poderia virar uma constante e os
 * testes seguiriam verdes: o guarda, que existe para reprovar paleta ruim, autorizaria qualquer
 * uma. O par é o vermelho e o verde clássicos do matplotlib, indistinguíveis em deuteranopia.
 */
describe("o validador reprova o que deve reprovar", () => {
  const VERMELHO = parseColor("#d62728");
  const VERDE = parseColor("#2ca02c");

  it("separa o par em visão normal", () => {
    expect(pairDeltaE(VERMELHO, VERDE, "normal")).toBeGreaterThan(60);
  });

  it("e o REPROVA em deuteranopia: a simulação está viva", () => {
    expect(pairDeltaE(VERMELHO, VERDE, "deuteranopia")).toBeLessThan(
      DELTA_E_MIN,
    );
  });

  it("reprova contraste insuficiente sobre o card", () => {
    expect(contrast(parseColor("#e8e8e8"), parseColor("#fdfcf9"))).toBeLessThan(
      CONTRAST_MIN,
    );
  });

  it("reprova texto de status sem contraste (cinza claro sobre branco)", () => {
    expect(contrast(parseColor("#cccccc"), parseColor("#ffffff"))).toBeLessThan(
      TEXT_MIN,
    );
  });

  it("a série antiga (cinzas do shadcn) reprova o piso de croma: P4 detectado", () => {
    // Era o valor de chart-1..4 antes da D16: cinza puro, croma 0.
    for (const old of [
      "oklch(0.87 0 0)",
      "oklch(0.556 0 0)",
      "oklch(0.439 0 0)",
      "oklch(0.371 0 0)",
    ]) {
      expect(oklchOf(parseColor(old)).C).toBeLessThan(C_MIN);
    }
  });

  it("o chart-5 antigo (oklch(0.269 0 0)) reprova o contraste no tema escuro: P13 detectado", () => {
    const card = readToken(css, ".dark", "card");
    expect(contrast(parseColor("oklch(0.269 0 0)"), card)).toBeLessThan(
      CONTRAST_MIN,
    );
  });

  it("muted-foreground reprova a separação de chart-4 em tritanopia, nos dois temas: por isso Outros é foreground", () => {
    for (const [, selector] of THEMES) {
      const muted = readToken(css, selector, "muted-foreground");
      const chart4 = readToken(css, selector, "chart-4");
      expect(pairDeltaE(muted, chart4, "tritanopia")).toBeLessThan(DELTA_E_MIN);
    }
  });
});
