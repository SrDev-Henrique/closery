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
import { Inbox } from "lucide-react";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PasskeyOffer } from "@/components/auth/PasskeyOffer";
import { BarList } from "@/components/dashboard/BarList";
import { StatLink } from "@/components/dashboard/StatLink";
import { STATUS_TONE } from "@/components/passagens/MyShiftCard";
import { badgeVariants } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { DialogFooter } from "@/components/ui/dialog";
import { FieldLabel } from "@/components/ui/field";
import { TableRow } from "@/components/ui/table";

// O PasskeyOffer é renderizado só para ler as classes (P109): sem cliente de
// autenticação nem roteador de verdade, que nada aqui clica.
vi.mock("@/lib/auth/client", () => ({ authClient: {} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {} }) }));

/** Texto normal (WCAG AA). */
const TEXT_MIN = 4.5;
/** Componente de interface e objeto gráfico (WCAG 1.4.11). */
const NON_TEXT_MIN = 3;
/**
 * Piso de perceptibilidade de um fundo de estado: a razão entre o fundo com o estado (hover) e o de
 * repouso, ou entre duas superfícies que precisam se separar (o trilho do `BarList` e a linha). Não
 * é número da WCAG (a 1.4.11 pede 3:1 para o que identifica o controle; aqui o rótulo já identifica
 * e o fundo é só retorno): é a escolha de desenho do P109. Fica acima dos pares que a revisão final
 * do PR B viu e mal se distinguem (1,04:1, o "Agora não" no escuro; 1,08:1, os `/50` no escuro
 * dentro de cartão) e abaixo do menor que se vê sem esforço (1,18:1, o `accent` opaco sobre o card
 * escuro, o que a `AdminOverview` escolheu).
 */
const STATE_MIN = 1.1;

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

// ---------------------------------------------------------------- leitura das classes (P109)
/** Uma tag de abertura do HTML estático, com os atributos já sem o escape do React. */
type Tag = { tag: string; attrs: Record<string, string> };

/**
 * As tags de abertura do HTML que o `renderToStaticMarkup` gera, na ordem do documento. O React
 * escapa `&`, `<`, `>` e as aspas dentro dos atributos, então o corte por `>` e por `"` é seguro.
 */
function tagsIn(html: string): Tag[] {
  const decode = (text: string) =>
    text
      .replaceAll("&quot;", '"')
      .replaceAll("&#x27;", "'")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&");
  return [...html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/g)].map((hit) => ({
    tag: hit[1] ?? "",
    attrs: Object.fromEntries(
      [...(hit[2] ?? "").matchAll(/\s([^\s="]+)="([^"]*)"/g)].map((attr) => [
        attr[1] ?? "",
        decode(attr[2] ?? ""),
      ]),
    ),
  }));
}

/** As classes de cada tag que passa em `match`; lança se não forem exatamente `count` (fail-closed). */
function classesWhere(
  html: string,
  match: (tag: Tag) => boolean,
  count: number,
): string[][] {
  const hits = tagsIn(html)
    .filter(match)
    .map((tag) => (tag.attrs.class ?? "").split(/\s+/).filter(Boolean));
  if (hits.length !== count) {
    throw new Error(`esperava ${count} elemento(s), achei ${hits.length}`);
  }
  return hits;
}

/** Um fundo lido de uma classe `bg-<token>` ou `bg-<token>/N` (N%, como o Tailwind gera). */
type Fill = { token: string; alpha: number };

/** Os tokens de cor do tema (`--<nome>` em `:root`): `bg-clip-padding` não é fundo de cor. */
const isColorToken = (name: string) =>
  new RegExp(`\\s--${name}:`).test(blockOf(css, ":root"));

/** O utilitário de cor lido: `bg` (fundo) ou `text` (tinta). */
type ColorUtility = "bg" | "text";

/**
 * O `bg-<token>[/N]` (ou `text-…`, com `utility`) com exatamente este prefixo de variante (`""`,
 * `hover:`, `dark:hover:`, `group-hover/<nome>:`). `null` se não houver; lança com dois, ou com um
 * fundo arbitrário (`bg-[…]`), que o guarda não sabe medir. `text-sm` e `bg-clip-padding` não são
 * cor (não há token com esse nome) e ficam de fora.
 */
function fillWith(
  classes: readonly string[],
  prefix: string,
  utility: ColorUtility = "bg",
): Fill | null {
  const start = `${prefix}${utility}-`;
  const hits = classes.flatMap((name): Fill[] => {
    if (!name.startsWith(start)) return [];
    const rest = name.slice(start.length);
    if (rest.startsWith("[")) {
      if (utility === "text") return [];
      throw new Error(`fundo arbitrário que o guarda não mede: "${name}"`);
    }
    const hit = /^([a-z][a-z0-9-]*)(?:\/(\d+))?$/.exec(rest);
    if (!hit?.[1] || !isColorToken(hit[1])) return [];
    return [{ token: hit[1], alpha: hit[2] ? Number(hit[2]) / 100 : 1 }];
  });
  if (hits.length > 1) {
    throw new Error(
      `mais de uma cor ${start}* nas classes: ${classes.join(" ")}`,
    );
  }
  return hits[0] ?? null;
}

/**
 * A cor que vale no tema e no estado (`""` é o repouso). No escuro, `dark:<estado>` vence
 * `<estado>` (o `dark` é `&:is(.dark *)`, mais específico); sem classe do estado vale a de repouso.
 */
function fillIn(
  classes: readonly string[],
  selector: string,
  state: string,
  utility: ColorUtility = "bg",
): Fill | null {
  const dark = (prefix: string) =>
    selector === ".dark" ? fillWith(classes, `dark:${prefix}`, utility) : null;
  const resting = dark("") ?? fillWith(classes, "", utility);
  if (state === "") return resting;
  return dark(state) ?? fillWith(classes, state, utility) ?? resting;
}

/** O que o olho vê: o fundo da classe (alfa da classe vezes o do token) sobre a base opaca. */
function paint(fill: Fill | null, selector: string, base: Rgb): Rgb {
  if (!fill) return base;
  const color = readToken(css, selector, fill.token);
  return over({ rgb: color.rgb, alpha: color.alpha * fill.alpha }, base);
}

/** O nome do único `group/<nome>` das classes (o `group-hover/<nome>:` dos filhos depende dele). */
function groupName(classes: readonly string[]): string {
  const names = classes.flatMap(
    (name) => /^group\/([a-z][a-z0-9-]*)$/.exec(name)?.[1] ?? [],
  );
  if (names.length !== 1 || !names[0]) {
    throw new Error(`esperava um group/<nome>, achei ${names.length}`);
  }
  return names[0];
}

// ---------------------------------------------------------------- classes lidas dos componentes (P109)
/**
 * As classes que os guardas dos fundos de estado medem, lidas do que cada componente renderiza
 * (`renderToStaticMarkup`) ou da variante (`buttonVariants`, `badgeVariants`). Nenhum alfa nem token
 * de fundo é escrito à mão: mudar a classe no componente muda o que o guarda mede.
 */
const classesOfVariant = (classes: string) => classes.split(/\s+/);
/** As classes do único elemento com este `data-slot` no HTML do elemento renderizado. */
const slotClasses = (element: ReactElement, slot: string): string[] =>
  classesWhere(
    renderToStaticMarkup(element),
    (tag) => tag.attrs["data-slot"] === slot,
    1,
  )[0] ?? [];

const OUTLINE = classesOfVariant(buttonVariants({ variant: "outline" }));
const GHOST = classesOfVariant(buttonVariants({ variant: "ghost" }));
const BADGE_GHOST = classesOfVariant(badgeVariants({ variant: "ghost" }));
const CARD_FOOTER = slotClasses(createElement(CardFooter), "card-footer");
const DIALOG_FOOTER = slotClasses(createElement(DialogFooter), "dialog-footer");
const TABLE_ROW = slotClasses(
  createElement(
    "table",
    null,
    createElement("tbody", null, createElement(TableRow)),
  ),
  "table-row",
);
const FIELD_LABEL = slotClasses(createElement(FieldLabel), "field-label");
/** O hover do rótulo que envolve um campo (o estado só vale com um `Field` dentro e habilitado). */
const FIELD_LABEL_HOVER =
  "has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:";

const barListHtml = renderToStaticMarkup(
  createElement(BarList, {
    label: "Barras",
    rows: [
      {
        key: "a",
        label: "Destino Teste",
        value: 3,
        valueText: "3",
        detail: "3 entregues",
        href: "/a",
      },
    ],
    bars: true,
    emptyText: "",
    moreText: null,
  }),
);
const [barRow = []] = classesWhere(barListHtml, (tag) => tag.tag === "a", 1);
const [barTrack = []] = classesWhere(
  barListHtml,
  (tag) => tag.tag === "span" && tag.attrs["aria-hidden"] === "true",
  1,
);
const [barFill = []] = classesWhere(
  barListHtml,
  (tag) => tag.tag === "span" && "style" in tag.attrs,
  1,
);
/** O estado do trilho que acompanha o hover da linha (o grupo é o da linha). */
const BAR_ROW_HOVER = `group-hover/${groupName(barRow)}:`;

const [statLink = []] = classesWhere(
  renderToStaticMarkup(
    createElement(StatLink, {
      label: "Abertas agora",
      value: 3,
      href: "/a",
      icon: Inbox,
    }),
  ),
  (tag) => tag.tag === "a",
  1,
);

/**
 * O cartão da `AdminOverview` é um Server Component assíncrono (sessão e banco), que o guarda não
 * renderiza: o `className` do `<Card>` sai do código-fonte (o único com `group-hover:`), e o `Card`
 * é renderizado com ele, para o `cn` juntar as classes como na tela. O `group` é o do `<Link>`.
 */
const adminCardClassName = (() => {
  const source = readFileSync(
    join(
      import.meta.dirname,
      "..",
      "components",
      "app-shell",
      "AdminOverview.tsx",
    ),
    "utf8",
  );
  const hits = [...source.matchAll(/<Card className="([^"]*)"/g)].flatMap(
    (hit) => (hit[1]?.includes("group-hover:") ? [hit[1]] : []),
  );
  if (hits.length !== 1 || !hits[0]) {
    throw new Error(
      `esperava um <Card className="…group-hover:…"> na AdminOverview, achei ${hits.length}`,
    );
  }
  return hits[0];
})();
const ADMIN_CARD = slotClasses(
  createElement(Card, { className: adminCardClassName }),
  "card",
);

/** "Agora não" do `PasskeyOffer`: o cartão, o rodapé e o link, do HTML do componente. */
const passkeyHtml = renderToStaticMarkup(createElement(PasskeyOffer));
const [passkeyCard = []] = classesWhere(
  passkeyHtml,
  (tag) => tag.attrs["data-slot"] === "card",
  1,
);
const [passkeyFooter = []] = classesWhere(
  passkeyHtml,
  (tag) => tag.attrs["data-slot"] === "card-footer",
  1,
);
const [passkeySkip = []] = classesWhere(
  passkeyHtml,
  (tag) => tag.tag === "a" && tag.attrs.href === "/",
  1,
);

/**
 * Onde a peça fica: o nome que vai no título e o fundo opaco embaixo dela. Os rodapés são o fundo
 * do `CardFooter` (sobre o card) e do `DialogFooter` (sobre o popover), com o token e o alfa lidos
 * da classe de cada um.
 */
const UNDER = {
  "--background": (selector: string) =>
    solid(readToken(css, selector, "background"), "background"),
  "--card": (selector: string) =>
    solid(readToken(css, selector, "card"), "card"),
  "--popover": (selector: string) =>
    solid(readToken(css, selector, "popover"), "popover"),
  "rodapé do CardFooter": (selector: string) =>
    paint(
      fillIn(CARD_FOOTER, selector, ""),
      selector,
      solid(readToken(css, selector, "card"), "card"),
    ),
  "rodapé do DialogFooter": (selector: string) =>
    paint(
      fillIn(DIALOG_FOOTER, selector, ""),
      selector,
      solid(readToken(css, selector, "popover"), "popover"),
    ),
} satisfies Record<string, (selector: string) => Rgb>;

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
  "on-pastel-success",
  "on-pastel-success-soft",
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
    destructive: "#b80000",
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
    destructive: "#ff9393",
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
  // Bloco "Confirmada" do cartão de turno (spec §6.4.1). A tinta do handoff
  // (#14402a) dava 4,41:1 no lilás; o token é ela escurecida até passar.
  "on-pastel-success": "#123b27",
  "on-pastel-success-soft": "rgba(46, 125, 79, 0.22)",
};

/** Valores do contrato que não são os do handoff: o título do teste diz qual é e por quê. */
const NOT_FROM_HANDOFF: Record<string, (value: string) => string> = {
  destructive: (value) =>
    `valor ajustado para AA (${value}; decisão do dono, 2026-11-27)`,
  "on-pastel-success": (value) =>
    `valor corrigido (${value}; o do handoff, #14402a, dá 4,41:1 no lilás)`,
};

/** `[título, token, valor]` para o `it.each` da tabela do §4.1. */
function specCases(spec: Record<string, string>): [string, string, string][] {
  return Object.entries(spec).map(([name, value]) => [
    `--${name} tem o ${NOT_FROM_HANDOFF[name]?.(value) ?? `valor do handoff (${value})`}`,
    name,
    value,
  ]);
}

for (const [theme, selector] of THEMES) {
  describe(`tabela do §4.1 — tema ${theme}`, () => {
    it.each(specCases(SPEC[selector] ?? {}))("%s", (_title, name, expected) => {
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
  it.each(specCases(SPEC_FIXED))("%s", (_title, name, expected) => {
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
  // Texto sobre o fundo de estado opaco (hover e aberto do Button outline e
  // ghost, linha selecionada, BarList, StatLink, cartão da Administração; P83).
  ["foreground", "accent"],
  ["muted-foreground", "seg"],
  ["foreground", "seg"],
  ["primary-foreground", "primary"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["thumb-foreground", "thumb"],
  ["success-foreground", "success"],
  ["warning-foreground", "warning"],
  ["info-foreground", "info"],
  // Texto de erro (text-destructive) sobre as superfícies que o recebem.
  ["destructive", "background"],
  ["destructive", "card"],
  ["destructive", "popover"],
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

// ---------------------------------------------------------------- contraste: amostra da cor marcada
/**
 * `SectorColorChoice`: a opção marcada é uma pílula `bg-primary`; a amostra da cor (16px) leva
 * `group-data-checked/color:border-primary-foreground`. A borda tem de separar a amostra do fundo
 * marcado (≥3:1, objeto gráfico): no escuro a pílula é creme e as amostras pastel ficam entre 1,46 e
 * 1,92:1 sobre ela. O teste do componente afirma a classe; aqui mede o par no CSS.
 */
for (const [theme, selector] of THEMES) {
  describe(`borda da amostra marcada do SectorColorChoice — tema ${theme}`, () => {
    it("primary-foreground sobre primary (≥3:1)", () => {
      const ratio = contrast(
        solid(
          readToken(css, selector, "primary-foreground"),
          "primary-foreground",
        ),
        solid(readToken(css, selector, "primary"), "primary"),
      );
      expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        NON_TEXT_MIN,
      );
    });

    it("a borda antiga (foreground/20 sobre primary) reprovaria: por isso a troca", () => {
      const primary = solid(readToken(css, selector, "primary"), "primary");
      const old = over(
        {
          rgb: solid(readToken(css, selector, "foreground"), "foreground"),
          alpha: 0.2,
        },
        primary,
      );
      expect(contrast(old, primary)).toBeLessThan(NON_TEXT_MIN);
    });
  });
}

// ---------------------------------------------------------------- contraste: botão destructive
/**
 * O fundo do botão `destructive` é o próprio `--destructive` translúcido (`bg-destructive/N`, que o
 * Tailwind gera como `color-mix(in oklab, var(--destructive) N%, transparent)`: a mesma cor com alfa
 * N%). Os percentuais vêm da classe da própria variante (`buttonVariants`), em repouso e no hover,
 * nos dois temas: mudar o botão sem passar aqui não é possível. O botão aparece sobre o fundo da
 * página (`/solicitacoes/[id]`, "Cancelar solicitação" direto no `SidebarInset`) e sobre o card ou o
 * diálogo (`popover` tem o valor do card) e, no `DialogFooter` e no `CardFooter`, sobre o fundo do
 * rodapé composto no popover e no card (o alfa do rodapé sai da classe dele).
 */
function destructiveButtonAlphas() {
  const names = buttonVariants({ variant: "destructive" }).split(/\s+/);
  const pick = (prefix: string) => {
    const pattern = new RegExp(`^${prefix}bg-destructive/(\\d+)$`);
    const hits = names.flatMap((name) => pattern.exec(name)?.[1] ?? []);
    if (hits.length !== 1) {
      throw new Error(
        `esperava uma classe ${prefix}bg-destructive/N no botão, achei ${hits.length}`,
      );
    }
    return Number(hits[0]) / 100;
  };
  return {
    ":root": { repouso: pick(""), hover: pick("hover:") },
    ".dark": { repouso: pick("dark:"), hover: pick("dark:hover:") },
  } as const;
}

/** Onde o botão fica (o fundo de cada um está em `UNDER`; os rodapés com o alfa da classe, P109). */
const DESTRUCTIVE_BUTTON_SURFACES = [
  "--background",
  "--card",
  "rodapé do CardFooter",
  "rodapé do DialogFooter",
] as const satisfies readonly (keyof typeof UNDER)[];
type ButtonState = "repouso" | "hover";

describe("botão destructive — os percentuais lidos da variante", () => {
  it("acha repouso e hover nos dois temas, e o hover muda o fundo (alfa maior)", () => {
    const alphas = destructiveButtonAlphas();
    for (const selector of [":root", ".dark"] as const) {
      const { repouso, hover } = alphas[selector];
      expect(repouso, selector).toBeGreaterThan(0);
      expect(hover, selector).toBeGreaterThan(repouso);
      expect(hover, selector).toBeLessThan(1);
    }
  });
});

for (const [theme, selector] of THEMES) {
  describe(`contraste do botão destructive — tema ${theme}`, () => {
    const cases = (["repouso", "hover"] as const).flatMap((state) =>
      DESTRUCTIVE_BUTTON_SURFACES.map(
        (surface): [ButtonState, keyof typeof UNDER] => [state, surface],
      ),
    );
    const measure = (state: ButtonState, surface: keyof typeof UNDER) => {
      const destructive = readToken(css, selector, "destructive");
      const alpha = destructiveButtonAlphas()[selector][state];
      const fill = over(
        { rgb: destructive.rgb, alpha },
        UNDER[surface](selector),
      );
      return contrast(solid(destructive, "destructive"), fill);
    };

    if (process.env.VITEST_PRINT_THEME_CONTRAST) {
      it("imprime a matriz medida", () => {
        const lines = cases.map(
          ([state, surface]) =>
            `botão destructive (${state}) sobre ${surface}: ${measure(state, surface).toFixed(2)}:1`,
        );
        console.log(`\n[botão destructive · ${theme}]\n${lines.join("\n")}`);
        expect(lines).toHaveLength(cases.length);
      });
    }

    it.each(
      cases,
    )("text-destructive sobre o fundo do botão (%s) composto em cima de %s (≥4,5:1)", (state, surface) => {
      const ratio = measure(state, surface);
      expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(TEXT_MIN);
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
  // Bloco "Confirmada" do cartão de turno (§6.4.1), sobre a cor de cada setor.
  ...SECTOR_TOKENS.map((base): [string, string, string] => [
    "on-pastel-success",
    "on-pastel-success-soft",
    base,
  ]),
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

  it("a tinta verde do handoff (#14402a) no bloco 'Confirmada' em cima do lilás reprova: por isso o token é mais escuro", () => {
    const ratio = contrast(
      parseColor("#14402a").rgb,
      over(
        fixed("on-pastel-success-soft"),
        solid(fixed("sector-lilac"), "sector-lilac"),
      ),
    );
    expect(ratio, `${ratio.toFixed(2)}:1`).toBeLessThan(TEXT_MIN);
  });
});

// ---------------------------------------------------------------- contraste: bloco "Aguardando recebimento"
/**
 * O bloco "Aguardando recebimento" do cartão de turno (spec §6.4.1) é `bg-on-pastel/N`: o token
 * `on-pastel` com N% de opacidade, sem token próprio. O N vem da classe do próprio componente
 * (`STATUS_TONE` do `MyShiftCard`), uma fonte só. O guarda compõe essa mistura sobre a cor de cada
 * setor e mede a tinta `on-pastel`. O "Confirmada" está em OVERLAY_CASES, com os tokens dele; um
 * teste abaixo confere que o componente usa esses tokens.
 */
function pendingBlockAlpha(): number {
  const names = STATUS_TONE.pending.className.split(/\s+/);
  const hits = names.flatMap(
    (name) => /^bg-on-pastel\/(\d+)$/.exec(name)?.[1] ?? [],
  );
  if (hits.length !== 1 || !names.includes("text-on-pastel")) {
    throw new Error(
      `o bloco pendente deveria ser bg-on-pastel/N com text-on-pastel: "${STATUS_TONE.pending.className}"`,
    );
  }
  return Number(hits[0]) / 100;
}

const PENDING_BLOCK_ALPHA = pendingBlockAlpha();
const PENDING_BLOCK = `on-pastel/${Math.round(PENDING_BLOCK_ALPHA * 100)}`;

describe("blocos de status do cartão de turno: o guarda mede o que o componente desenha", () => {
  it("o pendente é bg-on-pastel/N + text-on-pastel, com N entre 1 e 99", () => {
    expect(PENDING_BLOCK_ALPHA).toBeGreaterThan(0);
    expect(PENDING_BLOCK_ALPHA).toBeLessThan(1);
  });

  it("o 'Confirmada' usa os tokens on-pastel-success-soft e on-pastel-success (os de OVERLAY_CASES)", () => {
    expect(STATUS_TONE.confirmed.className.split(/\s+/).sort()).toEqual([
      "bg-on-pastel-success-soft",
      "text-on-pastel-success",
    ]);
  });
});

function pendingBlockRatio(base: string): number {
  const ink = solid(fixed("on-pastel"), "on-pastel");
  const block = over(
    { rgb: ink, alpha: PENDING_BLOCK_ALPHA },
    solid(fixed(base), base),
  );
  return contrast(ink, block);
}

describe(`contraste do bloco 'Aguardando recebimento' (${PENDING_BLOCK} sobre a cor do setor)`, () => {
  if (process.env.VITEST_PRINT_THEME_CONTRAST) {
    it("imprime a matriz medida", () => {
      const lines = SECTOR_TOKENS.map(
        (base) =>
          `on-pastel sobre ${PENDING_BLOCK} em ${base}: ${pendingBlockRatio(base).toFixed(2)}:1`,
      );
      console.log(`\n[bloco Aguardando recebimento]\n${lines.join("\n")}`);
      expect(lines).toHaveLength(SECTOR_TOKENS.length);
    });
  }

  it.each(
    SECTOR_TOKENS,
  )(`on-pastel sobre ${PENDING_BLOCK} em cima de %s (≥4,5:1)`, (base) => {
    const ratio = pendingBlockRatio(base);
    expect(
      ratio,
      `on-pastel sobre ${PENDING_BLOCK} em ${base}: ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(TEXT_MIN);
  });
});

// ---------------------------------------------------------------- fundos de estado (P83, PR B §9)
/**
 * Os estados e rodapés que eram `bg-muted` viraram `bg-accent` (PB-D8): `--muted` tem o valor do
 * `--card`, e dentro de cartão, diálogo ou Sheet o fundo antigo não mudava nada. Cada caso lê as
 * classes do componente (bloco "classes lidas dos componentes", no topo; nenhum alfa à mão) e é
 * medido nos dois temas: (1) o texto (`foreground` e `muted-foreground`) sobre o fundo com o estado
 * passa 4,5:1; (2) o estado muda a cor de repouso (outra cor de 8 bits); (3) a razão entre os dois
 * passa o `STATE_MIN`, salvo onde o caso está em `belowFloor` (P109: hoje abaixo do piso, e a
 * troca é escolha de desenho em aberto). O guarda confere os dois lados: o caso listado continua
 * abaixo (a lista não envelhece quando alguém corrige) e o não listado passa (um caso novo abaixo
 * do piso falha). Os casos negativos mostram por que o `bg-muted` sumia e por que o cartão da
 * Administração usa `accent` opaco.
 */
const STATE_TEXT = ["foreground", "muted-foreground"] as const;
const BOTH_THEMES = [":root", ".dark"] as const;

/** A cor como os 3 bytes que a tela pinta: iguais aqui = a mesma cor na tela. */
function bytes(rgb: Rgb): string {
  return rgb.map((channel) => Math.round(channel * 255)).join(",");
}

/**
 * Um fundo de estado lido das classes do elemento. `state` é o prefixo do estado (`hover:`,
 * `aria-expanded:`…); `null` quer dizer a própria superfície (o rodapé) contra o que fica embaixo.
 * `belowFloor`: os temas em que o caso fica abaixo do `STATE_MIN` hoje (P109).
 */
type StateCase = {
  name: string;
  classes: readonly string[];
  state: string | null;
  under: keyof typeof UNDER;
  belowFloor?: readonly string[];
};

const STATE_CASES: StateCase[] = [
  {
    name: "Button outline no hover, dentro de cartão",
    classes: OUTLINE,
    state: "hover:",
    under: "--card",
    belowFloor: [":root"],
  },
  {
    name: "Button outline aberto (aria-expanded), dentro de cartão",
    classes: OUTLINE,
    state: "aria-expanded:",
    under: "--card",
    belowFloor: BOTH_THEMES,
  },
  {
    name: "Button outline no hover, sobre o rodapé do DialogFooter (o Cancelar dos diálogos)",
    classes: OUTLINE,
    state: "hover:",
    under: "rodapé do DialogFooter",
    belowFloor: [":root"],
  },
  {
    name: "Button ghost no hover, dentro de cartão",
    classes: GHOST,
    state: "hover:",
    under: "--card",
    belowFloor: [".dark"],
  },
  {
    name: "Button ghost no hover, sobre a página",
    classes: GHOST,
    state: "hover:",
    under: "--background",
    belowFloor: [":root"],
  },
  {
    name: "Button ghost no hover, sobre o rodapé do CardFooter (o PasskeyOffer tem hover local)",
    classes: GHOST,
    state: "hover:",
    under: "rodapé do CardFooter",
    belowFloor: [".dark"],
  },
  {
    name: "Badge ghost no hover, dentro de cartão",
    classes: BADGE_GHOST,
    state: "hover:",
    under: "--card",
    belowFloor: [".dark"],
  },
  {
    name: "Badge ghost no hover, sobre a página",
    classes: BADGE_GHOST,
    state: "hover:",
    under: "--background",
    belowFloor: [":root"],
  },
  {
    name: "rodapé do CardFooter, dentro do cartão",
    classes: CARD_FOOTER,
    state: null,
    under: "--card",
    belowFloor: [".dark"],
  },
  {
    name: "rodapé do DialogFooter, dentro do diálogo",
    classes: DIALOG_FOOTER,
    state: null,
    under: "--popover",
    belowFloor: [".dark"],
  },
  {
    name: "linha da tabela no hover, dentro de cartão",
    classes: TABLE_ROW,
    state: "hover:",
    under: "--card",
    belowFloor: [".dark"],
  },
  {
    name: "linha da tabela no hover, sobre a página",
    classes: TABLE_ROW,
    state: "hover:",
    under: "--background",
    belowFloor: [":root"],
  },
  {
    name: "rótulo com campo no hover, dentro de cartão",
    classes: FIELD_LABEL,
    state: FIELD_LABEL_HOVER,
    under: "--card",
    belowFloor: [".dark"],
  },
  {
    name: "rótulo com campo no hover, sobre a página",
    classes: FIELD_LABEL,
    state: FIELD_LABEL_HOVER,
    under: "--background",
    belowFloor: [":root"],
  },
  {
    name: "linha do BarList no hover, sobre a página",
    classes: barRow,
    state: "hover:",
    under: "--background",
  },
  {
    name: "StatLink no hover, sobre a página",
    classes: statLink,
    state: "hover:",
    under: "--background",
  },
  {
    name: "cartão da Administração no hover (group-hover), sobre a página",
    classes: ADMIN_CARD,
    state: "group-hover:",
    under: "--background",
  },
];

/** O fundo sem e com o estado, compostos sobre o que fica embaixo. */
function stateColors(item: StateCase, selector: string): [Rgb, Rgb] {
  const under = UNDER[item.under](selector);
  const resting =
    item.state === null
      ? under
      : paint(fillIn(item.classes, selector, ""), selector, under);
  const active = paint(
    fillIn(item.classes, selector, item.state ?? ""),
    selector,
    under,
  );
  return [resting, active];
}

/**
 * A tinta medida sobre o fundo com o estado: a que a classe do estado fixa (`hover:text-foreground`
 * no `outline` e no `ghost`, `hover:text-muted-foreground` no `Badge` `ghost`), que é a do rótulo
 * da peça; sem ela, as duas que o conteúdo usa (`foreground` e `muted-foreground`).
 */
function stateTexts(item: StateCase, selector: string): string[] {
  if (item.state !== null) {
    const ink =
      (selector === ".dark"
        ? fillWith(item.classes, `dark:${item.state}`, "text")
        : null) ?? fillWith(item.classes, item.state, "text");
    if (ink && ink.alpha !== 1) {
      throw new Error(
        `tinta translúcida que o guarda não compõe: ${ink.token}`,
      );
    }
    if (ink) return [ink.token];
  }
  return [...STATE_TEXT];
}

describe("fundos de estado: as classes lidas têm o estado que o caso mede", () => {
  it.each(
    STATE_CASES.map((item): [string, StateCase] => [item.name, item]),
  )("%s", (_name, item) => {
    const prefix = item.state ?? "";
    const own = fillWith(item.classes, prefix);
    const dark = fillWith(item.classes, `dark:${prefix}`);
    expect(own ?? dark, item.classes.join(" ")).not.toBeNull();
  });
});

for (const [theme, selector] of THEMES) {
  describe(`fundos de estado (accent) — tema ${theme}`, () => {
    const token = (name: string) => solid(readToken(css, selector, name), name);
    const cases = STATE_CASES.map((item): [string, StateCase] => [
      item.name,
      item,
    ]);

    if (process.env.VITEST_PRINT_THEME_CONTRAST) {
      it("imprime a matriz medida", () => {
        const lines = STATE_CASES.map((item) => {
          const [resting, active] = stateColors(item, selector);
          const below = item.belowFloor?.includes(selector) ? " (P109)" : "";
          return `${item.name}: ${contrast(active, resting).toFixed(2)}:1${below}`;
        });
        console.log(`\n[fundos de estado · ${theme}]\n${lines.join("\n")}`);
        expect(lines).toHaveLength(STATE_CASES.length);
      });
    }

    it.each(
      cases.flatMap(([name, item]) =>
        stateTexts(item, selector).map((fg): [string, string, StateCase] => [
          fg,
          name,
          item,
        ]),
      ),
    )("%s sobre %s (≥4,5:1)", (fg, _name, item) => {
      const ratio = contrast(token(fg), stateColors(item, selector)[1]);
      expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(TEXT_MIN);
    });

    it.each(cases)("%s: o estado muda a cor de repouso", (_name, item) => {
      const [resting, active] = stateColors(item, selector);
      expect(bytes(active)).not.toBe(bytes(resting));
    });

    it.each(
      cases,
    )(`%s: passa o piso de ${STATE_MIN}:1, ou está em belowFloor e continua abaixo (P109)`, (_name, item) => {
      const [resting, active] = stateColors(item, selector);
      const ratio = contrast(active, resting);
      if (item.belowFloor?.includes(selector)) {
        expect(ratio, `${ratio.toFixed(2)}:1`).toBeLessThan(STATE_MIN);
      } else {
        expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
          STATE_MIN,
        );
      }
    });

    it("caso negativo: o bg-muted de antes, com o alfa do rodapé, pinta a mesma cor do cartão", () => {
      const footer = fillIn(CARD_FOOTER, selector, "");
      expect(footer?.alpha).toBeLessThan(1);
      const old = paint(
        { token: "muted", alpha: footer?.alpha ?? 1 },
        selector,
        token("card"),
      );
      expect(bytes(old)).toBe(bytes(token("card")));
    });
  });
}

describe("caso negativo: o cartão da Administração com o accent/50 dos rodapés sumiria no escuro (por isso accent opaco)", () => {
  it("o accent com o alfa do rodapé, sobre a página escura, é exatamente o --card", () => {
    const token = (name: string) => solid(readToken(css, ".dark", name), name);
    const footer = fillIn(CARD_FOOTER, ".dark", "");
    expect(footer?.token).toBe("accent");
    expect(fillIn(ADMIN_CARD, ".dark", "group-hover:")?.alpha).toBe(1);
    expect(bytes(paint(footer, ".dark", token("background")))).toBe(
      bytes(token("card")),
    );
  });
});

// ---------------------------------------------------------------- estado accent sobre fundo accent (P109)
/**
 * O `accent` que some onde o fundo já é `accent` (spec do PR B §14). Os tokens e os alfas saem das
 * classes que o componente renderiza (`renderToStaticMarkup`), nunca de número escrito aqui: mudar
 * a classe sem passar por este guarda não é possível. Cada par tem de passar o `STATE_MIN` nos dois
 * temas, e o caso negativo mostra o defeito que o guarda pega. As classes vêm do bloco "classes
 * lidas dos componentes", no topo.
 */
for (const [theme, selector] of THEMES) {
  describe(`trilho do BarList no hover da linha — tema ${theme}`, () => {
    // As linhas do BarList ficam direto na página (DashboardRequests, sem Card).
    const under = solid(readToken(css, selector, "background"), "background");
    const row = (state: string) =>
      paint(fillIn(barRow, selector, state), selector, under);
    const track = (classes: readonly string[], rowState: string) =>
      paint(
        fillIn(classes, selector, rowState === "" ? "" : BAR_ROW_HOVER),
        selector,
        row(rowState),
      );
    const measured = {
      linha: contrast(row("hover:"), row("")),
      "trilho em repouso": contrast(track(barTrack, ""), row("")),
      "trilho no hover": contrast(track(barTrack, "hover:"), row("hover:")),
    };

    if (process.env.VITEST_PRINT_THEME_CONTRAST) {
      it("imprime a matriz medida", () => {
        const lines = Object.entries(measured).map(
          ([name, ratio]) => `${name}: ${ratio.toFixed(2)}:1`,
        );
        console.log(`\n[trilho do BarList · ${theme}]\n${lines.join("\n")}`);
        expect(lines).toHaveLength(3);
      });
    }

    it.each(
      Object.entries(measured),
    )(`%s: separa-se do fundo (≥${STATE_MIN}:1)`, (_name, ratio) => {
      expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(STATE_MIN);
    });

    it.each([
      ["repouso", ""],
      ["hover", "hover:"],
    ])("a barra se separa do trilho no %s (≥3:1)", (_name, rowState) => {
      const trackColor = track(barTrack, rowState);
      const ratio = contrast(
        paint(fillIn(barFill, selector, ""), selector, trackColor),
        trackColor,
      );
      expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        NON_TEXT_MIN,
      );
    });

    it("caso negativo: o trilho sem a troca (só bg-accent) some no hover da linha (1:1)", () => {
      const before = barTrack.filter((name) => !name.startsWith(BAR_ROW_HOVER));
      expect(before).not.toEqual(barTrack);
      const ratio = contrast(track(before, "hover:"), row("hover:"));
      expect(ratio).toBeLessThan(STATE_MIN);
      expect(bytes(track(before, "hover:"))).toBe(bytes(row("hover:")));
    });
  });
}

/**
 * "Agora não" do `PasskeyOffer`: `ghost` dentro do `CardFooter` (`accent/50`), num `Card` sobre a
 * página (`/bem-vindo`). O rodapé, o cartão e o link saem do HTML do próprio componente, então o
 * alfa do rodapé e o do hover vêm das classes (com o `cn` já aplicado).
 */
for (const [theme, selector] of THEMES) {
  describe(`"Agora não" do PasskeyOffer sobre o rodapé — tema ${theme}`, () => {
    const page = solid(readToken(css, selector, "background"), "background");
    const card = paint(fillIn(passkeyCard, selector, ""), selector, page);
    const footer = paint(fillIn(passkeyFooter, selector, ""), selector, card);
    const skip = (classes: readonly string[], state: string) =>
      paint(fillIn(classes, selector, state), selector, footer);

    if (process.env.VITEST_PRINT_THEME_CONTRAST) {
      it("imprime a matriz medida", () => {
        const line = `hover sobre o rodapé: ${contrast(skip(passkeySkip, "hover:"), skip(passkeySkip, "")).toFixed(2)}:1`;
        console.log(`\n["Agora não" · ${theme}]\n${line}`);
        expect(line).toContain(":1");
      });
    }

    it("o rodapé é um fundo accent translúcido sobre o cartão, e o link não tem fundo em repouso", () => {
      expect(fillIn(passkeyFooter, selector, "")?.token).toBe("accent");
      expect(fillIn(passkeySkip, selector, "")).toBeNull();
    });

    it(`o hover muda o fundo do rodapé (≥${STATE_MIN}:1)`, () => {
      const ratio = contrast(skip(passkeySkip, "hover:"), footer);
      expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(STATE_MIN);
    });

    it("o texto (foreground) sobre o hover passa 4,5:1", () => {
      const ratio = contrast(
        solid(readToken(css, selector, "foreground"), "foreground"),
        skip(passkeySkip, "hover:"),
      );
      expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(TEXT_MIN);
    });
  });
}

describe('caso negativo: o "Agora não" sem o hover local sumiria no escuro', () => {
  const selector = ".dark";
  const page = solid(readToken(css, selector, "background"), "background");
  const card = paint(fillIn(passkeyCard, selector, ""), selector, page);
  const footer = paint(fillIn(passkeyFooter, selector, ""), selector, card);
  const hover = (classes: readonly string[]) =>
    contrast(
      paint(fillIn(classes, selector, "hover:"), selector, footer),
      footer,
    );

  it("o ghost puro (dark:hover:bg-accent/50) fica abaixo do piso sobre o rodapé", () => {
    expect(fillIn(GHOST, selector, "hover:")).toEqual({
      token: "accent",
      alpha: 0.5,
    });
    expect(hover(GHOST)).toBeLessThan(STATE_MIN);
  });

  it("o accent opaco também ficaria abaixo: por isso o input/50", () => {
    expect(
      hover(
        [...GHOST, "dark:hover:bg-accent"].filter(
          (name) => name !== "dark:hover:bg-accent/50",
        ),
      ),
    ).toBeLessThan(STATE_MIN);
  });
});

describe("leitura das classes do HTML estático (P109)", () => {
  it("tagsIn lê as tags de abertura e desfaz o escape do React nos atributos", () => {
    const html = renderToStaticMarkup(
      createElement(
        "div",
        { className: "a [&_svg:not([class*='size-'])]:size-4", title: 'x"<>&' },
        createElement("span", { "aria-hidden": "true" }),
      ),
    );
    expect(tagsIn(html)).toEqual([
      {
        tag: "div",
        attrs: {
          class: "a [&_svg:not([class*='size-'])]:size-4",
          title: 'x"<>&',
        },
      },
      { tag: "span", attrs: { "aria-hidden": "true" } },
    ]);
  });

  it("classesWhere falha alto quando não acha o número esperado de elementos", () => {
    const html = '<a class="x"></a><a class="y"></a>';
    expect(classesWhere(html, (tag) => tag.tag === "a", 2)).toEqual([
      ["x"],
      ["y"],
    ]);
    expect(() => classesWhere(html, (tag) => tag.tag === "a", 1)).toThrow(
      "esperava 1 elemento(s), achei 2",
    );
    expect(() => classesWhere(html, (tag) => tag.tag === "b", 1)).toThrow(
      "achei 0",
    );
  });

  it("fillWith lê token e alfa só com o prefixo exato e ignora o que não é cor", () => {
    const classes = [
      "bg-clip-padding",
      "bg-card",
      "hover:bg-accent",
      "dark:hover:bg-accent/50",
      "group-hover/x:bg-input/30",
    ];
    expect(fillWith(classes, "")).toEqual({ token: "card", alpha: 1 });
    expect(fillWith(classes, "hover:")).toEqual({ token: "accent", alpha: 1 });
    expect(fillWith(classes, "dark:hover:")).toEqual({
      token: "accent",
      alpha: 0.5,
    });
    expect(fillWith(classes, "group-hover/x:")).toEqual({
      token: "input",
      alpha: 0.3,
    });
    expect(fillWith(classes, "aria-expanded:")).toBeNull();
    expect(fillWith([], "")).toBeNull();
  });

  it("fillWith recusa dois fundos no mesmo prefixo e o valor arbitrário", () => {
    expect(() => fillWith(["bg-card", "bg-accent"], "")).toThrow(
      "mais de uma cor",
    );
    expect(() =>
      fillWith(["hover:bg-[color-mix(in_oklch,red,blue)]"], "hover:"),
    ).toThrow("fundo arbitrário");
  });

  it("fillWith com text: lê a tinta e ignora tamanho e valor arbitrário", () => {
    const classes = [
      "text-sm",
      "text-[0.8rem]",
      "hover:text-foreground",
      "text-card-foreground",
    ];
    expect(fillWith(classes, "", "text")).toEqual({
      token: "card-foreground",
      alpha: 1,
    });
    expect(fillWith(classes, "hover:", "text")).toEqual({
      token: "foreground",
      alpha: 1,
    });
    expect(fillIn(classes, ".dark", "hover:", "text")?.token).toBe(
      "foreground",
    );
    expect(fillWith(["text-sm"], "", "text")).toBeNull();
  });

  it("fillIn: no escuro o dark: vence; sem a classe do estado vale a de repouso", () => {
    const classes = ["bg-card", "hover:bg-accent", "dark:hover:bg-input/50"];
    expect(fillIn(classes, ":root", "hover:")).toEqual({
      token: "accent",
      alpha: 1,
    });
    expect(fillIn(classes, ".dark", "hover:")).toEqual({
      token: "input",
      alpha: 0.5,
    });
    expect(fillIn(classes, ".dark", "")).toEqual({ token: "card", alpha: 1 });
    expect(fillIn(classes, ":root", "group-hover/x:")).toEqual({
      token: "card",
      alpha: 1,
    });
    expect(fillIn([], ".dark", "hover:")).toBeNull();
  });

  it("paint compõe o alfa da classe vezes o do token; sem fundo devolve a base", () => {
    const base: Rgb = [0, 0, 0];
    expect(paint(null, ".dark", base)).toBe(base);
    // --input no escuro é branco a 15%; com /50, 7,5% de branco sobre o preto.
    const [r] = paint({ token: "input", alpha: 0.5 }, ".dark", base);
    expect(r).toBeCloseTo(0.075, 6);
  });

  it("groupName exige exatamente um group/<nome>", () => {
    expect(groupName(["group/bar-row", "flex"])).toBe("bar-row");
    expect(() => groupName(["group", "flex"])).toThrow("achei 0");
    expect(() => groupName(["group/a", "group/b"])).toThrow("achei 2");
  });
});
