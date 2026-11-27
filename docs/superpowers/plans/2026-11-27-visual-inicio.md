# Visual novo: Início e app shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** recriar no código, pixel a pixel, o visual novo da tela Início e do app shell do handoff do Claude Design, com tema escuro padrão, Satoshi, cor por setor e avatares, sem mudar regra de negócio.

**Architecture:** tokens novos no `globals.css` (mapeados nos nomes do shadcn mais tokens próprios das cores fixas), variantes novas em `Button`/`Badge`/`Card`, a sidebar do shadcn restilizada, e componentes novos só onde não existe peça (seletor deslizante, switch de tema, avatar, barra do turno, cartão de convite). Dados novos mínimos: a coluna `sector.color` (migração com backfill), o progresso do turno calculado no servidor, o primeiro acesso por contagens + cookie, e o avatar DiceBear gerado no servidor. A fidelidade é conferida contra o protótipo renderizado no Playwright.

**Tech Stack:** Next.js 16 (App Router, Cache Components), React 19, shadcn base-nova sobre Base UI, Tailwind CSS 4 (container queries nativas), `next-themes`, `next/font/local`, DiceBear (`@dicebear/core` 10.7.0 + `@dicebear/styles` 10.6.0), Drizzle + Postgres (Neon; PGlite nos testes), Vitest + Testing Library, Playwright, Bun.

**Spec:** `docs/superpowers/specs/2026-11-27-visual-inicio-design.md`. **Handoff (fora do git):** `.git/sdd/visual/handoff/` (README, protótipo `Inicio.dc.html`, screenshots).

## Global Constraints

- A spec manda; os valores exatos (cores, tamanhos, raios, espaçamentos, tipografia) são os da spec §4–§7 e do handoff.
- Só tokens: nenhum hex cru nem classe de cor crua do Tailwind em `.tsx` (`AGENTS.md`); a única exceção é `src/lib/avatar.ts` (fundos da arte do avatar). Tema claro **e** escuro em todo componente.
- Tema escuro é o padrão (`next-themes`, `defaultTheme="dark"`, `enableSystem={false}`).
- "Celular" é abaixo de **860px** no app inteiro (`--breakpoint-md: 53.75rem`, `MOBILE_BREAKPOINT = 860`).
- Botões e badges em pílula no app inteiro; tamanhos grandes, raio 32px e tipografia display só no Início e no shell.
- A Satoshi **nunca** entra no git: é baixada pelo `bun run fonts` (gancho `predev`/`prebuild`) para `src/fonts/satoshi/` (no `.gitignore`), com SHA-256 conferido, sem subset nem conversão (licença ITF FFL §01/§02).
- DiceBear com versões exatas: `@dicebear/core@10.7.0` e `@dicebear/styles@10.6.0`; avatar gerado no servidor, semente = id do usuário, nenhuma requisição a terceiros.
- Nada do handoff com cara de pessoa real entra no repositório (nome, e-mail, screenshot). Testes e seeds usam nomes fictícios ("Ana Teste", "Bruno Teste", "Carla Teste").
- Sem mudança de regra de negócio: as consultas do Início continuam as mesmas, só com campos a mais no `select` (ids para avatar, cor do setor).
- Copy: a do código atual, exceto a copy nova listada na spec §6 (data do eyebrow, "agora HH:MM", "Último passo", "Convide sua equipe" e o texto, "Gerar convites", "Agora não", "Cadastros", a linha extra do vazio de solicitações).
- Alvo de toque ≥ 44px; controle só com ícone tem `aria-label` **e** tooltip; ícones `aria-hidden`; `prefers-reduced-motion` desliga as animações.
- Mudança de schema só por migração versionada (`db:generate` → revisar/editar → `db:migrate`); as tarefas **não** rodam `db:migrate` no Neon (o controlador faz na Task 17, com o host conferido).
- Vitest: `bunx vitest run <arquivo>`, **nunca `bun test`**. Nunca a porta 3000. Nunca imprimir segredo nem o `.env.local`.
- Commits: mensagem escrita com a ferramenta Write em `.git/sdd/visual/msg-task-N.txt` e `git commit -F`; heredoc com acento quebra no Git Bash. Trailer do implementador: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Toda tarefa termina com `bun run check-types`, `bun run lint` e os testes dos arquivos tocados verdes; componente visual novo ou mudado atualiza `.context/ui-registry.md` no mesmo commit.
- Nenhuma cor literal (hex, `rgb()`, `rgba()`) em `.tsx`: tokens, ou token com modificador de opacidade (`border-on-pastel/40`). Sombras e véu são os tokens `shadow-thumb`, `shadow-drawer` e `bg-scrim` (Task 1).
- Quando a spec e o protótipo divergirem num valor fino (padding, raio interno de avatar, altura de badge), o protótipo manda.

## Decisões tomadas na montagem do plano

- **Tasks 5 e 6 andam juntas:** o mesmo implementador faz as duas em sequência e elas passam por uma revisão só, porque o schema da Task 5 exige a cor que só a tela da Task 6 manda.
- **O contêiner `@container/main` fica num invólucro sem padding** (Task 9). A área útil do protótipo é a tela menos a sidebar, incluindo o padding de 40px.
- **Os badges de status das solicitações** ("Solicitada" neutro, "Em separação / Trânsito" info, "Cancelada" `--accent`) mudam em todas as telas de Solicitações, não só no Início (D-V1).
- **"Cadastros" do convite:** o indicador fica preenchido só quando a contagem é maior que zero.
- **A linha extra do vazio de Solicitações** continua depois do "Agora não", como no protótipo.
- **O `SectorPicker`** tem trilho que cresce com o número de setores (`min(100%, max(480px, N·104px+8px))`) e thumb otimista (`useOptimistic`), que volta se a ação falhar.
- **"Ver o dashboard"** aparece também nos ramos de erro do `HomeHandovers`, porque o `e2e/auth.spec.ts` depende do link.
- **A pilha de fallback da Satoshi** é efetivamente `system-ui` (o `next/font` registra a Geist com nome gerado). O guarda de cor crua não proíbe `bg-black/10` e `bg-white` sem número, que vêm dos overlays do shadcn.
- **O botão de menu mantém o `aria-label` "Alternar menu"**, que testes e E2E já usam.
- **Desvios finos em que o protótipo ganhou da spec:**
  - padding de 20px nos botões `surface`, `default` e `on-pastel-secondary`;
  - padding e raios dos avatares por tamanho (34: 2,5/11/9 · 36: 2,5/12/10 · 44: 3/15/12 · 52: 3/17/14 · 84: 4/26/22);
  - o avatar do rascunho inclinado −3°;
  - os badges do cartão de turno com 28px de altura;
  - o badge "N paradas" com texto de 12,5px.

---

### Task 1: Tokens novos, breakpoint 860 e guardas (cor crua e contraste)

> **Notas do redator (conferidas no código em 2026-11-27):**
>
> > aqui foi aplicado ao repositório.
> >
> > Fatos medidos ao redigir (para o controlador conferir):
> > - Os SHA-256 do contrato batem com os 3 `woff2` baixados da Fontshare em 2026-11-27.
> > - O formato do CSS da Fontshare é o do enunciado (3 blocos `@font-face`, `src` com `woff2`, `woff` e
> >   `truetype`, URLs `//cdn.fontshare.com/wf/...`).
> > - **Nenhum** par texto/fundo do handoff reprova 4,5:1 (o menor é `muted-foreground` sobre `seg` no claro,
> >   4,54:1). Não há exceção conhecida.
> > - O guarda `rawColors` passa no código atual (168 `.tsx` varridos). A única ocorrência de hex é o par
> >   `[stroke='#ccc']`/`[stroke='#fff']` de `chart.tsx` (a exceção da spec).
>


**Files:**
- Create: `src/app/rawColors.test.ts`
- Create: `src/app/themeContrast.test.ts`
- Modify: `src/app/globals.css` (paleta nova nos dois temas, ponte no `@theme inline`, bloco `@theme` com o breakpoint 860, as sombras e o véu)
- Modify: `src/hooks/use-mobile.ts` (`MOBILE_BREAKPOINT = 860`)
- Modify: `src/app/chartPalette.test.ts` (só o caso negativo do `muted-foreground`, ver Step 5)
- Modify: `.context/ui-tokens.md` (reescrito para a paleta nova)
- Test: `src/app/themeContrast.test.ts`, `src/app/rawColors.test.ts`, `src/app/chartPalette.test.ts`

**Interfaces:**
- Consumes: nada (primeira tarefa).
- Produces (utilitários Tailwind que as tarefas seguintes usam): `bg-seg`, `bg-thumb`, `text-thumb-foreground`,
  `bg-frame`, `bg-on-pastel`, `text-on-pastel`, `text-on-pastel-ink`, `text-on-pastel-muted`, `bg-on-pastel-soft`,
  `bg-on-pastel-secondary`, `hover:bg-on-pastel-secondary-hover`, `bg-on-pastel-track`, `border-on-pastel-line`,
  `bg-highlight`, `text-on-highlight-muted`, `text-on-highlight-soft`, `bg-invite`, `text-on-invite-muted`,
  `text-on-invite-soft`, `bg-sector-lilac|peach|sky|green|pink`, `bg-pastel-pending`, `text-pastel-pending-foreground`,
  `bg-pastel-confirmed`, `text-pastel-confirmed-foreground`; **extras (ver "Dúvidas")**: `shadow-thumb`,
  `shadow-drawer`, `bg-scrim`. Breakpoint: `md:` e `max-md:` passam a valer em 860px (`53.75rem`).
  `MOBILE_BREAKPOINT = 860` em `src/hooks/use-mobile.ts`.

Testes existentes que mencionam o que a tarefa toca (`grep -rl "use-mobile\|useIsMobile\|chart-5\|--background" src test e2e`):
`src/components/ui/sidebar.tsx` (usa o hook; nenhum teste fixa 768), `test/setup-dom.ts` (o `matchMedia` falso devolve
`matches: false`, não depende do número) e `src/app/chartPalette.test.ts` (muda, Step 5). Nenhum outro precisa mudar.

- [ ] **Step 1: Escrever os testes que falham (contraste) e o guarda novo (cor crua)**

Crie `src/app/themeContrast.test.ts` com a ferramenta Write:

```ts
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
const css = readFileSync(join(import.meta.dirname, "globals.css"), "utf8")
  .replaceAll("\r\n", "\n");
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

  it.each(FIXED_TOKENS)("--%s existe em :root e o .dark não a redefine", (name) => {
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
      expect(ratio, `${fg} sobre ${bg}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        TEXT_MIN,
      );
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
    expect(ratio, `${fg} sobre ${bg}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
      TEXT_MIN,
    );
  });

  it.each(OVERLAY_CASES)("%s sobre o bloco %s em cima de %s (≥4,5:1)", (fg, overlay, base) => {
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
    expect(contrast([1, 1, 1], solid(fixed("highlight"), "highlight"))).toBeLessThan(
      TEXT_MIN,
    );
  });

  it("a tinta clara dos botões sobre o card pastel reprova (ela só vale sobre on-pastel)", () => {
    for (const base of PASTEL_BASES) {
      expect(
        contrast(solid(fixed("on-pastel-ink"), "on-pastel-ink"), solid(fixed(base), base)),
        base,
      ).toBeLessThan(TEXT_MIN);
    }
  });

  it("o bloco translúcido muda o fundo medido (compor não é no-op)", () => {
    const base = solid(fixed("sector-lilac"), "sector-lilac");
    expect(over(fixed("on-pastel-soft"), base)).not.toEqual(base);
  });
});
```

Crie `src/app/rawColors.test.ts` com a ferramenta Write:

```ts
/**
 * Guarda da regra do AGENTS.md "nunca hex cru nem classe de cor crua do Tailwind" (spec §9,
 * "Guarda novo"). Varre os `.tsx` de `src/components` e `src/app` (fora os `*.test.tsx`) e recusa:
 * (1) hex cru, (2) classe de cor crua da paleta do Tailwind (`text-red-500`, `bg-zinc-900`...) e
 * (3) cor dentro de valor arbitrário (`bg-[#fff]`, `shadow-[0_2px_8px_rgba(...)]`).
 *
 * `bg-black/10` e `bg-white` (sem número) ficam fora da regra: não são da paleta numerada, e os
 * véus de `dialog.tsx` e `sheet.tsx` os usam hoje. Cor de verdade entra por token (`ui-tokens.md`).
 *
 * Única exceção: `src/components/ui/chart.tsx`, cujos `[stroke='#ccc']` e `[stroke='#fff']` são
 * seletores do recharts, não cor nossa. O `src/lib/avatar.ts` é `.ts` e fica fora do guarda.
 *
 * Rodar: `bunx vitest run src/app/rawColors.test.ts`
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "..");
const ROOTS = [join(SRC, "components"), join(SRC, "app")];

const CLASS_PREFIX =
  "(?:bg|text|stroke|fill|border|ring|ring-offset|outline|from|via|to|shadow|divide|accent|caret|decoration|placeholder)";
const RAW_COLOR =
  "(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)";
// `(?<![\w-])` + variantes (`dark:`, `focus-visible:`, `hover:`...) antes do prefixo.
const VARIANTS = "(?<![\\w-])(?:[\\w-]+:)*";

const RULES: readonly (readonly [string, RegExp])[] = [
  [
    "hex cru",
    // `(?<![\w&(])` poupa `url(#clip)` e `&#39;`; `(?![\w-])` poupa `#add-item`.
    /(?<![\w&(])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/,
  ],
  [
    "classe de cor crua do Tailwind",
    new RegExp(`${VARIANTS}${CLASS_PREFIX}-${RAW_COLOR}-\\d{2,3}(?![\\w-])`),
  ],
  [
    "cor dentro de valor arbitrário",
    /-\[[^\]]*(?:#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|oklch\()/,
  ],
];

/** Trechos exatos que não são cor nossa, por arquivo (chave relativa a `src/`, com `/`). */
const EXCEPTIONS: Record<string, readonly string[]> = {
  "components/ui/chart.tsx": ["[stroke='#ccc']", "[stroke='#fff']"],
};

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

/** Os nomes das regras que o código reprova (vazio = limpo). */
function violationsIn(source: string, key = ""): string[] {
  let code = stripComments(source);
  for (const literal of EXCEPTIONS[key] ?? []) {
    code = code.replaceAll(literal, "");
  }
  return RULES.filter(([, pattern]) => pattern.test(code)).map(
    ([name]) => name,
  );
}

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return name.endsWith(".tsx") && !name.endsWith(".test.tsx") ? [full] : [];
  });
}

const files = ROOTS.flatMap(tsxFiles).map((full) => ({
  full,
  key: relative(SRC, full).replaceAll("\\", "/"),
}));

describe("nenhum .tsx usa hex cru nem classe de cor crua", () => {
  it("anti-vacuidade: acha os arquivos que deve varrer", () => {
    expect(files.length).toBeGreaterThanOrEqual(100);
    const keys = files.map((file) => file.key);
    expect(keys).toContain("components/ui/chart.tsx");
    expect(keys).toContain("components/app-shell/MenuToggle.tsx");
    expect(keys).toContain("app/layout.tsx");
    expect(keys.some((key) => key.endsWith(".test.tsx"))).toBe(false);
  });

  it("todos os arquivos estão limpos", () => {
    const offenders = files.flatMap(({ full, key }) =>
      violationsIn(readFileSync(full, "utf8"), key).map(
        (rule) => `${key}: ${rule}`,
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("a exceção de chart.tsx está viva: sem ela o arquivo reprovaria (se limparem o arquivo, apague a exceção)", () => {
    const chart = files.find((file) => file.key === "components/ui/chart.tsx");
    expect(chart).toBeDefined();
    expect(violationsIn(readFileSync(chart?.full ?? "", "utf8"))).toContain(
      "hex cru",
    );
  });
});

describe("a varredura reprova o que deve reprovar (caso negativo)", () => {
  it.each([
    ['className="bg-zinc-900"', "classe de cor crua do Tailwind"],
    ['className="text-red-500"', "classe de cor crua do Tailwind"],
    [
      'className="dark:hover:bg-emerald-950/40"',
      "classe de cor crua do Tailwind",
    ],
    ['className="border-sky-200"', "classe de cor crua do Tailwind"],
    ['const color = "#ccc"', "hex cru"],
    ['const color = "#1c1b19"', "hex cru"],
    ['const color = "#1C1B1980"', "hex cru"],
    ['style={{ color: "#f2efe8" }}', "hex cru"],
    ['className="bg-[#fff]"', "cor dentro de valor arbitrário"],
    ['className="text-[oklch(0.5_0.1_20)]"', "cor dentro de valor arbitrário"],
    [
      'className="shadow-[0_2px_8px_rgba(0,0,0,.18)]"',
      "cor dentro de valor arbitrário",
    ],
  ])("%s reprova", (source, rule) => {
    expect(violationsIn(source)).toContain(rule);
  });

  it("código limpo passa: tokens, utilitários novos, ids, âncoras e comentários", () => {
    expect(
      violationsIn(`
        // bg-zinc-900 e #ccc num comentário não contam
        /* text-red-500 */
        const clip = \`url(#\${id}-lit)\`;
        const a = "bg-sector-sky text-on-pastel bg-highlight bg-on-pastel-soft shadow-thumb bg-scrim";
        const b = "dark:bg-card focus-visible:ring-ring fill-foreground/5 bg-black/10 text-white";
        const c = "https://example.com/#secao";
        const d = <a href="#add-item">ir</a>;
        const e = "&#39;";
      `),
    ).toEqual([]);
  });

  it("o par de seletores do recharts só passa no arquivo da exceção", () => {
    const source = `className="[&_.x_line[stroke='#ccc']]:stroke-border"`;
    expect(violationsIn(source, "components/ui/chart.tsx")).toEqual([]);
    expect(violationsIn(source, "components/app-shell/Outro.tsx")).toContain(
      "hex cru",
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bunx vitest run src/app/themeContrast.test.ts src/app/rawColors.test.ts`
Expected: `themeContrast.test.ts` **FAIL** (dezenas de casos) com mensagens como `--seg ausente em :root`,
`--on-pastel ausente em :root`, `Error: seletor @theme não encontrado`... Os casos que não leem o CSS novo
(parseColor, contrast, over, validador) passam. `rawColors.test.ts` **PASS** já de saída: a regra do AGENTS.md
já vale no código atual (nenhuma violação; confirmado por `grep` ao redigir), e os casos negativos provam que o guarda não
está vazio.

- [ ] **Step 3: Implementar a paleta nova em `src/app/globals.css`**

Substitua o arquivo inteiro (ferramenta Write). O que muda: bloco `@theme` novo (breakpoint, sombras, véu), a ponte
nova no `@theme inline`, os valores de `:root` e `.dark`, e o `--chart-5` (que precisa seguir o `--foreground`, P13).
As cores de `chart-1..4`, `success`, `warning` e `info` ficam **idênticas**.

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

/*
 * Visual novo (spec 2026-11-27). Celular é ABAIXO de 860px no app inteiro (C-V3): o `md` do
 * Tailwind passa a 53,75rem e o MOBILE_BREAKPOINT de src/hooks/use-mobile.ts vale 860.
 * As sombras e o véu do drawer têm valor literal aqui, nunca em .tsx (guarda src/app/rawColors.test.ts).
 */
@theme {
  --breakpoint-md: 53.75rem;
  --shadow-thumb: 0 2px 8px rgba(0, 0, 0, 0.18), 0 0 0 0.5px rgba(0, 0, 0, 0.06);
  --shadow-drawer: 20px 0 60px rgba(0, 0, 0, 0.35);
  --color-scrim: rgba(0, 0, 0, 0.45);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
  --color-seg: var(--seg);
  --color-thumb: var(--thumb);
  --color-thumb-foreground: var(--thumb-foreground);
  --color-frame: var(--frame);
  --color-on-pastel: var(--on-pastel);
  --color-on-pastel-ink: var(--on-pastel-ink);
  --color-on-pastel-muted: var(--on-pastel-muted);
  --color-on-pastel-soft: var(--on-pastel-soft);
  --color-on-pastel-secondary: var(--on-pastel-secondary);
  --color-on-pastel-secondary-hover: var(--on-pastel-secondary-hover);
  --color-on-pastel-track: var(--on-pastel-track);
  --color-on-pastel-line: var(--on-pastel-line);
  --color-highlight: var(--highlight);
  --color-on-highlight-muted: var(--on-highlight-muted);
  --color-on-highlight-soft: var(--on-highlight-soft);
  --color-invite: var(--invite);
  --color-on-invite-muted: var(--on-invite-muted);
  --color-on-invite-soft: var(--on-invite-soft);
  --color-sector-lilac: var(--sector-lilac);
  --color-sector-peach: var(--sector-peach);
  --color-sector-sky: var(--sector-sky);
  --color-sector-green: var(--sector-green);
  --color-sector-pink: var(--sector-pink);
  --color-pastel-pending: var(--pastel-pending);
  --color-pastel-pending-foreground: var(--pastel-pending-foreground);
  --color-pastel-confirmed: var(--pastel-confirmed);
  --color-pastel-confirmed-foreground: var(--pastel-confirmed-foreground);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
  /* Tema claro. Os nomes do protótipo (bg, surface, surface2, ink, muted, line, btn) estão em ui-tokens.md. */
  --background: #f4f1ea;
  --foreground: #1c1b19;
  --card: #ffffff;
  --card-foreground: #1c1b19;
  --popover: #ffffff;
  --popover-foreground: #1c1b19;
  --primary: #1c1b19;
  --primary-foreground: #f4f1ea;
  --secondary: #ffffff;
  --secondary-foreground: #1c1b19;
  --muted: #ffffff;
  --muted-foreground: #67635b;
  --accent: #ebe7de;
  --accent-foreground: #1c1b19;
  --destructive: oklch(0.577 0.245 27.325);
  --border: rgba(28, 27, 25, 0.09);
  --input: rgba(28, 27, 25, 0.15);
  --ring: #67635b;
  --chart-1: #8d3e0f;
  --chart-2: #2c8faf;
  --chart-3: #7235a6;
  --chart-4: #738c57;
  /* "Outros": o mesmo valor de --foreground (P13); nenhum gráfico usa chart-5 como série. */
  --chart-5: #1c1b19;
  --success: #d3eedd;
  --success-foreground: #1f5131;
  --warning: #f5e0bc;
  --warning-foreground: #6a451b;
  --info: #cbe4f6;
  --info-foreground: #1d4a72;
  --radius: 0.625rem;
  --sidebar: #f4f1ea;
  --sidebar-foreground: #1c1b19;
  --sidebar-primary: #1c1b19;
  --sidebar-primary-foreground: #f4f1ea;
  --sidebar-accent: #ebe7de;
  --sidebar-accent-foreground: #1c1b19;
  --sidebar-border: rgba(28, 27, 25, 0.09);
  --sidebar-ring: #67635b;
  --seg: #e4e0d6;
  --thumb: #ffffff;
  --thumb-foreground: #1c1b19;
  --frame: #1c1b19;

  /*
   * Cores fixas: iguais nos dois temas, por isso só aqui (o .dark herda; o guarda
   * src/app/themeContrast.test.ts confere que ele não as redefine).
   */
  --on-pastel: #1c1b19;
  --on-pastel-ink: #f2efe8;
  --on-pastel-muted: #33302a;
  --on-pastel-soft: rgba(28, 27, 25, 0.08);
  --on-pastel-secondary: rgba(28, 27, 25, 0.1);
  --on-pastel-secondary-hover: rgba(28, 27, 25, 0.16);
  --on-pastel-track: rgba(28, 27, 25, 0.14);
  --on-pastel-line: rgba(28, 27, 25, 0.12);
  --highlight: #ffd23f;
  --on-highlight-muted: #3b3628;
  --on-highlight-soft: #4a4332;
  --invite: #f2a7c6;
  --on-invite-muted: #3a2730;
  --on-invite-soft: #4a2c3a;
  --sector-lilac: #b3a6e6;
  --sector-peach: #f6b48f;
  --sector-sky: #8ecae6;
  --sector-green: #a7d49b;
  --sector-pink: #f2a7c6;
  --pastel-pending: #cbe4f6;
  --pastel-pending-foreground: #1d4a72;
  --pastel-confirmed: #d3eedd;
  --pastel-confirmed-foreground: #1f5131;
}

.dark {
  --background: #1c1b19;
  --foreground: #f2efe8;
  --card: #282724;
  --card-foreground: #f2efe8;
  --popover: #282724;
  --popover-foreground: #f2efe8;
  --primary: #f2efe8;
  --primary-foreground: #1c1b19;
  --secondary: #282724;
  --secondary-foreground: #f2efe8;
  --muted: #282724;
  --muted-foreground: #a9a49a;
  --accent: #34332f;
  --accent-foreground: #f2efe8;
  --destructive: oklch(0.704 0.191 22.216);
  --border: rgba(255, 255, 255, 0.08);
  --input: rgba(255, 255, 255, 0.15);
  --ring: #a9a49a;
  --chart-1: #c3550c;
  --chart-2: #56badd;
  --chart-3: #836b9f;
  --chart-4: #95b278;
  --chart-5: #f2efe8;
  --success: #1d3526;
  --success-foreground: #75d799;
  --warning: #372d1b;
  --warning-foreground: #e4bb67;
  --info: #1b2a37;
  --info-foreground: #74b1e7;
  --sidebar: #1c1b19;
  --sidebar-foreground: #f2efe8;
  --sidebar-primary: #f2efe8;
  --sidebar-primary-foreground: #1c1b19;
  --sidebar-accent: #34332f;
  --sidebar-accent-foreground: #f2efe8;
  --sidebar-border: rgba(255, 255, 255, 0.08);
  --sidebar-ring: #a9a49a;
  --seg: #282724;
  --thumb: #f2efe8;
  --thumb-foreground: #1c1b19;
  --frame: #0f0e0d;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```

- [ ] **Step 4: Trocar o breakpoint da sidebar**

Edite `src/hooks/use-mobile.ts`:

```ts
// old_string
const MOBILE_BREAKPOINT = 768;
// new_string
// Celular é abaixo de 860px (C-V3). Mesmo número do `--breakpoint-md` (53,75rem) do globals.css;
// o guarda src/app/themeContrast.test.ts confere os dois.
const MOBILE_BREAKPOINT = 860;
```

- [ ] **Step 5: Ajustar o caso negativo do `muted-foreground` em `chartPalette.test.ts`**

O `muted-foreground` novo do tema claro (`#67635b`) **separa** de `chart-4` em tritanopia (ΔE 16,1), e o do escuro
(`#a9a49a`) continua reprovando (ΔE 11,0). O caso negativo existe para provar *por que* "Outros" é o `foreground`
(o cinza do shadcn reprovava); ele passa a medir o cinza **antigo** do shadcn, que é a razão histórica. O piso (`DELTA_E_MIN`)
não muda e nenhuma série mudou.

Edite `src/app/chartPalette.test.ts`:

```ts
// old_string
  it("muted-foreground reprova a separação de chart-4 em tritanopia, nos dois temas: por isso Outros é foreground", () => {
    for (const [, selector] of THEMES) {
      const muted = readToken(css, selector, "muted-foreground");
      const chart4 = readToken(css, selector, "chart-4");
      expect(pairDeltaE(muted, chart4, "tritanopia")).toBeLessThan(DELTA_E_MIN);
    }
  });
// new_string
  it("o muted-foreground antigo (cinza do shadcn) reprova a separação de chart-4 em tritanopia, nos dois temas: por isso Outros é foreground", () => {
    // Valores de antes do visual novo (2026-11-27): o `muted-foreground` atual é quente e no claro já passa (ΔE 16,1).
    const oldMuted = { ":root": "oklch(0.556 0 0)", ".dark": "oklch(0.708 0 0)" };
    for (const [, selector] of THEMES) {
      const muted = parseColor(oldMuted[selector]);
      const chart4 = readToken(css, selector, "chart-4");
      expect(pairDeltaE(muted, chart4, "tritanopia")).toBeLessThan(DELTA_E_MIN);
    }
  });
```

- [ ] **Step 6: Formatar e rodar os guardas e os testes que tocam o hook**

Run: `bunx biome check --write src/app/themeContrast.test.ts src/app/rawColors.test.ts src/app/chartPalette.test.ts src/app/globals.css src/hooks/use-mobile.ts`
Expected: `Checked 5 files` e, no máximo, "Fixed N files" (o Biome normaliza quebras de linha e ordem de importação).

Run: `bunx vitest run src/app/themeContrast.test.ts src/app/rawColors.test.ts src/app/chartPalette.test.ts src/components/ui/sidebar.test.tsx src/components/app-shell/AppSidebar.test.tsx src/components/app-shell/SidebarSkeleton.test.tsx`
Expected: todos os arquivos **PASS** (`Test Files  6 passed`). Se `chartPalette` reprovar uma série ou o
`chart-5`, **não** afrouxe o piso: o ΔE e o contraste de `chart-5` medidos ao redigir passam (`chart-5` escuro:
13,01:1 sobre o card, ΔE mínimo 19,6; claro: 17,21:1, ΔE mínimo 20,1; `chart-1` escuro 3,29:1 e `chart-3` escuro
3,25:1 sobre o card novo, acima do piso de 3:1).

Run (opcional, para colar a matriz no doc do Step 7): `VITEST_PRINT_THEME_CONTRAST=1 bunx vitest run src/app/themeContrast.test.ts`
(no Git Bash; no PowerShell, `$env:VITEST_PRINT_THEME_CONTRAST=1`). Expected: o log `[superfícies · claro]`, `[superfícies · escuro]`
e `[pastéis]` com todas as razões ≥ 4,50.

- [ ] **Step 7: Reescrever `.context/ui-tokens.md`**

Substitua o arquivo inteiro (ferramenta Write; tem acento):

````markdown
# UI Tokens — Closery

> **Documento vivo + lei do design.** Toda cor, raio, tipografia e espaçamento sai daqui.
> **Proibido** hex ou classe de cor crua (`bg-[#...]`, `text-emerald-500`) em qualquer `.tsx`
> (guarda `src/app/rawColors.test.ts`). Se um valor não existe como token, **adicione o token**, não burle.
> Fonte de verdade dos valores: `src/app/globals.css`.

---

## 1. Direção visual · 🟢 definido (visual novo, 2026-11-27; spec `docs/superpowers/specs/2026-11-27-visual-inicio-design.md`)

Fundo escuro quente (**o tema escuro é o padrão**, com um switch para o claro), títulos em **Satoshi**
muito pesada, botões e badges em **pílula**, cards grandes de 32px em cores pastel, controles no estilo
Apple (seletor deslizante e switch de tema). Vale para **todas** as telas (D-V1); só o Início e o shell
mudam de layout por enquanto.

Os tokens continuam com os nomes do shadcn (`background`, `card`, `primary`...). O protótipo do
handoff usa outros nomes; a ponte é a tabela do §2.

Restrições que valem sempre:
- **Legível em ambiente operacional:** todo texto passa no AA (4,5:1) nos dois temas; o guarda
  `src/app/themeContrast.test.ts` mede cada par. Uso provável no celular, em área de carga, com pressa.
- **Cor carrega significado, não decoração:** status (ok / atenção / problema) e entidades do
  dashboard têm cor fixa; o amarelo `highlight` é só o "Passagem para confirmar" (precisa de atenção).
- **Sobre os pastéis a tinta é sempre `on-pastel`** (nunca `foreground`, que muda com o tema).
- **Marca de terceiros** (logo/cores da LATAM) só com autorização, ver `pendencias.md`.

## 2. Cores do tema (mudam entre claro e escuro)

`:root` é o claro; `.dark` é o escuro. A coluna "Protótipo" é o nome do handoff.

| Protótipo | Tokens que recebem o valor | Claro | Escuro |
|---|---|---|---|
| `bg` | `background`, `sidebar` | `#f4f1ea` | `#1c1b19` |
| `surface` | `card`, `popover`, `secondary`, `muted` | `#ffffff` | `#282724` |
| `surface2` | `accent`, `sidebar-accent` | `#ebe7de` | `#34332f` |
| `ink` | `foreground` e todo `*-foreground` de superfície (card, popover, secondary, accent, sidebar) | `#1c1b19` | `#f2efe8` |
| `muted` | `muted-foreground` (e `ring`, `sidebar-ring`) | `#67635b` | `#a9a49a` |
| `line` | `border`, `sidebar-border` | `rgba(28,27,25,.09)` | `rgba(255,255,255,.08)` |
| (campos) | `input` | `rgba(28,27,25,.15)` | `rgba(255,255,255,.15)` |
| `btn` / `btnInk` | `primary` / `primary-foreground` e `sidebar-primary` / `sidebar-primary-foreground` | `#1c1b19` / `#f4f1ea` | `#f2efe8` / `#1c1b19` |
| `seg` | `seg`: trilho do seletor deslizante | `#e4e0d6` | `#282724` |
| `thumb` / `thumbInk` | `thumb` / `thumb-foreground`: o botão que desliza | `#ffffff` / `#1c1b19` | `#f2efe8` / `#1c1b19` |
| `frame` | `frame`: moldura dos avatares | `#1c1b19` | `#0f0e0d` |
| `warn`, `info`, `succ` | `warning`, `info`, `success` e os `*-foreground` | sem mudança | sem mudança |
| (erro) | `destructive` | sem mudança | sem mudança |

| Token de status | Claro | Escuro |
|---|---|---|
| `success` / `-foreground` | `#d3eedd` / `#1f5131` | `#1d3526` / `#75d799` |
| `warning` / `-foreground` | `#f5e0bc` / `#6a451b` | `#372d1b` / `#e4bb67` |
| `info` / `-foreground` | `#cbe4f6` / `#1d4a72` | `#1b2a37` / `#74b1e7` |

Uso do status: estados de solicitação e de passagem, **sempre com ícone + texto**.

## 3. Cores fixas (iguais nos dois temas)

Só em `:root` (o `.dark` herda e o guarda confere que não as redefine). Utilitários: `bg-highlight`,
`text-on-pastel`, `bg-sector-lilac`, `bg-on-pastel-soft`...

| Token | Valor | Uso |
|---|---|---|
| `on-pastel` | `#1c1b19` | tinta sobre os cards coloridos; fundo do botão primário e do chip de setor dentro deles |
| `on-pastel-ink` | `#f2efe8` | texto do botão primário e do chip dentro dos cards coloridos |
| `on-pastel-muted` | `#33302a` | texto secundário no cartão de turno |
| `on-pastel-soft` | `rgba(28,27,25,.08)` | bloco interno dos cards coloridos |
| `on-pastel-secondary` / `-hover` | `rgba(28,27,25,.10)` / `rgba(28,27,25,.16)` | botão secundário dentro dos cards coloridos |
| `on-pastel-track` | `rgba(28,27,25,.14)` | trilho da barra do turno |
| `on-pastel-line` | `rgba(28,27,25,.12)` | divisória das linhas de Cadastros |
| `highlight` | `#ffd23f` | só o "Passagem para confirmar" |
| `on-highlight-muted` / `on-highlight-soft` | `#3b3628` / `#4a4332` | texto e eyebrow sobre o amarelo |
| `invite` | `#f2a7c6` | só o "Convide sua equipe" |
| `on-invite-muted` / `on-invite-soft` | `#3a2730` / `#4a2c3a` | texto e eyebrow sobre o rosa |
| `sector-lilac` `sector-peach` `sector-sky` `sector-green` `sector-pink` | `#b3a6e6` `#f6b48f` `#8ecae6` `#a7d49b` `#f2a7c6` | cor do setor (coluna `sector.color`, `src/features/sectors/colors.ts`); **nunca ciclada** |
| `pastel-pending` / `-foreground` | `#cbe4f6` / `#1d4a72` | badge "Aguardando recebimento" no cartão de turno |
| `pastel-confirmed` / `-foreground` | `#d3eedd` / `#1f5131` | badge "Confirmada" no cartão de turno |

**Sombras e véu** (tokens do `@theme`; valores literais só no `globals.css`): `shadow-thumb`
(`0 2px 8px rgba(0,0,0,.18), 0 0 0 .5px rgba(0,0,0,.06)`, só o thumb do seletor), `shadow-drawer`
(`20px 0 60px rgba(0,0,0,.35)`, só o drawer do celular) e `bg-scrim` (`rgba(0,0,0,.45)`, o véu do drawer).
Fora isso nada usa sombra: os cards se separam pela cor.

**Exceção documentada, os fundos de avatar:** `b6e3f4`, `ffdfbf`, `ffd5dc` e `d1d4f9` ficam só em
`src/lib/avatar.ts` (`.ts`, fora do guarda de cor crua). São dados da arte do DiceBear, não tokens de interface.

### Contraste medido (AA, texto normal ≥ 4,5:1)

Medido por `src/app/themeContrast.test.ts` contra o `globals.css` (rode com `VITEST_PRINT_THEME_CONTRAST=1`
para reimprimir). Piso nunca se afrouxa: reprovou, ajuste o token.

| Par (texto sobre fundo) | Claro | Escuro |
|---|---|---|
| `foreground` / `background` | 15,26 | 14,99 |
| `card-foreground` / `card` | 17,21 | 13,01 |
| `accent-foreground` / `accent` | 13,95 | 11,01 |
| `muted-foreground` / `background` · `card` · `accent` · `seg` | 5,30 · 5,98 · 4,84 · 4,54 | 6,94 · 6,02 · 5,10 · 6,02 |
| `primary-foreground` / `primary` | 15,26 | 14,99 |
| `thumb-foreground` / `thumb` | 17,21 | 14,99 |
| `success` · `warning` · `info` (`-foreground` sobre o fundo) | 7,48 · 6,56 · 7,02 | 7,51 · 7,47 · 6,41 |

| Par fixo (iguais nos dois temas) | Contraste |
|---|---|
| `on-pastel` sobre lilás · pêssego · azul · verde · rosa | 7,80 · 9,71 · 9,62 · 10,27 · 9,11 |
| `on-pastel` sobre `highlight` · `invite` | 11,92 · 9,11 |
| `on-pastel-muted` sobre lilás · pêssego · azul · verde · rosa | 5,96 · 7,42 · 7,35 · 7,85 · 6,96 |
| `on-highlight-muted` · `-soft` sobre `highlight` | 8,34 · 6,80 |
| `on-invite-muted` · `-soft` sobre `invite` | 7,35 · 6,49 |
| `on-pastel-ink` sobre `on-pastel` | 14,99 |
| `pastel-pending-foreground` · `pastel-confirmed-foreground` | 7,02 · 7,48 |
| o menor par sobre bloco translúcido (`on-pastel-muted` sobre `on-pastel-soft` em lilás) | 5,19 |

## 4. Gráficos (D16, valores do klauve, inalterados no visual novo)

`chart-1..4` são as séries (ordem de uso; máx. 4); `chart-5` é o neutro de "Outros" e do 5º turno em
diante: **o mesmo valor de `foreground`** (P13, hoje `#1c1b19` no claro e `#f2efe8` no escuro); nunca série com
identidade. Ninguém usa `chart-5` como série: quem precisa do neutro usa `foreground` direto.

| Token | Claro | Escuro |
|---|---|---|
| `chart-1` | `#8d3e0f` | `#c3550c` |
| `chart-2` | `#2c8faf` | `#56badd` |
| `chart-3` | `#7235a6` | `#836b9f` |
| `chart-4` | `#738c57` | `#95b278` |

**Guarda de paleta (P9):** `src/app/chartPalette.test.ts` lê o `globals.css` e reprova, nos dois temas, série
fora da banda de lightness OKLCH 0,43–0,77, croma < 0,06, contraste < 3:1 sobre `--card`, ΔE2000 < 15 entre
qualquer par (visão normal, deuteranopia, protanopia, tritanopia) e `-foreground` de status < 4,5:1 sobre o
fundo do par. Medido contra os cards do visual novo (`#ffffff` claro, `#282724` escuro):

| | Claro | Escuro |
|---|---|---|
| contraste `chart-1..4` sobre o card | 7,42 · 3,71 · 7,57 · 3,74 | 3,29 · 6,73 · 3,25 · 6,34 |
| ΔE2000 mínimo entre as séries (normal / deuter. / protan. / tritan.) | 34,5 / 17,6 / 23,2 / 17,7 | 35,6 / 17,5 / 22,4 / 17,6 |
| contraste de `chart-5` (= `foreground`) sobre o card | 17,21 | 13,01 |
| ΔE2000 mínimo de `chart-5` contra `chart-1..4` (normal / deuter. / protan. / tritan.) | 30,4 / 30,0 / 23,7 / 20,1 | 25,5 / 22,4 / 22,2 / 19,6 |

No escuro, `chart-1` e `chart-3` ficaram a 3,29:1 e 3,25:1 do card novo (eram 3,95 e 3,90 sobre o card
antigo): ainda acima do piso de 3:1, mas com pouca folga; qualquer card mais claro exige reajustar a série
dentro das regras do guarda.

**Por que "Outros" é o `foreground`:** o `muted-foreground` do shadcn antigo (`oklch(0.556 0 0)` claro,
`oklch(0.708 0 0)` escuro) reprovava a separação de `chart-4` em tritanopia (ΔE 8,6 e 6,8). O `muted-foreground`
quente de hoje passa no claro (ΔE 16,1) e continua reprovando no escuro (ΔE 11,0), então o neutro segue sendo
o `foreground`. O caso negativo do guarda mede o cinza antigo.

## 5. Raio e formas

Base `--radius: 0.625rem`; escala `rounded-sm` … `rounded-4xl` derivada dela (telas antigas). Formas do visual novo:

| Elemento | Raio |
|---|---|
| botão, badge, seletor, thumb, switch de tema | pílula (`rounded-full`), **no app inteiro** (C-V2) |
| card `feature` | 32px (padding 32px, 22px abaixo de 860px) |
| grupo da nav | 28px |
| card do usuário | 24px |
| bloco interno de card colorido | 22px |
| linha clicável de solicitação | 18px |
| avatar 34 / 36 / 44 / 52 / 84px | 12 / 12 / 15 / 17 / 26px (a imagem interna é 3px menor) |

Celular é **abaixo de 860px** no app inteiro (`md:` e `max-md:` valem em 860px; C-V3).

## 6. Tipografia

- **Display:** **Satoshi** 500/700/900 (`next/font/local`, baixada por `bun run fonts`; licença em
  `library-docs.md`) em `--font-heading` (`font-heading`). Títulos, rótulos de botão, itens da nav, seletor.
- **Texto:** **Geist** via `next/font` em `--font-sans`, pesos 400/500/600.
- **Mono:** **Geist Mono** em `--font-geist-mono` (`font-mono`): eyebrows, datas, horários da barra, chips de setor e papel.
- Corpo `text-sm`+ (nunca `text-xs` para conteúdo, exceto badges e eyebrows); campos de digitação `text-base` (16px).
- Números de contagem e do dashboard com `tabular-nums`.
- Os tamanhos display do Início (saudação 72px, horário 64px, contador 76px) estão na spec §6.

## 7. Como usar

✅ `bg-background`, `text-foreground`, `bg-muted`, `text-muted-foreground`, `bg-card`,
`border-border`, `bg-primary text-primary-foreground`, `rounded-full`, `ring-ring`,
`bg-highlight text-on-pastel`, `bg-sector-sky`, `shadow-thumb`.

❌ `bg-[#F5F5F6]`, `text-zinc-500`, `bg-green-500`, `border-gray-200`, `shadow-[0_2px_8px_rgba(...)]`,
`z-[...]` arbitrário.

🔁 **Faltou um token?** Adicione no `globals.css` (claro **e** escuro, ou só `:root` se for fixo), exponha no
`@theme inline`, mede o contraste em `themeContrast.test.ts` e documente aqui.
````

- [ ] **Step 8: Tipos, lint e os testes da tarefa**

Run: `bun run check-types`
Expected: sai com código 0, sem erros.

Run: `bun run lint`
Expected: `Checked N files ... No fixes applied` e código 0. (Se o Biome reclamar do `.md`/`.css`, rode `bunx biome check --write` nos arquivos tocados e repita.)

Run: `bunx vitest run src/app/themeContrast.test.ts src/app/rawColors.test.ts src/app/chartPalette.test.ts test/uiRegistryDoc.test.ts`
Expected: `Test Files  4 passed`.

- [ ] **Step 9: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/visual/msg-task-1.txt`:

```
feat(ui): paleta nova, breakpoint 860 e guardas de cor e contraste

Troca os tokens do globals.css pela paleta do visual novo (claro e escuro),
adiciona as cores fixas dos cards pastel, as cores de setor, as sombras e o
véu do drawer, e põe o celular abaixo de 860px (md e MOBILE_BREAKPOINT).
Dois guardas novos: rawColors (sem hex nem classe de cor crua nos .tsx) e
themeContrast (todo par texto/fundo em AA nos dois temas). O caso negativo do
muted-foreground em chartPalette passa a medir o cinza antigo do shadcn.
ui-tokens.md reescrito para a paleta nova.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Run: `git add src/app/globals.css src/app/themeContrast.test.ts src/app/rawColors.test.ts src/app/chartPalette.test.ts src/hooks/use-mobile.ts .context/ui-tokens.md && git commit -F .git/sdd/visual/msg-task-1.txt`
Expected: `1 file`... `6 files changed`, commit criado na branch `feat/visual-inicio`.

---

### Task 2: Satoshi (`fetchFonts`, ganchos, `next/font/local`, cache no CI)

**Files:**
- Create: `scripts/fontsCheck.mjs` (puro: parse do CSS da Fontshare, caminho, hash)
- Create: `scripts/fetchFonts.mjs` (baixa, confere o SHA-256 e grava; `ensureSatoshi` exportada e testável; o CLI roda só como entrada)
- Create: `test/fontsFixtures.ts` (o CSS da Fontshare de mentira, no formato real, e os bytes falsos)
- Create: `test/fontsCheck.test.ts`
- Create: `test/fetchFonts.test.ts`
- Create: `test/fontsConfig.test.ts` (guarda de configuração: `package.json`, `.gitignore`, `ci.yml`, `layout.tsx`)
- Modify: `package.json` (`fonts`, `predev`, `prebuild`)
- Modify: `.gitignore` (`/src/fonts/satoshi/`)
- Modify: `src/app/layout.tsx` (`localFont` com 3 pesos, `--font-satoshi`)
- Modify: `src/app/globals.css` (`--font-heading: var(--font-satoshi);`)
- Modify: `.github/workflows/ci.yml` (cache de `src/fonts/satoshi` no job E2E)
- Modify: `AGENTS.md` (linha `bun run fonts` na tabela de comandos)
- Modify: `.context/library-docs.md` (seção 17, Satoshi)
- Test: `test/fontsCheck.test.ts`, `test/fetchFonts.test.ts`, `test/fontsConfig.test.ts`

**Interfaces:**
- Consumes: de Task 1, `--font-heading` no `@theme inline` do `globals.css` (muda de `var(--font-sans)` para `var(--font-satoshi)`).
- Produces (nomes do contrato, exatos):
  - `scripts/fontsCheck.mjs`: `parseFontshareCss(css: string): Map<number, string>` (peso → URL `https:` do `woff2`);
    `SATOSHI_SHA256` (`{ 500, 700, 900 }`, os valores do contrato); `satoshiPath(weight: 500 | 700 | 900): string`
    → `src/fonts/satoshi/Satoshi-<peso>.woff2`. Extras (auxiliares das tarefas desta mesma entrega, ver "Dúvidas"):
    `FONTSHARE_CSS_URL`, `SATOSHI_WEIGHTS` (`[500, 700, 900]`), `sha256Hex(bytes)`, `isSatoshiFileValid(weight, bytes, expected?)`.
  - `scripts/fetchFonts.mjs`: `ensureSatoshi(options?)` e `diskIo`; CLI `bun scripts/fetchFonts.mjs` (código 1 em erro).
  - `package.json`: `bun run fonts`, `predev`, `prebuild`.
  - `src/app/layout.tsx`: a variável CSS `--font-satoshi` no `<html>`; utilitário Tailwind `font-heading` passa a ser Satoshi.

Testes existentes que mencionam o que a tarefa toca (`grep -rl "font-heading\|--font-sans\|next/font" src test e2e`): nenhum
teste importa o `RootLayout` (spec §4.3), e nenhum fixa `font-heading`. Nada existente precisa mudar.

- [ ] **Step 1: Escrever os testes que falham (módulo puro e fixture)**

Crie `test/fontsFixtures.ts` (não termina em `.test.ts`, então o Vitest não o coleta):

```ts
// Fixtures da Satoshi: o CSS que a Fontshare devolve, no formato real (3 blocos @font-face, cada um
// com woff2, woff e ttf, URLs `//cdn.fontshare.com/wf/<A>/<B>/<C>.<ext>`), com IDs inventados.
// Os bytes são de mentira: o hash esperado dos testes é calculado em cima deles.

export const FONT_WEIGHTS = [500, 700, 900] as const;

export function fixtureUrl(weight: number, ext = "woff2"): string {
  return `//cdn.fontshare.com/wf/AAAAAAAA${weight}/BBBBBBBB${weight}/CCCCCCCC${weight}.${ext}`;
}

function fontFaceBlock(weight: number): string {
  return `@font-face {
  font-family: 'Satoshi';
  src: url('${fixtureUrl(weight, "woff2")}') format('woff2'),
       url('${fixtureUrl(weight, "woff")}') format('woff'),
       url('${fixtureUrl(weight, "ttf")}') format('truetype');
  font-weight: ${weight};
  font-display: swap;
  font-style: normal;
}
`;
}

/** O CSS da Fontshare para `satoshi@500,700,900`. */
export function fontshareCss(weights: readonly number[] = FONT_WEIGHTS): string {
  return `/* Satoshi */\n${weights.map(fontFaceBlock).join("")}\n`;
}

/** Bytes de mentira de cada peso (3 bytes cada). */
export function fakeFontBytes(weight: number): Uint8Array {
  return Uint8Array.from([weight % 251, 1, 2]);
}
```

Crie `test/fontsCheck.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  FONTSHARE_CSS_URL,
  isSatoshiFileValid,
  parseFontshareCss,
  SATOSHI_SHA256,
  SATOSHI_WEIGHTS,
  satoshiPath,
  sha256Hex,
} from "../scripts/fontsCheck.mjs";
import {
  fakeFontBytes,
  fixtureUrl,
  fontshareCss,
} from "./fontsFixtures";

// Regras puras da Satoshi (scripts/fontsCheck.mjs). O CLI (scripts/fetchFonts.mjs) só baixa e grava.

describe("SATOSHI_SHA256 e SATOSHI_WEIGHTS", () => {
  it("têm os três pesos e os hashes fixados do contrato", () => {
    expect(SATOSHI_WEIGHTS).toEqual([500, 700, 900]);
    expect(SATOSHI_SHA256).toEqual({
      500: "af02a72246f53ad49c44a591921edbd39ec8258a03d8cc2e0532aa1e497e85b4",
      700: "353a7fbfb4475f0c31470a7449226006cb64211c71055ca9db860a8acdaa9f68",
      900: "bd11b5820231420e78046c611aebdd628dc17ad67788258ffe3fe902253efd3b",
    });
    for (const hash of Object.values(SATOSHI_SHA256)) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("a URL do CSS pede os três pesos", () => {
    expect(FONTSHARE_CSS_URL).toBe(
      "https://api.fontshare.com/v2/css?f[]=satoshi@500,700,900&display=swap",
    );
  });
});

describe("satoshiPath", () => {
  it.each([
    [500, "src/fonts/satoshi/Satoshi-500.woff2"],
    [700, "src/fonts/satoshi/Satoshi-700.woff2"],
    [900, "src/fonts/satoshi/Satoshi-900.woff2"],
  ] as const)("peso %i → %s (sempre com /, vale no Windows e no Linux)", (weight, path) => {
    expect(satoshiPath(weight)).toBe(path);
  });

  it("recusa peso que não é dos três (400 não existe aqui)", () => {
    expect(() => satoshiPath(400 as never)).toThrow(
      "Peso da Satoshi não suportado: 400",
    );
  });
});

describe("sha256Hex", () => {
  it("bate com os vetores conhecidos do SHA-256", () => {
    expect(sha256Hex(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(sha256Hex(new Uint8Array())).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});

describe("isSatoshiFileValid", () => {
  const expected = {
    500: sha256Hex(fakeFontBytes(500)),
    700: sha256Hex(fakeFontBytes(700)),
    900: sha256Hex(fakeFontBytes(900)),
  };

  it("aceita os bytes com o hash do peso", () => {
    expect(isSatoshiFileValid(500, fakeFontBytes(500), expected)).toBe(true);
  });

  it("recusa bytes de outro peso, vazios e adulterados", () => {
    expect(isSatoshiFileValid(500, fakeFontBytes(700), expected)).toBe(false);
    expect(isSatoshiFileValid(500, new Uint8Array(), expected)).toBe(false);
    expect(
      isSatoshiFileValid(500, Uint8Array.from([...fakeFontBytes(500), 0]), expected),
    ).toBe(false);
  });

  it("sem o terceiro argumento usa os hashes fixados (bytes de mentira reprovam)", () => {
    expect(isSatoshiFileValid(500, fakeFontBytes(500))).toBe(false);
  });
});

describe("parseFontshareCss", () => {
  it("lê o woff2 de cada peso do CSS no formato real, com https:", () => {
    const urls = parseFontshareCss(fontshareCss());
    expect([...urls.keys()]).toEqual([500, 700, 900]);
    expect(urls.get(500)).toBe(`https:${fixtureUrl(500, "woff2")}`);
    expect(urls.get(700)).toBe(`https:${fixtureUrl(700, "woff2")}`);
    expect(urls.get(900)).toBe(`https:${fixtureUrl(900, "woff2")}`);
  });

  it("nunca devolve o woff nem o ttf", () => {
    for (const url of parseFontshareCss(fontshareCss()).values()) {
      expect(url.endsWith(".woff2")).toBe(true);
    }
  });

  it("lê CRLF, aspas duplas, URL já com https:// e um peso só", () => {
    const css = [
      "@font-face {",
      "  font-family: 'Satoshi';",
      '  src: url("https://cdn.fontshare.com/wf/A/B/C.woff2") format("woff2"),',
      '       url("https://cdn.fontshare.com/wf/A/B/C.woff") format("woff");',
      "  font-weight: 700;",
      "}",
    ].join("\r\n");
    expect(parseFontshareCss(css)).toEqual(
      new Map([[700, "https://cdn.fontshare.com/wf/A/B/C.woff2"]]),
    );
  });

  it("falha alto sem nenhum @font-face (corpo vazio ou HTML de erro)", () => {
    expect(() => parseFontshareCss("")).toThrow("nenhum @font-face");
    expect(() => parseFontshareCss("<html>Bad gateway</html>")).toThrow(
      "nenhum @font-face",
    );
  });

  it("falha alto quando um peso vem sem woff2", () => {
    const css = `@font-face {
  src: url('//cdn.fontshare.com/wf/A/B/C.ttf') format('truetype');
  font-weight: 500;
}`;
    expect(() => parseFontshareCss(css)).toThrow("sem woff2 no peso 500");
  });

  it("recusa URL que não é da CDN da Fontshare (defesa em profundidade além do hash)", () => {
    const css = `@font-face {
  src: url('//cdn.exemplo.test/wf/A/B/C.woff2') format('woff2');
  font-weight: 500;
}`;
    expect(() => parseFontshareCss(css)).toThrow("URL de fonte inesperada");
    const http = `@font-face {
  src: url('http://cdn.fontshare.com/wf/A/B/C.woff2') format('woff2');
  font-weight: 500;
}`;
    expect(() => parseFontshareCss(http)).toThrow("URL de fonte inesperada");
  });

  it("ignora bloco sem font-weight (não é um dos nossos pesos)", () => {
    const css = `@font-face { font-family: 'X'; src: url('//cdn.fontshare.com/wf/A/B/C.woff2') format('woff2'); }\n${fontshareCss([900])}`;
    expect([...parseFontshareCss(css).keys()]).toEqual([900]);
  });
});
```

Crie `test/fetchFonts.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { ensureSatoshi } from "../scripts/fetchFonts.mjs";
import { FONTSHARE_CSS_URL, sha256Hex } from "../scripts/fontsCheck.mjs";
import {
  FONT_WEIGHTS,
  fakeFontBytes,
  fixtureUrl,
  fontshareCss,
} from "./fontsFixtures";

// Orquestração do download (scripts/fetchFonts.mjs) com fetch e disco falsos: nada de rede, nada de
// escrita no repositório.

const EXPECTED = {
  500: sha256Hex(fakeFontBytes(500)),
  700: sha256Hex(fakeFontBytes(700)),
  900: sha256Hex(fakeFontBytes(900)),
};

function memoryIo(initial: Record<number, Uint8Array> = {}) {
  const files = new Map<number, Uint8Array>(
    Object.entries(initial).map(([weight, bytes]) => [Number(weight), bytes]),
  );
  const writes: number[] = [];
  return {
    files,
    writes,
    io: {
      read: async (weight: number) => files.get(weight) ?? null,
      write: async (weight: number, bytes: Uint8Array) => {
        writes.push(weight);
        files.set(weight, bytes);
      },
    },
  };
}

/** Um fetch falso: o CSS na URL da Fontshare e os bytes de mentira nas URLs da CDN. */
function fakeFetch(options: { css?: string; cssStatus?: number; hostile?: number } = {}) {
  return vi.fn(async (url: string | URL) => {
    const text = String(url);
    if (text === FONTSHARE_CSS_URL) {
      return new Response(options.css ?? fontshareCss(), {
        status: options.cssStatus ?? 200,
      });
    }
    for (const weight of FONT_WEIGHTS) {
      if (text === `https:${fixtureUrl(weight)}`) {
        const bytes =
          options.hostile === weight
            ? Uint8Array.from([9, 9, 9])
            : fakeFontBytes(weight);
        return new Response(bytes);
      }
    }
    return new Response("não achei", { status: 404 });
  });
}

const run = (
  fetchImpl: ReturnType<typeof fakeFetch>,
  io: ReturnType<typeof memoryIo>["io"],
) =>
  ensureSatoshi({
    fetchImpl: fetchImpl as unknown as typeof fetch,
    io,
    expected: EXPECTED,
    log: () => {},
  });

describe("ensureSatoshi", () => {
  it("sem nenhum arquivo: baixa os três, confere e grava", async () => {
    const disk = memoryIo();
    const fetchImpl = fakeFetch();

    const downloaded = await run(fetchImpl, disk.io);

    expect(downloaded).toEqual([500, 700, 900]);
    expect(disk.writes).toEqual([500, 700, 900]);
    expect(disk.files.get(700)).toEqual(fakeFontBytes(700));
    // 1 CSS + 3 woff2
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("com os três já certos: pula e não faz nenhuma requisição", async () => {
    const disk = memoryIo({
      500: fakeFontBytes(500),
      700: fakeFontBytes(700),
      900: fakeFontBytes(900),
    });
    const fetchImpl = fakeFetch();

    expect(await run(fetchImpl, disk.io)).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(disk.writes).toEqual([]);
  });

  it("arquivo corrompido ou de outro peso é baixado de novo; os certos ficam", async () => {
    const disk = memoryIo({
      500: Uint8Array.from([0, 0, 0]),
      700: fakeFontBytes(700),
      900: fakeFontBytes(900),
    });
    const fetchImpl = fakeFetch();

    expect(await run(fetchImpl, disk.io)).toEqual([500]);
    expect(disk.writes).toEqual([500]);
    expect(disk.files.get(500)).toEqual(fakeFontBytes(500));
    // 1 CSS + 1 woff2
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("hash diferente: lança com o hash recebido e NÃO grava nada, nem os pesos que bateram", async () => {
    const disk = memoryIo();
    await expect(run(fakeFetch({ hostile: 900 }), disk.io)).rejects.toThrow(
      /peso 900 veio com SHA-256 [0-9a-f]{64}/,
    );
    expect(disk.writes).toEqual([]);
    expect(disk.files.size).toBe(0);
  });

  it("a Fontshare responde erro no CSS: lança com o status", async () => {
    const disk = memoryIo();
    await expect(
      run(fakeFetch({ cssStatus: 503 }), disk.io),
    ).rejects.toThrow("respondeu 503");
    expect(disk.writes).toEqual([]);
  });

  it("sem rede (fetch lança): lança dizendo que não houve resposta", async () => {
    const disk = memoryIo();
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(
      ensureSatoshi({
        fetchImpl: offline as unknown as typeof fetch,
        io: disk.io,
        expected: EXPECTED,
        log: () => {},
      }),
    ).rejects.toThrow("sem resposta de");
    expect(disk.writes).toEqual([]);
  });

  it("o CSS não traz um dos pesos: lança e não grava", async () => {
    const disk = memoryIo();
    await expect(
      run(fakeFetch({ css: fontshareCss([500, 700]) }), disk.io),
    ).rejects.toThrow("não devolveu o peso 900");
    expect(disk.writes).toEqual([]);
  });

  it("um woff2 responde 404: lança e não grava", async () => {
    const disk = memoryIo();
    const css = fontshareCss().replace(fixtureUrl(700), "//cdn.fontshare.com/wf/Z/Z/Z.woff2");
    await expect(run(fakeFetch({ css }), disk.io)).rejects.toThrow("respondeu 404");
    expect(disk.writes).toEqual([]);
  });
});
```

Crie `test/fontsConfig.test.ts` (guarda de configuração; ainda falha de propósito até o Step 7):

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A Satoshi só funciona se o script rodar antes do dev e do build, o arquivo nunca entrar no git
// (licença ITF FFL: repositório público é proibido) e o CI guardar a pasta em cache.

const read = (path: string) => readFileSync(path, "utf8").replaceAll("\r\n", "\n");

describe("configuração da Satoshi", () => {
  const scripts = JSON.parse(read("package.json")).scripts as Record<string, string>;

  it("package.json: `fonts` baixa e `predev`/`prebuild` o chamam", () => {
    expect(scripts.fonts).toBe("bun scripts/fetchFonts.mjs");
    expect(scripts.predev).toBe("bun run fonts");
    expect(scripts.prebuild).toBe("bun run fonts");
  });

  it(".gitignore: a pasta da fonte fica fora do git", () => {
    expect(read(".gitignore").split("\n")).toContain("/src/fonts/satoshi/");
  });

  it("ci.yml: o job do E2E guarda src/fonts/satoshi, com a chave pelo hash do script, antes do E2E", () => {
    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("path: src/fonts/satoshi");
    expect(ci).toContain("key: satoshi-${{ hashFiles('scripts/fontsCheck.mjs') }}");
    expect(ci.indexOf("src/fonts/satoshi")).toBeLessThan(ci.indexOf("bun run test:e2e"));
  });

  it("layout.tsx: next/font/local com os 3 pesos, a variável --font-satoshi e swap", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain('from "next/font/local"');
    for (const weight of [500, 700, 900]) {
      expect(layout).toContain(`../fonts/satoshi/Satoshi-${weight}.woff2`);
      expect(layout).toContain(`weight: "${weight}"`);
    }
    expect(layout).toContain('variable: "--font-satoshi"');
    expect(layout).toContain('display: "swap"');
    expect(layout).toContain("${satoshi.variable}");
  });

  it("globals.css: font-heading aponta para a Satoshi", () => {
    expect(read("src/app/globals.css")).toMatch(
      /--font-heading:\s*var\(--font-satoshi\)\s*;/,
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bunx vitest run test/fontsCheck.test.ts test/fetchFonts.test.ts test/fontsConfig.test.ts`
Expected: **FAIL**: `fontsCheck.test.ts` e `fetchFonts.test.ts` com `Failed to load url ../scripts/fontsCheck.mjs`
(o módulo ainda não existe) e `fontsConfig.test.ts` com `expected undefined to be 'bun scripts/fetchFonts.mjs'`.

- [ ] **Step 3: Implementar `scripts/fontsCheck.mjs` (módulo puro)**

Crie `scripts/fontsCheck.mjs` com a ferramenta Write:

```js
// Regras puras da fonte Satoshi (scripts/fetchFonts.mjs). Nada aqui faz I/O de rede nem de disco: o CLI
// baixa e grava, e passa para estas funções o CSS, o peso e os bytes.
//
// A Satoshi (ITF Free Font License) pode ser servida pelo próprio site, mas os arquivos NÃO podem ir
// para o repositório (ele é público). Por isso o script baixa da Fontshare antes do dev e do build e
// confere o SHA-256 contra os valores fixados abaixo. Sem subset nem conversão: a licença proíbe.
// Ao mudar os hashes, confira a licença de novo (.context/library-docs.md, seção Satoshi).
import { createHash } from "node:crypto";

/** O CSS da Fontshare para os três pesos (cada bloco @font-face traz woff2, woff e ttf). */
export const FONTSHARE_CSS_URL =
  "https://api.fontshare.com/v2/css?f[]=satoshi@500,700,900&display=swap";

/** Os pesos da Satoshi que o app usa (500 texto de apoio, 700 rótulos, 900 títulos). */
export const SATOSHI_WEIGHTS = Object.freeze([500, 700, 900]);

/**
 * SHA-256 de cada woff2, conferidos em 2026-11-27 contra a CDN da Fontshare.
 * @type {Readonly<Record<500 | 700 | 900, string>>}
 */
export const SATOSHI_SHA256 = Object.freeze({
  500: "af02a72246f53ad49c44a591921edbd39ec8258a03d8cc2e0532aa1e497e85b4",
  700: "353a7fbfb4475f0c31470a7449226006cb64211c71055ca9db860a8acdaa9f68",
  900: "bd11b5820231420e78046c611aebdd628dc17ad67788258ffe3fe902253efd3b",
});

const CDN_HOST = "cdn.fontshare.com";

/**
 * Caminho do arquivo a partir da raiz do repositório, sempre com `/` (vale no Windows e no Linux:
 * o CLI o resolve com `new URL(..., import.meta.url)`).
 * @param {500 | 700 | 900} weight
 * @returns {string}
 */
export function satoshiPath(weight) {
  if (!(weight in SATOSHI_SHA256)) {
    throw new Error(`Peso da Satoshi não suportado: ${weight}`);
  }
  return `src/fonts/satoshi/Satoshi-${weight}.woff2`;
}

/**
 * @param {Uint8Array} bytes
 * @returns {string} o SHA-256 em hexadecimal minúsculo
 */
export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Os bytes são o arquivo oficial desse peso?
 * @param {500 | 700 | 900} weight
 * @param {Uint8Array} bytes
 * @param {Readonly<Record<500 | 700 | 900, string>>} [expected] os hashes (o padrão são os fixados acima)
 * @returns {boolean}
 */
export function isSatoshiFileValid(weight, bytes, expected = SATOSHI_SHA256) {
  return sha256Hex(bytes) === expected[weight];
}

/** `//cdn.fontshare.com/...` vira `https://...`; só a CDN da Fontshare passa. */
function toHttps(url) {
  const absolute = url.startsWith("//") ? `https:${url}` : url;
  let parsed;
  try {
    parsed = new URL(absolute);
  } catch {
    throw new Error(`URL de fonte inesperada: ${url}`);
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== CDN_HOST) {
    throw new Error(`URL de fonte inesperada: ${url}`);
  }
  return absolute;
}

const FONT_FACE = /@font-face\s*\{([^}]*)\}/g;
const FONT_WEIGHT = /font-weight:\s*(\d+)/;
const WOFF2_URL = /url\(\s*['"]?([^'")\s]+)['"]?\s*\)\s*format\(\s*['"]woff2['"]\s*\)/;

/**
 * Lê o CSS da Fontshare e devolve peso → URL `https:` do woff2.
 * @param {string} css
 * @returns {Map<number, string>}
 */
export function parseFontshareCss(css) {
  /** @type {Map<number, string>} */
  const urls = new Map();
  let blocks = 0;
  for (const block of css.matchAll(FONT_FACE)) {
    blocks += 1;
    const body = block[1] ?? "";
    const weight = FONT_WEIGHT.exec(body)?.[1];
    if (!weight) continue;
    const woff2 = WOFF2_URL.exec(body)?.[1];
    if (!woff2) throw new Error(`sem woff2 no peso ${weight}`);
    urls.set(Number(weight), toHttps(woff2));
  }
  if (blocks === 0) {
    throw new Error("nenhum @font-face na resposta da Fontshare");
  }
  return urls;
}
```

- [ ] **Step 4: Implementar `scripts/fetchFonts.mjs` (CLI e `ensureSatoshi`)**

Crie `scripts/fetchFonts.mjs` com a ferramenta Write:

```js
// Baixa a fonte Satoshi (Fontshare) para src/fonts/satoshi/, pasta FORA do git (licença ITF FFL: o
// arquivo não pode ficar num repositório público). Roda sozinho no `predev` e no `prebuild`
// (`bun run fonts`). Pula o download quando os 3 arquivos já estão lá com o SHA-256 certo; baixa o que
// faltar, confere o hash e só então grava (nada é gravado se algum peso reprovar). Qualquer erro sai
// com código 1 e uma mensagem que diz o que fazer. Só built-ins do Node/Bun: Windows e Linux (CI, Vercel).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FONTSHARE_CSS_URL,
  isSatoshiFileValid,
  parseFontshareCss,
  SATOSHI_SHA256,
  SATOSHI_WEIGHTS,
  satoshiPath,
  sha256Hex,
} from "./fontsCheck.mjs";

const TIMEOUT_MS = 30_000;

/** O arquivo no disco, resolvido a partir deste script (sem depender do diretório de onde roda). */
function fileOf(weight) {
  return fileURLToPath(new URL(`../${satoshiPath(weight)}`, import.meta.url));
}

function isMissingFile(error) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function describeError(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @typedef {{
 *   read(weight: number): Promise<Uint8Array | null>,
 *   write(weight: number, bytes: Uint8Array): Promise<void>,
 * }} FontIo
 */

/** @type {FontIo} */
export const diskIo = {
  async read(weight) {
    try {
      return await readFile(fileOf(weight));
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw error;
    }
  },
  async write(weight, bytes) {
    const file = fileOf(weight);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, bytes);
  },
};

async function request(fetchImpl, url) {
  let response;
  try {
    response = await fetchImpl(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "closery-fonts" },
    });
  } catch (error) {
    throw new Error(`sem resposta de ${url} (${describeError(error)})`);
  }
  if (!response.ok) {
    throw new Error(`${url} respondeu ${response.status}`);
  }
  return response;
}

/**
 * Garante os 3 arquivos da Satoshi. Devolve os pesos que foram baixados (vazio = já estava tudo certo).
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   io?: FontIo,
 *   expected?: Readonly<Record<500 | 700 | 900, string>>,
 *   log?: (line: string) => void,
 * }} [options]
 * @returns {Promise<number[]>}
 */
export async function ensureSatoshi({
  fetchImpl = fetch,
  io = diskIo,
  expected = SATOSHI_SHA256,
  log = console.log,
} = {}) {
  /** @type {number[]} */
  const stale = [];
  for (const weight of SATOSHI_WEIGHTS) {
    const bytes = await io.read(weight);
    if (bytes === null || !isSatoshiFileValid(weight, bytes, expected)) {
      stale.push(weight);
    }
  }
  if (stale.length === 0) {
    log("Satoshi: os 3 arquivos já estão em src/fonts/satoshi, com o SHA-256 certo.");
    return [];
  }

  log(`Satoshi: baixando o peso ${stale.join(", ")} da Fontshare...`);
  const css = await (await request(fetchImpl, FONTSHARE_CSS_URL)).text();
  const urls = parseFontshareCss(css);

  /** @type {[number, Uint8Array][]} */
  const verified = [];
  for (const weight of stale) {
    const url = urls.get(weight);
    if (!url) throw new Error(`a Fontshare não devolveu o peso ${weight}`);
    const response = await request(fetchImpl, url);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!isSatoshiFileValid(weight, bytes, expected)) {
      throw new Error(
        `o arquivo do peso ${weight} veio com SHA-256 ${sha256Hex(bytes)} e o esperado é ${expected[weight]}. A Fontshare pode ter trocado o arquivo`,
      );
    }
    verified.push([weight, bytes]);
  }

  // Só grava depois de conferir os três: nunca fica meia fonte no disco.
  for (const [weight, bytes] of verified) {
    await io.write(weight, bytes);
  }
  log(`Satoshi: ${verified.length} arquivo(s) gravado(s) em src/fonts/satoshi.`);
  return stale;
}

async function main() {
  try {
    await ensureSatoshi();
  } catch (error) {
    console.error(`Não consegui preparar a fonte Satoshi: ${describeError(error)}.`);
    console.error(
      "O que fazer: confira a conexão e rode `bun run fonts` de novo (sem a fonte, `bun run dev` e `bun run build` não funcionam). " +
        "Se o erro for de SHA-256, NÃO aceite o arquivo: veja a seção Satoshi de .context/library-docs.md antes de mexer em scripts/fontsCheck.mjs.",
    );
    process.exitCode = 1;
  }
}

// Só roda como script (`bun scripts/fetchFonts.mjs`); importado pelo teste, não faz nada.
if (import.meta.main) await main();
```

- [ ] **Step 5: Rodar os testes puros e ver passar**

Run: `bunx biome check --write scripts/fontsCheck.mjs scripts/fetchFonts.mjs test/fontsFixtures.ts test/fontsCheck.test.ts test/fetchFonts.test.ts test/fontsConfig.test.ts`
Expected: `Checked 6 files`.

Run: `bunx vitest run test/fontsCheck.test.ts test/fetchFonts.test.ts`
Expected: **PASS** (`Test Files  2 passed`). `test/fontsConfig.test.ts` ainda falha, de propósito (Step 7).

- [ ] **Step 6: Rodar o script de verdade (rede real, uma vez) e conferir os dois caminhos**

Run: `bun scripts/fetchFonts.mjs`
Expected (primeira vez, com rede): `Satoshi: baixando o peso 500, 700, 900 da Fontshare...` e
`Satoshi: 3 arquivo(s) gravado(s) em src/fonts/satoshi.`; código de saída 0.

Run: `bun scripts/fetchFonts.mjs`
Expected (segunda vez): `Satoshi: os 3 arquivos já estão em src/fonts/satoshi, com o SHA-256 certo.` e nenhuma requisição.

Run (auto-cura de arquivo corrompido, Git Bash): `printf 'x' >> src/fonts/satoshi/Satoshi-500.woff2 && bun scripts/fetchFonts.mjs`
Expected: `Satoshi: baixando o peso 500 da Fontshare...` (só o 500 é refeito).

Run: `git status --short src/fonts` (ainda **antes** do `.gitignore`)
Expected: `?? src/fonts/` (prova que o `.gitignore` do Step 7 é necessário).

- [ ] **Step 7: Ganchos, `.gitignore`, layout, `font-heading` e CI**

Edite `package.json`:

```json
// old_string
    "dev": "next dev",
    "build": "next build",
// new_string
    "fonts": "bun scripts/fetchFonts.mjs",
    "predev": "bun run fonts",
    "dev": "next dev",
    "prebuild": "bun run fonts",
    "build": "next build",
```

Edite `.gitignore`:

```
// old_string
# artefatos do Playwright MCP
.playwright-mcp/
// new_string
# Satoshi (ITF FFL): o arquivo não pode ficar num repositório público; `bun run fonts` baixa
/src/fonts/satoshi/

# artefatos do Playwright MCP
.playwright-mcp/
```

Edite `src/app/layout.tsx` em três pontos:

```tsx
// old_string
import { Geist, Geist_Mono } from "next/font/google";
// new_string
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
```

```tsx
// old_string
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
// new_string
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Satoshi (display, títulos e rótulos). Os arquivos vêm de `bun run fonts` (src/fonts/satoshi, fora do
// git por causa da licença). Os caminhos têm de ser literais: o next/font os resolve na compilação.
const satoshi = localFont({
  src: [
    {
      path: "../fonts/satoshi/Satoshi-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../fonts/satoshi/Satoshi-700.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../fonts/satoshi/Satoshi-900.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-satoshi",
  display: "swap",
  fallback: ["Geist", "system-ui", "sans-serif"],
});
```

```tsx
// old_string
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
// new_string
      className={`${geistSans.variable} ${geistMono.variable} ${satoshi.variable} h-full antialiased`}
```

Edite `src/app/globals.css`:

```css
/* old_string */
  --font-heading: var(--font-sans);
/* new_string */
  --font-heading: var(--font-satoshi);
```

Edite `.github/workflows/ci.yml` (job `e2e`, antes do passo do E2E):

```yaml
# old_string
      # Sobe PGlite (pglite-socket) + next build + next start com o env do
# new_string
      # A Satoshi vem da Fontshare (a licença proíbe versionar o arquivo): o `prebuild` baixa e confere
      # o SHA-256; com o cache ele só confere. A chave muda quando os hashes (scripts/fontsCheck.mjs) mudam.
      - name: Cache da fonte Satoshi
        uses: actions/cache@v6
        with:
          path: src/fonts/satoshi
          key: satoshi-${{ hashFiles('scripts/fontsCheck.mjs') }}

      # Sobe PGlite (pglite-socket) + next build + next start com o env do
```

- [ ] **Step 8: Documentação (AGENTS.md e library-docs)**

Edite `AGENTS.md` (tabela de comandos):

```
// old_string
| `bun run build` | build de produção (exige `BETTER_AUTH_URL` e `BETTER_AUTH_SECRET` no `.env.local`) |
// new_string
| `bun run build` | build de produção (exige `BETTER_AUTH_URL` e `BETTER_AUTH_SECRET` no `.env.local`) |
| `bun run fonts` | baixa a Satoshi (Fontshare) para `src/fonts/satoshi/`, pasta fora do git (licença), e confere o SHA-256; pula se já está certa; roda sozinho no `predev` e no `prebuild`; código de saída 1 sem rede ou com hash diferente |
```

Edite `.context/library-docs.md` (insere a seção antes de "Como adicionar uma biblioteca nova"):

```
// old_string
## Como adicionar uma biblioteca nova
// new_string
## 17. Satoshi (fonte de display) · visual novo

- **Licença (ITF Free Font License, §01 e §02):** servir a fonte no próprio site é permitido; **disponibilizar os arquivos
  num repositório publicamente acessível é proibido** (o repositório é público). Por isso o `.woff2` **nunca** entra no git
  (`/src/fonts/satoshi/` no `.gitignore`). Também é proibido **subset e conversão**: o script grava os bytes como vieram.
- **Como chega ao app:** `bun run fonts` (`scripts/fetchFonts.mjs`) lê o CSS de
  `https://api.fontshare.com/v2/css?f[]=satoshi@500,700,900&display=swap`, pega a URL do `woff2` de cada peso (só
  `cdn.fontshare.com`), baixa, **confere o SHA-256** contra `SATOSHI_SHA256` em `scripts/fontsCheck.mjs`, e só então grava
  `src/fonts/satoshi/Satoshi-{500,700,900}.woff2`. Pula o download quando os 3 arquivos já estão lá com o hash certo.
  Hash diferente ou sem rede: código 1 e uma mensagem que diz o que fazer. As regras puras são testadas em
  `test/fontsCheck.test.ts` e a orquestração (com `fetch` e disco falsos) em `test/fetchFonts.test.ts`.
- **Ganchos:** `predev` e `prebuild` chamam `bun run fonts` (o Bun roda os scripts `pre*`, conferido em 2026-11-27). Na Vercel o
  `bun run build` roda o `prebuild`. No CI o job do E2E guarda `src/fonts/satoshi` em cache (`satoshi-<hash de scripts/fontsCheck.mjs>`),
  porque o E2E faz `bun run build`; o job `checks` não precisa da fonte (nenhum teste importa o `RootLayout`).
- **Mudou o hash?** Não aceite no automático. A Fontshare pode ter trocado o arquivo: confira a licença da versão nova, baixe,
  calcule o SHA-256 (`sha256sum`) e atualize `SATOSHI_SHA256` num commit só dele (a chave do cache do CI muda junto).
- **`next/font/local`:** `localFont` em `src/app/layout.tsx` com os 3 pesos (`src` em array, `path` **literal** e relativo ao
  `layout.tsx`), `variable: "--font-satoshi"`, `display: "swap"`, `fallback: ["Geist", "system-ui", "sans-serif"]`. O Next gera o
  ajuste de fallback (Arial) sozinho (`adjustFontFallback`). `globals.css`: `--font-heading: var(--font-satoshi)`; o utilitário é `font-heading`.
- **Glifos:** `ª` e `º` **não existem** na Satoshi e caem na próxima fonte da pilha (Geist). Nada a fazer; só não conte com eles no display.

## Como adicionar uma biblioteca nova
```

- [ ] **Step 9: Tipos, lint e os testes da tarefa**

Run: `bunx biome check --write src/app/layout.tsx src/app/globals.css package.json .github/workflows/ci.yml`
Expected: `Checked 4 files` (o Biome pode reformatar o `layout.tsx`).

Run: `bun run check-types`
Expected: código 0. (O `layout.tsx` com `next/font/local` não resolve o `woff2` no `tsc`; só o build resolve.)

Run: `bun run lint`
Expected: código 0.

Run: `bunx vitest run test/fontsCheck.test.ts test/fetchFonts.test.ts test/fontsConfig.test.ts test/vercelConfig.test.ts src/app/themeContrast.test.ts`
Expected: `Test Files  5 passed`. (`vercelConfig.test.ts` amarra o `package.json`: confirma que os scripts novos não quebraram a regra do `buildCommand`.)

Run (verificação manual, se a máquina aguentar; encerre com Ctrl+C): `bun run dev -- --port 3290` e, em outro terminal, `curl -s http://localhost:3290/entrar | grep -o "__variable_[a-z0-9]*" | sort -u`
Expected: o `predev` imprime `Satoshi: os 3 arquivos já estão ...` e o HTML contém três classes `__variable_...` (Geist, Geist Mono e Satoshi). A comparação pixel a pixel é das Tasks 15–17.

- [ ] **Step 10: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/visual/msg-task-2.txt`:

```
feat(fonts): Satoshi baixada no build e servida pelo próprio app

scripts/fetchFonts.mjs baixa a Satoshi da Fontshare para src/fonts/satoshi
(fora do git, pela licença ITF FFL), confere o SHA-256 e pula quando já está
certa; predev e prebuild o chamam. O layout carrega os 3 pesos com
next/font/local em --font-satoshi e o font-heading passa a ser Satoshi. O CI
guarda a pasta em cache no job do E2E. Regras puras e a orquestração têm
teste; AGENTS.md e library-docs.md documentam o comando e a licença.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Run: `git add scripts/fontsCheck.mjs scripts/fetchFonts.mjs test/fontsFixtures.ts test/fontsCheck.test.ts test/fetchFonts.test.ts test/fontsConfig.test.ts package.json .gitignore src/app/layout.tsx src/app/globals.css .github/workflows/ci.yml AGENTS.md .context/library-docs.md && git commit -F .git/sdd/visual/msg-task-2.txt`
Expected: commit criado; `git status --short` **não** lista `src/fonts/` (está no `.gitignore`).

---

### Task 3: Tema (`ThemeProvider` e `ThemeSwitch`)

**Files:**
- Create: `src/components/app-shell/ThemeProvider.tsx`
- Create: `src/components/app-shell/ThemeProvider.test.tsx`
- Create: `src/components/app-shell/ThemeSwitch.tsx`
- Create: `src/components/app-shell/ThemeSwitch.test.tsx`
- Modify: `src/app/layout.tsx` (`suppressHydrationWarning` no `<html>` e `<ThemeProvider>` em volta do conteúdo)
- Modify: `.context/ui-registry.md` (entradas `ThemeProvider` e `ThemeSwitch`; `Histórico` datado do `Sonner`)
- Modify: `.context/library-docs.md` (seção 18, `next-themes`)
- Test: `src/components/app-shell/ThemeProvider.test.tsx`, `src/components/app-shell/ThemeSwitch.test.tsx`

**Interfaces:**
- Consumes: de Task 1, os tokens `bg-card`, `bg-primary`, `text-primary-foreground` e o `dark:` (o `@custom-variant dark` do
  `globals.css`); de Task 2, o `layout.tsx` já com `satoshi.variable` (as edições abaixo não mexem nessa linha).
  `Tooltip`, `TooltipTrigger`, `TooltipContent` de `src/components/ui/tooltip.tsx` (já existem; o `TooltipProvider` está no layout).
- Produces:
  - `export function ThemeProvider({ children }: { children: React.ReactNode })` em `src/components/app-shell/ThemeProvider.tsx`.
  - `export function ThemeSwitch()` em `src/components/app-shell/ThemeSwitch.tsx` (Task 9 o põe no `AppHeader`).
  - `storageKey` do tema: `"closery-tema"` (a Task 14, o E2E de tema, lê `localStorage["closery-tema"]`).

Testes existentes que mencionam o que a tarefa toca (`grep -rl "next-themes\|useTheme\|Toaster\|RootLayout" src test e2e`):
só `src/components/ui/sonner.tsx` usa `useTheme` e **nenhum teste** o cobre ou importa o layout. Nada existente precisa mudar.

- [ ] **Step 1: Escrever os testes que falham**

Crie `src/components/app-shell/ThemeProvider.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTheme } from "next-themes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/components/app-shell/ThemeProvider";

// O `<script>` anti-flash do next-themes, renderizado no cliente (o React 19 avisa no console; no app real
// ele vem do HTML do servidor). O aviso não é falha, só ruído.
vi.spyOn(console, "error").mockImplementation(() => {});

function Probe() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <output aria-label="tema">{theme}</output>
      <output aria-label="resolvido">{resolvedTheme}</output>
      <button type="button" onClick={() => setTheme("light")}>
        claro
      </button>
    </div>
  );
}

function setup() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

function prefersDark(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: matches && query.includes("dark"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
  prefersDark(false);
});

afterEach(() => {
  prefersDark(false);
});

describe("ThemeProvider", () => {
  it("renderiza os filhos", () => {
    setup();
    expect(screen.getByRole("button", { name: "claro" })).toBeInTheDocument();
  });

  it("o escuro é o padrão: sem escolha guardada, o <html> recebe a classe dark", () => {
    setup();
    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByLabelText("tema")).toHaveTextContent("dark");
    expect(localStorage.getItem("closery-tema")).toBeNull();
  });

  it("a escolha guardada em closery-tema vale: light troca a classe", () => {
    localStorage.setItem("closery-tema", "light");
    setup();
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("não segue o sistema: com o sistema em claro ou em escuro, sem escolha, continua dark", () => {
    prefersDark(false);
    const first = setup();
    expect(document.documentElement).toHaveClass("dark");
    first.unmount();

    document.documentElement.className = "";
    prefersDark(true);
    setup();
    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByLabelText("resolvido")).toHaveTextContent("dark");
  });

  it("setTheme grava no armazenamento do navegador, na chave closery-tema", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "claro" }));
    expect(localStorage.getItem("closery-tema")).toBe("light");
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("o script anti-flash usa a chave e o atributo de classe", () => {
    setup();
    const script = document.querySelector("script");
    expect(script?.innerHTML).toContain("closery-tema");
    expect(script?.innerHTML).toContain('"class"');
  });
});
```

Crie `src/components/app-shell/ThemeSwitch.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/components/app-shell/ThemeProvider";
import { ThemeSwitch } from "@/components/app-shell/ThemeSwitch";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.spyOn(console, "error").mockImplementation(() => {});

function tree() {
  return (
    <TooltipProvider>
      <ThemeProvider>
        <ThemeSwitch />
      </ThemeProvider>
    </TooltipProvider>
  );
}

const getSwitch = () => screen.getByRole("switch", { name: "Tema escuro" });

function hover(element: HTMLElement) {
  fireEvent.pointerEnter(element, { pointerType: "mouse" });
  fireEvent.mouseEnter(element);
  fireEvent.pointerMove(element, { pointerType: "mouse" });
  fireEvent.mouseMove(element);
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
});

describe("ThemeSwitch", () => {
  it("é um switch chamado 'Tema escuro', ligado no escuro (o padrão)", () => {
    render(tree());
    expect(getSwitch()).toHaveAttribute("aria-checked", "true");
    expect(getSwitch()).toHaveAttribute("type", "button");
  });

  it("começa desligado quando a escolha guardada é o claro", () => {
    localStorage.setItem("closery-tema", "light");
    render(tree());
    expect(getSwitch()).toHaveAttribute("aria-checked", "false");
  });

  it("clicar troca para o claro e de volta, e a escolha sobrevive no armazenamento", async () => {
    render(tree());

    await userEvent.click(getSwitch());
    expect(getSwitch()).toHaveAttribute("aria-checked", "false");
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("closery-tema")).toBe("light");

    await userEvent.click(getSwitch());
    expect(getSwitch()).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("closery-tema")).toBe("dark");
  });

  it("funciona pelo teclado: Tab foca, Espaço e Enter trocam", async () => {
    render(tree());
    await userEvent.tab();
    expect(getSwitch()).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(getSwitch()).toHaveAttribute("aria-checked", "false");
    await userEvent.keyboard("{Enter}");
    expect(getSwitch()).toHaveAttribute("aria-checked", "true");
  });

  it("o tooltip diz o que o clique faz: no escuro, 'Mudar para o tema claro'", async () => {
    render(tree());
    hover(getSwitch());
    expect(
      await screen.findByText("Mudar para o tema claro"),
    ).toBeInTheDocument();
  });

  it("o tooltip no claro é 'Mudar para o tema escuro'", async () => {
    localStorage.setItem("closery-tema", "light");
    render(tree());
    hover(getSwitch());
    expect(
      await screen.findByText("Mudar para o tema escuro"),
    ).toBeInTheDocument();
  });

  it("os ícones são decorativos (o nome vem do aria-label)", () => {
    render(tree());
    const icons = getSwitch().querySelectorAll("svg");
    expect(icons.length).toBe(2);
    for (const icon of icons) expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("sem ThemeProvider (limite): renderiza no escuro e o clique não lança", async () => {
    render(
      <TooltipProvider>
        <ThemeSwitch />
      </TooltipProvider>,
    );
    expect(getSwitch()).toHaveAttribute("aria-checked", "true");
    await userEvent.click(getSwitch());
    expect(getSwitch()).toBeInTheDocument();
  });

  it("hidratação: o HTML do servidor é sempre o escuro, mesmo com o claro guardado", () => {
    localStorage.setItem("closery-tema", "light");
    const html = renderToString(tree());
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('role="switch"');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bunx vitest run src/components/app-shell/ThemeProvider.test.tsx src/components/app-shell/ThemeSwitch.test.tsx`
Expected: **FAIL** com `Failed to resolve import "@/components/app-shell/ThemeProvider"` (e `.../ThemeSwitch`).

- [ ] **Step 3: Implementar o `ThemeProvider`**

Crie `src/components/app-shell/ThemeProvider.tsx`:

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// O escuro é o padrão e o tema NÃO segue o sistema (C-V4): a escolha fica só no navegador, na chave
// `closery-tema`. A classe `dark` vai no <html> (o `@custom-variant dark` do globals.css). Em componente
// próprio para ser testável sem o RootLayout, que carrega as fontes (spec §4.3).
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      storageKey="closery-tema"
    >
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 4: Implementar o `ThemeSwitch`**

Crie `src/components/app-shell/ThemeSwitch.tsx`:

```tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const subscribe = () => () => {};

// `false` no servidor e na hidratação, `true` depois de montar: o estado lido do navegador (localStorage)
// só vale depois disso, senão o HTML do servidor e o do cliente divergem.
function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

// Switch estilo Apple (spec §4.2): trilho 76x44 em `card`, knob de 36px em `primary` com ícone de 16px.
// No escuro o knob fica à direita com a Lua; no claro, à esquerda com o Sol. A posição e o ícone vêm do
// CSS (`dark:`), que o script do next-themes decide ANTES da primeira pintura: quem usa o claro não vê
// o knob deslizar a cada carga. Só o `aria-checked` e o rótulo do tooltip esperam o estado do navegador
// (até lá, "escuro", igual ao HTML do servidor).
export function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = !mounted || resolvedTheme !== "light";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            aria-label="Tema escuro"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="relative h-11 w-19 shrink-0 rounded-full bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <span
          aria-hidden="true"
          className="absolute top-1 left-1 grid size-9 place-items-center rounded-full bg-primary text-primary-foreground transition-[left] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none dark:left-9"
        >
          <Moon
            aria-hidden="true"
            strokeWidth={2.2}
            className="hidden size-4 dark:block"
          />
          <Sun
            aria-hidden="true"
            strokeWidth={2.2}
            className="size-4 dark:hidden"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {isDark ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
      </TooltipContent>
    </Tooltip>
  );
}
```

- [ ] **Step 5: Ligar o provider no `RootLayout`**

Edite `src/app/layout.tsx` (as edições da Task 2 ficam como estão):

```tsx
// old_string
import { Toaster } from "@/components/ui/sonner";
// new_string
import { ThemeProvider } from "@/components/app-shell/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
```

```tsx
// old_string
      lang="pt-BR"
// new_string
      lang="pt-BR"
      suppressHydrationWarning
```

```tsx
// old_string
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
// new_string
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </ThemeProvider>
```

(O `suppressHydrationWarning` é do próprio `<html>`: o script do next-themes põe a classe `dark` antes da
hidratação. O `Toaster` fica **dentro** do provider para o `sonner.tsx` ler o tema do app, não "system".
A CSP do projeto é só `frame-ancestors 'none'`, então o `<script>` inline do next-themes não é bloqueado.)

- [ ] **Step 6: Rodar e ver passar**

Run: `bunx biome check --write src/components/app-shell/ThemeProvider.tsx src/components/app-shell/ThemeProvider.test.tsx src/components/app-shell/ThemeSwitch.tsx src/components/app-shell/ThemeSwitch.test.tsx src/app/layout.tsx`
Expected: `Checked 5 files`.

Run: `bunx vitest run src/components/app-shell/ThemeProvider.test.tsx src/components/app-shell/ThemeSwitch.test.tsx test/fontsConfig.test.ts src/app/rawColors.test.ts`
Expected: `Test Files  4 passed`. (`fontsConfig` confirma que o `layout.tsx` ainda tem a Satoshi; `rawColors` varre os dois `.tsx` novos: sem cor crua.)

- [ ] **Step 7: Documentação (`ui-registry.md` e `library-docs.md`)**

Edite `.context/ui-registry.md` (as duas entradas novas, antes de `### Greeting`):

```
// old_string
### Greeting
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/Greeting.tsx`
// new_string
### ThemeProvider
- **Status:** ✅ pronto (2026-11-27)
- **Local:** `src/components/app-shell/ThemeProvider.tsx`
- **Propósito:** liga o tema claro/escuro do app inteiro; o escuro é o padrão.
- **Como funciona:** `"use client"`; envolve o `ThemeProvider` do `next-themes` com `attribute="class"`, `defaultTheme="dark"`,
  `enableSystem={false}` (não segue o sistema), `disableTransitionOnChange` e `storageKey="closery-tema"`. Fica no `RootLayout`,
  em volta do `TooltipProvider` e do `Toaster` (o `sonner.tsx` lê o tema daqui). O `<html>` leva `suppressHydrationWarning`.
- **Usa:** `next-themes`; tokens claro/escuro do `globals.css`.
- **Histórico:** 2026-11-27 — criado no visual novo (Tarefa 3).

### ThemeSwitch
- **Status:** ✅ pronto (2026-11-27)
- **Local:** `src/components/app-shell/ThemeSwitch.tsx`
- **Propósito:** switch estilo Apple que alterna entre o tema escuro e o claro (vai no cabeçalho).
- **Como funciona:** `"use client"`; `<button role="switch" aria-checked aria-label="Tema escuro">` em `TooltipTrigger render`, com
  tooltip "Mudar para o tema claro" / "Mudar para o tema escuro". Trilho 76x44 em `card`, knob de 36px em `primary` com `Moon` (escuro,
  à direita) ou `Sun` (claro, à esquerda); a posição e o ícone saem do CSS (`dark:`), que o script do `next-themes` resolve antes da
  pintura (sem piscar), e `transition: left .3s cubic-bezier(.2,.8,.2,1)` (desligada em `motion-reduce`). O `aria-checked` e o texto
  do tooltip esperam montar no cliente (`useSyncExternalStore`) e antes disso mostram o escuro, igual ao HTML do servidor. Testado
  com `renderToString` (hidratação), teclado e tooltip com `fireEvent` como o `MenuToggle`.
- **Usa:** `ThemeProvider`, `Tooltip*`; tokens `card`, `primary`, `primary-foreground`, `ring`.
- **Histórico:** 2026-11-27 — criado no visual novo (Tarefa 3).

### Greeting
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/Greeting.tsx`
```

Edite `.context/ui-registry.md` (histórico do `Sonner`):

```
// old_string
- **Histórico:** 2026-11-20 — `shadcn add` (traz `sonner` e `next-themes`).
// new_string
- **Histórico:** 2026-11-20 — `shadcn add` (traz `sonner` e `next-themes`). 2026-11-27 — visual novo (Tarefa 3): agora existe `ThemeProvider` no layout raiz e o toast segue o tema do app (escuro padrão), não mais "system".
```

Edite `.context/library-docs.md` (insere a seção antes de "Como adicionar uma biblioteca nova", depois da seção 17):

```
// old_string
## Como adicionar uma biblioteca nova
// new_string
## 18. next-themes 0.4.6 · visual novo

- **Já estava instalado** (veio com o `sonner` do shadcn). O `ThemeProvider` do app é o `src/components/app-shell/ThemeProvider.tsx`
  (componente próprio, `"use client"`): `attribute="class"`, `defaultTheme="dark"`, `enableSystem={false}`,
  `disableTransitionOnChange`, `storageKey="closery-tema"`. **Escuro padrão e sem seguir o sistema** (C-V4); a escolha fica no
  navegador, nunca no banco.
- **`<html suppressHydrationWarning>`** no `RootLayout`: o script do provider põe a classe `dark` ou `light` antes da hidratação.
  O `@custom-variant dark (&:is(.dark *))` do `globals.css` continua. A CSP do projeto é só `frame-ancestors 'none'`, então o
  `<script>` inline não é bloqueado (se um dia houver `script-src`, passe `nonce` ao provider).
- **O que ler do tema:** `useTheme()` devolve `theme`, `resolvedTheme` e `setTheme`. Com `enableSystem` desligado os dois primeiros
  são iguais. Sem `ThemeProvider` o hook devolve `setTheme` vazio e `resolvedTheme` indefinido (não lança).
- **Não leia o tema no render sem esperar montar:** no servidor não existe `localStorage`. O visual que depende do tema usa as
  variantes `dark:` do Tailwind (o script decide a classe antes da pintura); só o que precisa do valor em JS (`aria-checked`,
  texto de tooltip) espera `useSyncExternalStore(subscribe, () => true, () => false)`, como o `ThemeSwitch`.
- **Teste:** o `<script>` do provider, renderizado no cliente, faz o React 19 avisar no console (ruído, não falha): os testes
  silenciam `console.error`. jsdom não tem `matchMedia`; o `test/setup-dom.ts` já fornece um (o provider chama no efeito).
  Limpe `localStorage` e `document.documentElement.className` em `beforeEach`.

## Como adicionar uma biblioteca nova
```

- [ ] **Step 8: Tipos, lint e os testes da tarefa**

Run: `bun run check-types`
Expected: código 0.

Run: `bun run lint`
Expected: código 0.

Run: `bunx vitest run src/components/app-shell/ThemeProvider.test.tsx src/components/app-shell/ThemeSwitch.test.tsx src/components/app-shell/MenuToggle.test.tsx src/components/ui/sidebar.test.tsx src/app/themeContrast.test.ts src/app/rawColors.test.ts test/uiRegistryDoc.test.ts`
Expected: `Test Files  7 passed`. (`MenuToggle` e `sidebar` rodam para provar que o `TooltipProvider` e o hook continuam intactos.)

- [ ] **Step 9: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/visual/msg-task-3.txt`:

```
feat(shell): tema escuro por padrão, com ThemeProvider e ThemeSwitch

ThemeProvider envolve o next-themes (classe dark no html, escuro padrão, sem
seguir o sistema, chave closery-tema) e entra no RootLayout em volta do
TooltipProvider e do Toaster. ThemeSwitch é o switch estilo Apple (role
switch, aria-checked, tooltip): posição e ícone saem do CSS dark: para não
piscar, e o aria-checked espera montar. Testes de provider, troca, teclado,
tooltip e hidratação; ui-registry e library-docs atualizados.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Run: `git add src/components/app-shell/ThemeProvider.tsx src/components/app-shell/ThemeProvider.test.tsx src/components/app-shell/ThemeSwitch.tsx src/components/app-shell/ThemeSwitch.test.tsx src/app/layout.tsx .context/ui-registry.md .context/library-docs.md && git commit -F .git/sdd/visual/msg-task-3.txt`
Expected: commit criado, 7 arquivos.

---

### Task 4: Variantes de Button, Badge e Card

> **Notas do redator (conferidas no código em 2026-11-27):**
>
> Premissas conferidas no código (2026-11-27):
>
> - Nenhum teste existente afirma classe de raio. `grep -rn "rounded-lg\|rounded-4xl\|rounded-xl\|rounded-full\|rounded-\[" src test e2e --include=*.test.ts --include=*.test.tsx --include=*.spec.ts` volta vazio. Os únicos testes que leem classe de `Button` são `src/components/ui/button.test.ts` (altura via `heightUnit`) e `touchTargets.test.tsx` (não usa `Button`). Os testes de badge (`StaleBadge`, `RequestStatusBadge`, `HandoverStatusBadge`, `InactiveBadge`) afirmam só classes de cor passadas por `className`, que continuam.
> - `button.test.ts` precisa mudar porque `SIZES` e os filtros `ALWAYS_TOUCH_SIZED`/`SCALING_SIZES` passam a conhecer os tamanhos novos (`pill` = 48px e `icon-pill` = 44px). Mostrado no Step 1 da Task 4.
> - `buttonVariants` é usado sem `twMerge` em `<Link className={buttonVariants(...)}>`. Por isso a Task 4 tira `text-sm font-medium` e todo raio da base e coloca o tamanho de texto em cada `size` (sem duas classes de `font-size` na mesma string, o que dependeria da ordem do CSS).
> - `test/uiRegistryDoc.test.ts` procura pelo nome do arquivo só em `admin`, `passagens`, `solicitacoes`, `kokonutui`, `dashboard`, `privacy` e nos primitivos `toggle`, `toggle-group`, `native-select`, `dialog`, `table`, `chart`. `button`, `badge`, `card` e `app-shell/UserAvatar` não são varridos, mas o catálogo é atualizado do mesmo jeito (regra do projeto) e o guarda continua verde porque só entram textos novos.
> - Biome: `<img>` dispara `lint/performance/noImgElement` (domínio `next` recomendado). O projeto já usa `// biome-ignore lint/...: motivo` (ex.: `src/components/ui/chart.tsx`). `src/components/ui/**` tem override de regras, `app-shell` não.
> - `tsconfig.json` tem `resolveJsonModule: true`, `module: esnext`, `moduleResolution: bundler`, TypeScript 5.9.3. Conferido num projeto descartável (fora do repo) com as mesmas opções: `import notionists from "@dicebear/styles/notionists.json" with { type: "json" }` + `new Style(notionists)` passa em `tsc` sem erro de tipo, e `bun` roda. `Avatar#toDataUri()` devolve `data:image/svg+xml;charset=utf-8,%3Csvg...` (~26 KB com esses fundos), determinístico. Com semente vazia o DiceBear NÃO falha (gera um avatar), por isso `avatarDataUri` lança `Error` próprio.
> - `package.json` fixa versões exatas sem `^` nas libs de auth/Sentry (`"1.7.27"`); `bun add ... --exact` escreve do mesmo jeito.
>
> ---


**Files:**
- Modify: `src/components/ui/button.tsx` (pílula em tudo; variantes `surface`, `on-pastel`, `on-pastel-secondary`; tamanhos `pill`, `icon-pill`; tamanho de texto sai da base e vai para cada `size`)
- Modify: `src/components/ui/badge.tsx` (`rounded-full`; variantes `warning`, `info`, `success`, `neutral`, `pastel-pending`, `pastel-confirmed`; prop `size`: `default` | `md`)
- Modify: `src/components/ui/card.tsx` (prop `variant?: "default" | "feature"`)
- Modify: `.context/ui-registry.md` (entradas `Button`, `Badge`, `Card`: Como funciona + Histórico 2026-11-27)
- Test: `src/components/ui/button.test.ts` (modifica), `src/components/ui/button.variants.test.ts` (novo), `src/components/ui/badge.test.tsx` (novo), `src/components/ui/card.test.tsx` (novo)

**Interfaces:**
- Consumes (Task 1): utilitários `bg-on-pastel`, `text-on-pastel-ink`, `bg-on-pastel-secondary`, `hover:bg-on-pastel-secondary-hover`, `text-on-pastel`, `bg-pastel-pending`, `text-pastel-pending-foreground`, `bg-pastel-confirmed`, `text-pastel-confirmed-foreground`, `bg-accent`, `bg-card`. Consumes (Task 2): `font-heading`. Sem Task 1/2 o teste passa (compara strings), mas a tela fica sem a cor/fonte.
- Produces:
  - `buttonVariants({ variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link" | "surface" | "on-pastel" | "on-pastel-secondary"; size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg" | "pill" | "icon-pill" })` e `Button` com as mesmas props.
  - `badgeVariants({ variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link" | "warning" | "info" | "success" | "neutral" | "pastel-pending" | "pastel-confirmed"; size?: "default" | "md" })`; `Badge` aceita `size`.
  - `Card({ variant?: "default" | "feature"; size?: "default" | "sm" })`; escreve `data-variant` no `div`. Subcomponentes inalterados.

- [ ] **Step 1: Atualizar o teste existente `button.test.ts` (tamanhos novos) e criar o teste das variantes**

Substitua TODO o conteúdo de `src/components/ui/button.test.ts` por:

```ts
import { describe, expect, it } from "vitest";

import { buttonVariants } from "@/components/ui/button";
import {
  heightUnit,
  MIN_DESKTOP_UNIT,
  TOUCH_UNIT,
} from "../../../test/touchTargets";

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

// Estes já são 44px em qualquer tela; os demais ganham o modificador max-md.
const ALWAYS_TOUCH_SIZED = ["lg", "icon-lg", "icon-pill"] as const;
// O `pill` tem 48px em qualquer tela (acima do mínimo de toque).
const PILL_HEIGHT_UNIT = 12;
const FIXED_SIZES = [...ALWAYS_TOUCH_SIZED, "pill"] as readonly string[];
const SCALING_SIZES = SIZES.filter((size) => !FIXED_SIZES.includes(size));

describe("buttonVariants — alvos de toque (ui-rules §1.4)", () => {
  it.each(
    SIZES,
  )("size=%s tem pelo menos 36px (h-9 / size-9) no desktop", (size) => {
    const unit = heightUnit(buttonVariants({ size }), "");
    expect(unit).not.toBeNull();
    expect(unit).toBeGreaterThanOrEqual(MIN_DESKTOP_UNIT);
  });

  it.each(SCALING_SIZES)("size=%s sobe para 44px abaixo de md", (size) => {
    expect(heightUnit(buttonVariants({ size }), "max-md:")).toBe(TOUCH_UNIT);
  });

  it.each(ALWAYS_TOUCH_SIZED)("size=%s já é 44px em qualquer tela", (size) => {
    expect(heightUnit(buttonVariants({ size }), "")).toBe(TOUCH_UNIT);
  });

  it("size=pill tem 48px em qualquer tela e não precisa do modificador max-md", () => {
    const className = buttonVariants({ size: "pill" });
    expect(heightUnit(className, "")).toBe(PILL_HEIGHT_UNIT);
    expect(heightUnit(className, "max-md:")).toBeNull();
  });

  it("override de altura em className não remove o alvo de toque do celular", () => {
    const className = buttonVariants({ size: "default", className: "h-6" });
    expect(heightUnit(className, "max-md:")).toBe(TOUCH_UNIT);
  });
});
```

Crie `src/components/ui/button.variants.test.ts`:

```ts
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

  it.each(SIZES)("size=%s não carrega raio próprio (nenhum rounded-lg nem rounded-[min(...)])", (size) => {
    const radii = classesOf({ size }).filter((name) => name.includes("rounded"));
    expect(radii).toEqual(["rounded-full"]);
  });

  it.each(VARIANTS)("variant=%s mantém a pílula e o anel de foco", (variant) => {
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
    // Protótipo: 22px só nos primários dentro de card colorido; "Ver o dashboard",
    // "Ver solicitações", "Agora não" e "Ver todas as passagens" usam 20px.
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bunx vitest run src/components/ui/button.test.ts src/components/ui/button.variants.test.ts`
Expected: FAIL. `button.test.ts` com `expected null not to be null` em `size=pill`/`size=icon-pill`; `button.variants.test.ts` com `expected [ 'rounded-lg' ... ] to contain 'rounded-full'` e `expected [...] to include "bg-on-pastel"`.

- [ ] **Step 3: Implementar `Button`**

Substitua TODO o conteúdo de `src/components/ui/button.tsx` por:

```tsx
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

// Pílula em todo o app (C-V2). O tamanho do texto fica em cada `size` (não na
// base): `buttonVariants` também é usado cru em <Link className={...}>, sem
// twMerge, e duas classes de font-size na mesma string dependeriam da ordem do CSS.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
        // Sobre o fundo da página (ex.: "Ver o dashboard"): card, hover accent.
        surface: "bg-card text-card-foreground hover:bg-accent",
        // Primário dentro de card colorido: tinta fixa, afunda ao apertar.
        "on-pastel":
          "bg-on-pastel text-on-pastel-ink active:scale-[.97] [transition-property:background-color,color,scale]",
        // Secundário dentro de card colorido: fundo translúcido sobre o pastel.
        "on-pastel-secondary":
          "bg-on-pastel-secondary text-on-pastel hover:bg-on-pastel-secondary-hover",
      },
      size: {
        default:
          "h-9 gap-1.5 px-3 text-sm font-medium max-md:h-11 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-9 gap-1 px-2 text-xs font-medium max-md:h-11 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1 px-2.5 text-[0.8rem] font-medium max-md:h-11 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-4 text-sm font-medium has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-9 text-sm font-medium max-md:size-11",
        "icon-xs":
          "size-9 text-sm font-medium max-md:size-11 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 text-sm font-medium max-md:size-11",
        "icon-lg": "size-11 text-sm font-medium",
        // 48px, Satoshi 16px/700 (Início e shell). Já acima do alvo de toque.
        pill: "h-12 gap-2.5 px-[22px] font-heading text-base font-bold [&_svg:not([class*='size-'])]:size-[18px]",
        // Controle redondo de 44px (botão do menu, etc.).
        "icon-pill":
          "size-11 text-sm font-medium [&_svg:not([class*='size-'])]:size-[18px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
```

Nota ao executor: o `in-data-[slot=button-group]:rounded-lg` dos tamanhos `xs`, `sm`, `icon-xs`, `icon-sm` some de propósito (tudo é pílula; ver Dúvida 1). `bg-clip-padding` e `border` ficam como estavam.

- [ ] **Step 4: Rodar e ver passar (Button)**

Run: `bunx vitest run src/components/ui/button.test.ts src/components/ui/button.variants.test.ts src/components/ui/button.test.tsx`
Expected: PASS (todos os testes dos três arquivos verdes).

- [ ] **Step 5: Escrever o teste do `Badge` (falha)**

Crie `src/components/ui/badge.test.tsx`:

```tsx
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
});

describe("Badge — variantes novas só com tokens", () => {
  it.each([
    ["warning", "bg-warning", "text-warning-foreground"],
    ["info", "bg-info", "text-info-foreground"],
    ["success", "bg-success", "text-success-foreground"],
    ["neutral", "bg-accent", "text-foreground"],
    ["pastel-pending", "bg-pastel-pending", "text-pastel-pending-foreground"],
    [
      "pastel-confirmed",
      "bg-pastel-confirmed",
      "text-pastel-confirmed-foreground",
    ],
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
    expect(badge("Parada")).toHaveClass("bg-warning", "text-warning-foreground");
    expect(badge("Parada")).not.toHaveClass("bg-secondary");
  });

  it("nenhuma variante usa hex cru nem cor crua do Tailwind", () => {
    for (const variant of [
      "warning",
      "info",
      "success",
      "neutral",
      "pastel-pending",
      "pastel-confirmed",
    ] as const) {
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
    expect(medio.filter((name) => /^font-(?:medium|semibold)$/.test(name))).toEqual(
      ["font-semibold"],
    );
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `bunx vitest run src/components/ui/badge.test.tsx`
Expected: FAIL com `expected element to have class: rounded-full` (hoje é `rounded-4xl`) e erros de tipo/classe para `size="md"` e as variantes novas.

- [ ] **Step 7: Implementar `Badge`**

Substitua TODO o conteúdo de `src/components/ui/badge.tsx` por:

```tsx
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

// Altura, padding horizontal e peso ficam em cada `size` (não na base), para o
// `md` não somar duas alturas quando `badgeVariants` é usado sem twMerge.
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent py-0.5 text-xs whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        warning: "bg-warning text-warning-foreground",
        info: "bg-info text-info-foreground",
        success: "bg-success text-success-foreground",
        neutral: "bg-accent text-foreground",
        // Sempre claros nos dois temas: ficam sobre o pastel do cartão de turno.
        "pastel-pending": "bg-pastel-pending text-pastel-pending-foreground",
        "pastel-confirmed":
          "bg-pastel-confirmed text-pastel-confirmed-foreground",
      },
      size: {
        default: "h-5 px-2 font-medium",
        md: "h-6 px-2.5 font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant, size }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
```

- [ ] **Step 8: Rodar e ver passar (Badge e os testes de badge existentes)**

Run: `bunx vitest run src/components/ui/badge.test.tsx src/components/solicitacoes/StaleBadge.test.tsx src/components/solicitacoes/RequestStatusBadge.test.tsx src/components/passagens/HandoverStatusBadge.test.tsx src/components/admin/InactiveBadge.test.tsx`
Expected: PASS em todos. Se algum teste existente quebrar por causa de `h-5`/`px-2`/`font-medium` (nenhum afirma essas classes hoje), ajuste só a asserção, nunca o componente.

- [ ] **Step 9: Escrever o teste do `Card` (falha)**

Crie `src/components/ui/card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Card, CardContent, CardHeader, CardTitle } from "./card";

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
```

- [ ] **Step 10: Rodar e ver falhar**

Run: `bunx vitest run src/components/ui/card.test.tsx`
Expected: FAIL com `expected element to have attribute data-variant="default"` (o atributo ainda não existe).

- [ ] **Step 11: Implementar `Card`**

Em `src/components/ui/card.tsx`, substitua APENAS a função `Card` (do início do arquivo até o fechamento dela, antes de `function CardHeader`) por este trecho. Os imports (`cn`, `type * as React`) e todo o resto do arquivo ficam como estão.

```tsx
const CARD_SHARED =
  "group/card flex flex-col overflow-hidden bg-card text-sm text-card-foreground";

// Card das telas de hoje: não muda.
const CARD_DEFAULT =
  "gap-(--card-spacing) rounded-xl py-(--card-spacing) ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl";

// Cards grandes do Início: raio 32px, padding 32px (22px abaixo de 860px), sem
// anel, sem borda e sem sombra (separam-se pela cor). O conteúdo vai direto nos
// filhos; CardHeader/CardContent somariam o próprio px e não são usados aqui.
const CARD_FEATURE =
  "gap-0 rounded-[32px] p-(--card-spacing) [--card-spacing:--spacing(8)] max-md:[--card-spacing:--spacing(5.5)]";

function Card({
  className,
  size = "default",
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm";
  variant?: "default" | "feature";
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-variant={variant}
      className={cn(
        CARD_SHARED,
        variant === "feature" ? CARD_FEATURE : CARD_DEFAULT,
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 12: Rodar e ver passar (Card e testes que usam Card/Button)**

Run: `bunx vitest run src/components/ui src/components/admin src/components/app-shell src/components/solicitacoes src/components/passagens`
Expected: PASS. (São só os diretórios que importam os três componentes; nenhum teste deles afirma raio.) Para conferir o alcance antes: `grep -rl "buttonVariants\|ui/button\|ui/badge\|ui/card" src test e2e --include=*.test.ts --include=*.test.tsx --include=*.spec.ts`.

- [ ] **Step 13: Atualizar `.context/ui-registry.md`**

Use a ferramenta Edit (o arquivo tem acentos). Três edições.

(a) Entrada `### Button`, substitua a linha de "Como funciona" por:

```markdown
- **Como funciona:** `@base-ui/react/button` + `cva`. Pílula (`rounded-full`) em todas as variantes e
  tamanhos (C-V2, 2026-11-27). Variantes `default`, `outline`, `secondary`, `ghost`, `destructive`,
  `link`, mais `surface` (`bg-card`, hover `bg-accent`: botão sobre o fundo da página),
  `on-pastel` (`bg-on-pastel text-on-pastel-ink`, `active:scale-[.97]`: primário dentro de card
  colorido) e `on-pastel-secondary` (`bg-on-pastel-secondary`, hover `-hover`: secundário dentro de
  card colorido). Tamanhos `default`, `xs`, `sm`, `lg` (h-11), `icon`, `icon-xs`, `icon-sm`,
  `icon-lg`, `pill` (48px, `font-heading` 16px/700, `px-[22px]`, `gap-2.5`, ícone 18px) e
  `icon-pill` (44px redondo). Composição com `render`, não `asChild`. O tamanho do texto fica em
  cada `size` (não na base) para `buttonVariants` usado cru em `<Link>` não ter dois `font-size`.
  Padding do `pill` (protótipo): 22px nos primários `on-pastel`; 20px no `surface` ("Ver o
  dashboard"), no `default` ("Ver solicitações") e nos secundários `on-pastel-secondary`, sempre por
  `cn(buttonVariants({ variant, size: "pill" }), "px-5")` (o `cn` resolve o conflito com o
  `px-[22px]`; nunca concatene as duas classes sem ele).
```

(b) Na mesma entrada, na linha `- **Atenção:**`, troque "(`lg` e `icon-lg` são 44px sempre)" por "(`lg`, `icon-lg` e `icon-pill` são 44px sempre; `pill` é 48px sempre)". Acrescente ao fim da linha `- **Histórico:**` do Button:

```markdown
 2026-11-27 — Visual do Início (Task 4): `rounded-full` em tudo (sai o `rounded-lg` e os `rounded-[min(...)]`, e o `in-data-[slot=button-group]:rounded-lg`); variantes `surface`, `on-pastel`, `on-pastel-secondary`; tamanhos `pill` e `icon-pill`; `text-sm font-medium` saiu da base para cada `size`.
```

(c) Entrada `### Badge`: substitua "Como funciona" por

```markdown
- **Como funciona:** pílula (`rounded-full`, `whitespace-nowrap`). Variantes `default`, `secondary`,
  `destructive`, `outline`, `ghost`, `link`, mais `warning`, `info`, `success` (tokens de estado),
  `neutral` (`bg-accent text-foreground`), `pastel-pending` e `pastel-confirmed` (claros nos dois
  temas, para o cartão de turno). `size`: `default` (h-5, `font-medium`) e `md` (h-6, `px-2.5`,
  `font-semibold`). Aceita `render`.
```

e troque a linha `- **Usa:**` por `- **Usa:** tokens `primary`, `secondary`, `destructive`, `warning`, `info`, `success`, `accent`, `pastel-pending`, `pastel-confirmed`.`; acrescente ao `Histórico`: ` 2026-11-27 — Visual do Início (Task 4): `rounded-full` (era `rounded-4xl`), `whitespace-nowrap` já existia; variantes e `size="md"` novos.`

(d) Entrada `### Card`: substitua "Como funciona" por

```markdown
- **Como funciona:** `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`,
  `CardContent`, `CardFooter`; HTML puro. `Card` aceita `variant="default" | "feature"` (escreve
  `data-variant`). `feature` = raio 32px, padding 32px (22px abaixo de 860px, via `--card-spacing`),
  `gap-0`, sem `ring`, sem borda e sem sombra; o fundo vem do `className` (`bg-highlight`, etc.).
  Num `feature` o conteúdo vai direto nos filhos: `CardHeader`/`CardContent` somariam o `px` deles.
```

e acrescente ao `Histórico`: ` 2026-11-27 — Visual do Início (Task 4): variante `feature`; o `default` não mudou.`

- [ ] **Step 14: Verificações da tarefa**

Run: `bun run check-types`
Expected: sem erros.

Run: `bun run lint`
Expected: sem erros (Biome formata `button.variants.test.ts`: se reclamar de quebra de linha, rode `bunx biome format --write src/components/ui` e confira o diff).

Run: `bunx vitest run test/uiRegistryDoc.test.ts src/components/ui`
Expected: PASS.

- [ ] **Step 15: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/visual/msg-task-4.txt` e rode
`git add src/components/ui/button.tsx src/components/ui/badge.tsx src/components/ui/card.tsx src/components/ui/button.test.ts src/components/ui/button.variants.test.ts src/components/ui/badge.test.tsx src/components/ui/card.test.tsx .context/ui-registry.md && git commit -F .git/sdd/visual/msg-task-4.txt`.
Mensagem:

```
feat(ui): botões e badges em pílula; variantes do visual novo

Button e Badge viram rounded-full no app inteiro. Button ganha as variantes
surface, on-pastel e on-pastel-secondary e os tamanhos pill (48px) e icon-pill
(44px). Badge ganha warning, info, success, neutral, pastel-pending,
pastel-confirmed e size md. Card ganha a variante feature (raio 32px, sem anel).
O tamanho do texto do Button sai da base e vai para cada size.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---


### Task 5: Cor do setor (schema, migração, `colors.ts`, domínio, validação, fixtures)

> **Notas do redator (conferidas no código em 2026-11-27):**
>
> Premissas conferidas no código (2026-11-27):
>
> - A função de edição do setor chama-se `renameSector` (domínio), `renameSectorAction` (action) e
>   `renameSectorSchema` (schema). **Mantive os três nomes** (o contrato diz "ou o nome atual"): renomear tudo
>   para `update*` mexeria em `actionsInventory.test.ts`, nos componentes e nos testes sem ganho de
>   comportamento. Ela passa a gravar nome **e** cor. Ver "Dúvidas".
> - `src/features/sectors/` não existe; a Task 5 cria a pasta com `colors.ts`. O schema
>   (`src/db/schema/sectors.ts`) importa `SECTOR_COLORS` de lá, como `catalog.ts` importa `ITEM_KINDS` de
>   `@/lib/itemKinds` (arquivo puro, sem `server-only`, para o cliente poder importar).
> - A migração mais recente é a `0004_fase4_solicitacoes`; a nova será `0005_cor_do_setor` (o nome vem do
>   `--name`). Nenhuma migração anterior foi editada à mão (todas são saída do `drizzle-kit` com nome
>   trocado), então esta é a primeira com SQL editado; o teste dela é por isso mais completo.
> - O `snapshot` do drizzle (`drizzle/meta/0005_snapshot.json`) é gerado a partir do **schema** (coluna
>   `NOT NULL` + `checkConstraints`), nunca do SQL. O SQL editado termina no mesmo estado final, então o
>   snapshot fica correto sem edição. Prova no passo da migração: um segundo `db:generate` tem que dizer
>   "No schema changes".
> - O dump dos testes (`test/global-setup.ts`) migra `./drizzle` inteiro com o migrator do drizzle: o
>   arquivo editado precisa ser SQL válido em uma execução (statement por statement, separado por
>   `--> statement-breakpoint`). Validei o backfill num PGlite: 7 setores viram
>   `lilac, peach, sky, green, pink, lilac, peach`; cor `'red'` volta `23514` com
>   `constraint = sector_color_valid`. O `ARRAY[...][n]` precisa de `::int` no índice (`row_number()` é `bigint`).
> - `insertSector(db, name, options)` é chamado por dezenas de testes; a cor entra como `options.color`
>   com padrão `"lilac"`, então nenhum deles muda. Os inserts **diretos** na tabela que quebram com a coluna
>   `NOT NULL` são só estes: `src/db/schema/sectors.test.ts`, `src/features/admin/dbErrors.test.ts` e
>   `test/db.test.ts` (os `INSERT INTO sector` de `migration0002/0003/0004.test.ts` rodam num banco parado
>   antes da 0005 e não mudam).
> - `ChoiceGroup` **não serve**: é um `ToggleGroup` com rótulo `string` por opção, sem lugar para a amostra, e
>   um grupo de botões `aria-pressed` não é um `radiogroup`. `SectorColorChoice` usa `RadioGroup`/`Radio` do
>   Base UI (`@base-ui/react/radio-group`, `@base-ui/react/radio`; API conferida em
>   `node_modules/@base-ui/react/radio*/**/*.d.ts`): `Radio.Root` renderiza um `<span role="radio">` mais um
>   `<input>` escondido, e o nome acessível do `radio` vem do conteúdo (amostra decorativa + texto).
> - `page.tsx` e `page.test.tsx` de `/admin/setores` **não mudam**: a leitura fica em `SectorsAdmin`
>   (Server Component), que é onde a sugestão é calculada.
>


> **Tasks 5 e 6 são executadas em sequência pelo mesmo implementador e revisadas juntas:** o schema desta tarefa exige a `color` que só a UI da Task 6 manda (entre as duas, `SectorCreateForm`/`SectorRowActions` são recusados pelo servidor e o `check-types` acusa os testes da tela Setores).

**Files:**
- Create: `src/features/sectors/colors.ts`
- Create: `src/features/sectors/colors.test.ts`
- Create: `drizzle/0005_cor_do_setor.sql` (gerado por `db:generate`, depois editado à mão)
- Create: `drizzle/meta/0005_snapshot.json` (gerado; não editar)
- Create: `src/db/schema/migration0005.test.ts`
- Create: `src/features/admin/sectorColor.test.ts`
- Create: `src/app/(app)/admin/setores/actionsColor.test.ts`
- Modify: `drizzle/meta/_journal.json` (o `db:generate` acrescenta a entrada 5)
- Modify: `src/db/schema/sectors.ts` (coluna `color` + check `sector_color_valid`)
- Modify: `src/db/schema/sectors.test.ts` (inserts com cor + testes da coluna)
- Modify: `src/features/admin/dbErrors.test.ts`, `test/db.test.ts` (inserts com cor)
- Modify: `test/fixtures.ts` (`insertSector` com `options.color`), `test/fixtures.test.ts`
- Modify: `src/features/admin/messages.ts` (mensagem da cor inválida)
- Modify: `src/features/admin/schemas.ts` (+ `schemas.test.ts`): `color` em `createSectorSchema` e `renameSectorSchema`
- Modify: `src/features/admin/sectors.ts` (+ `sectors.test.ts`): `SectorRow`/`SectorChoice` com `color`, `createSector`, `renameSector`, `listSectors`, `listActiveSectors`, `suggestColorForNewSector`
- Modify: `src/app/(app)/admin/setores/actions.test.ts` (as entradas válidas passam a levar `color`). `actions.ts` **não muda** (o schema já entrega `color` ao domínio).
- Modify: `src/components/passagens/SectorPicker.tsx` (só o tipo de `options`, para o `check-types` continuar verde; a Task 7 reescreve)
- Modify (só literais de teste tipados como `SectorChoice`): `src/components/admin/team/InviteForm.test.tsx`, `src/components/admin/team/PersonForm.test.tsx`, `src/components/admin/team/PersonRowActions.test.tsx`, `src/components/admin/SectorSwitcher.test.tsx`, `src/features/handovers/sectorChoice.test.ts`, `src/features/handovers/screenSector.test.ts`, `src/components/passagens/SectorPicker.test.tsx`, `src/components/admin/team/TeamAdmin.test.tsx`, `src/components/solicitacoes/RequestForm.test.tsx`
- Test: os arquivos acima.

**Interfaces:**
- Consumes (Task 1): os tokens `--color-sector-lilac|peach|sky|green|pink` em `src/app/globals.css` (o teste de `colors.ts` confere que existem).
- Produces:
  ```ts
  // src/features/sectors/colors.ts (puro, sem server-only)
  export const SECTOR_COLORS = ["lilac", "peach", "sky", "green", "pink"] as const;
  export type SectorColor = (typeof SECTOR_COLORS)[number];
  export const SECTOR_COLOR_LABELS: Record<SectorColor, string>; // Lilás, Pêssego, Azul, Verde, Rosa
  export const SECTOR_COLOR_BG: Record<SectorColor, string>;     // "bg-sector-lilac", ...
  export function isSectorColor(value: unknown): value is SectorColor;
  export function suggestSectorColor(activeColors: readonly SectorColor[]): SectorColor;

  // src/features/admin/sectors.ts
  export type SectorRow = { id: string; name: string; color: SectorColor; active: boolean; activePeople: number; pendingInvites: number };
  export type SectorChoice = { id: string; name: string; color: SectorColor };
  export async function createSector(db: Db, input: { name: string; color: SectorColor }): Promise<AdminResult<{ id: string }>>;
  export async function renameSector(db: Db, input: { id: string; name: string; color: SectorColor }): Promise<AdminResult>; // grava nome e cor
  export async function suggestColorForNewSector(db: Db): Promise<SectorColor>;
  // listSectors e listActiveSectors passam a devolver `color`.

  // src/features/admin/schemas.ts
  createSectorSchema: z.object({ name, color })            // color: só SECTOR_COLORS
  renameSectorSchema: z.object({ id, name, color })
  // src/features/admin/messages.ts
  export const SECTOR_COLOR_INVALID_MESSAGE = "Escolha uma das cores da lista.";

  // test/fixtures.ts
  insertSector(db, name?, options?: { active?: boolean; color?: SectorColor }) // color padrão "lilac"; retorno igual ao de hoje
  ```
- O que mudou para a Task 7 (ela cuida do `SectorPicker` e de qualquer loader que monte `SectorChoice[]`): `SectorChoice` agora exige `color`. `listActiveSectors` já devolve `color`, então tudo que passa por ele (`screenSector.ts`, `ItemsAdmin`, `ShiftsAdmin`, `TeamAdmin`) já a leva sem mudar. A Task 5 só trocou o tipo de `options` em `SectorPicker.tsx` por `Pick<SectorChoice, "id" | "name">` para compilar; a Task 7 troca por `{ id; name; color: SectorColor | null }`.

- [ ] **Step 1: Escrever o teste de `colors.ts` (falha)**

Write `src/features/sectors/colors.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  isSectorColor,
  SECTOR_COLOR_BG,
  SECTOR_COLOR_LABELS,
  SECTOR_COLORS,
  type SectorColor,
  suggestSectorColor,
} from "./colors";

describe("a paleta", () => {
  it("tem as cinco chaves, nesta ordem", () => {
    expect([...SECTOR_COLORS]).toEqual([
      "lilac",
      "peach",
      "sky",
      "green",
      "pink",
    ]);
  });

  it("cada chave tem rótulo em português e classe de fundo própria", () => {
    expect(SECTOR_COLOR_LABELS).toEqual({
      lilac: "Lilás",
      peach: "Pêssego",
      sky: "Azul",
      green: "Verde",
      pink: "Rosa",
    });
    expect(SECTOR_COLOR_BG).toEqual({
      lilac: "bg-sector-lilac",
      peach: "bg-sector-peach",
      sky: "bg-sector-sky",
      green: "bg-sector-green",
      pink: "bg-sector-pink",
    });
  });

  it("cada cor tem o token --color-sector-* declarado em globals.css (a classe bg-sector-* existe)", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    for (const color of SECTOR_COLORS) {
      expect(css, color).toContain(`--color-sector-${color}`);
    }
  });
});

describe("isSectorColor", () => {
  it("aceita as cinco chaves", () => {
    for (const color of SECTOR_COLORS) expect(isSectorColor(color)).toBe(true);
  });

  it.each([
    "red",
    "",
    "Lilac",
    "lilas",
    " lilac",
    null,
    undefined,
    1,
    {},
    ["lilac"],
  ])("recusa %j", (value) => {
    expect(isSectorColor(value)).toBe(false);
  });
});

describe("suggestSectorColor", () => {
  it("nenhum setor ativo: a primeira da paleta (lilac)", () => {
    expect(suggestSectorColor([])).toBe("lilac");
  });

  it("devolve a primeira cor livre, na ordem da paleta", () => {
    expect(suggestSectorColor(["lilac"])).toBe("peach");
    expect(suggestSectorColor(["lilac", "peach"])).toBe("sky");
    expect(suggestSectorColor(["peach", "sky"])).toBe("lilac");
    expect(suggestSectorColor(["lilac", "sky"])).toBe("peach");
    expect(suggestSectorColor(["lilac", "peach", "sky", "green"])).toBe("pink");
  });

  it("a ordem da lista de entrada não importa", () => {
    expect(suggestSectorColor(["sky", "lilac"])).toBe("peach");
  });

  it("cor repetida não esconde uma livre", () => {
    expect(suggestSectorColor(["lilac", "lilac", "lilac"])).toBe("peach");
  });

  it("todas em uso: a menos usada", () => {
    const all: SectorColor[] = ["lilac", "peach", "sky", "green", "pink"];
    // lilac e peach duas vezes; sky, green e pink uma: a menos usada, na ordem da paleta, é sky.
    expect(suggestSectorColor([...all, "lilac", "peach"])).toBe("sky");
    // só pink tem uma; as outras duas.
    expect(
      suggestSectorColor([
        "lilac",
        "lilac",
        "peach",
        "peach",
        "sky",
        "sky",
        "green",
        "green",
        "pink",
      ]),
    ).toBe("pink");
  });

  it("todas em uso e empatadas: a primeira da paleta", () => {
    expect(
      suggestSectorColor(["lilac", "peach", "sky", "green", "pink"]),
    ).toBe("lilac");
    expect(
      suggestSectorColor([
        "pink",
        "green",
        "sky",
        "peach",
        "lilac",
        "pink",
        "green",
        "sky",
        "peach",
        "lilac",
      ]),
    ).toBe("lilac");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bunx vitest run src/features/sectors/colors.test.ts`
Expected: FAIL com "Failed to resolve import "./colors"" (o arquivo ainda não existe).

- [ ] **Step 3: Implementar `colors.ts`**

Write `src/features/sectors/colors.ts`:

```ts
// A paleta fechada de cores de setor (spec visual §5.1, D-V3). Arquivo puro, sem
// `server-only`: o schema do banco, o formulário (cliente) e o servidor importam daqui.
// Este é o único lugar onde a chave vira rótulo e classe; o valor da cor mora nos tokens
// `--sector-*` de globals.css (tema claro e escuro).
export const SECTOR_COLORS = ["lilac", "peach", "sky", "green", "pink"] as const;

export type SectorColor = (typeof SECTOR_COLORS)[number];

export const SECTOR_COLOR_LABELS: Record<SectorColor, string> = {
  lilac: "Lilás",
  peach: "Pêssego",
  sky: "Azul",
  green: "Verde",
  pink: "Rosa",
};

// Classes escritas por extenso: o Tailwind só gera o que encontra como texto no código.
export const SECTOR_COLOR_BG: Record<SectorColor, string> = {
  lilac: "bg-sector-lilac",
  peach: "bg-sector-peach",
  sky: "bg-sector-sky",
  green: "bg-sector-green",
  pink: "bg-sector-pink",
};

export function isSectorColor(value: unknown): value is SectorColor {
  return (
    typeof value === "string" &&
    (SECTOR_COLORS as readonly string[]).includes(value)
  );
}

// Cor sugerida para um setor novo, a partir das cores dos setores ATIVOS: a primeira da
// paleta que ninguém usa; se todas estão em uso, a menos usada, e o empate vai para a
// ordem da paleta. "Menos usada" já cobre "primeira livre" (uma cor livre tem 0 usos e
// a comparação estrita `<` preserva a primeira da paleta no empate). Quem decide quais
// setores são ativos é o chamador (`suggestColorForNewSector`).
export function suggestSectorColor(
  activeColors: readonly SectorColor[],
): SectorColor {
  const uses = new Map<SectorColor, number>(
    SECTOR_COLORS.map((color) => [color, 0]),
  );
  for (const color of activeColors) {
    uses.set(color, (uses.get(color) ?? 0) + 1);
  }

  let best: SectorColor = SECTOR_COLORS[0];
  let bestUses = uses.get(best) ?? 0;
  for (const color of SECTOR_COLORS) {
    const count = uses.get(color) ?? 0;
    if (count < bestUses) {
      best = color;
      bestUses = count;
    }
  }
  return best;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bunx vitest run src/features/sectors/colors.test.ts`
Expected: PASS (todos os testes; o do `globals.css` só passa porque a Task 1 já declarou os tokens `--color-sector-*`).

- [ ] **Step 5: Escrever o teste da migração (falha)**

Write `src/db/schema/migration0005.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  migratedTo,
  migrationFile,
  statementsOf,
} from "../../../test/migrations";
import { sqlErrorOf } from "../../../test/sqlError";

// Aplica 0000–0004 (o banco como está em produção antes da cor do setor), insere
// setores "de antes" e aplica a 0005 por cima: é o que o db:migrate faz no Neon.
const PHASE_6 = ["0000", "0001", "0002", "0003", "0004"] as const;

function sectorId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

describe("migração 0005 (cor do setor) sobre os dados da 0004", {
  timeout: 60_000,
}, () => {
  let client: PGlite | undefined;

  afterEach(async () => {
    await client?.close();
    client = undefined;
  });

  async function dbBeforeColor(inserts = ""): Promise<PGlite> {
    const created = await migratedTo(PHASE_6);
    client = created;
    if (inserts !== "") await created.exec(inserts);
    return created;
  }

  async function colorsByName(pg: PGlite): Promise<Record<string, string>> {
    const { rows } = await pg.query<{ name: string; color: string }>(
      "SELECT name, color FROM sector ORDER BY created_at, id",
    );
    return Object.fromEntries(rows.map((row) => [row.name, row.color]));
  }

  it("o SQL editado segue a ordem: coluna anulável, preenchimento, NOT NULL, check", () => {
    const statements = statementsOf(migrationFile("0005"));

    expect(statements).toHaveLength(4);
    expect(statements[0]).toBe('ALTER TABLE "sector" ADD COLUMN "color" text;');
    expect(statements[1]).toMatch(/^UPDATE "sector" SET "color" = /);
    expect(statements[1]).toContain("row_number() OVER");
    expect(statements[1]).toContain('ORDER BY "created_at", "id"');
    expect(statements[2]).toBe(
      'ALTER TABLE "sector" ALTER COLUMN "color" SET NOT NULL;',
    );
    expect(statements[3]).toMatch(
      /^ALTER TABLE "sector" ADD CONSTRAINT "sector_color_valid" CHECK /,
    );
  });

  it("os setores que já existem ganham cor pela ordem de created_at, ciclando a paleta uma vez", async () => {
    // Inseridos fora de ordem de propósito: a ordem da cor é a do created_at, não a do insert.
    const pg = await dbBeforeColor(`
      INSERT INTO sector (id, name, created_at) VALUES
        ('${sectorId(3)}', 'Terceiro', '2026-01-03T00:00:00Z'),
        ('${sectorId(7)}', 'Sétimo',   '2026-01-07T00:00:00Z'),
        ('${sectorId(1)}', 'Primeiro', '2026-01-01T00:00:00Z'),
        ('${sectorId(5)}', 'Quinto',   '2026-01-05T00:00:00Z'),
        ('${sectorId(2)}', 'Segundo',  '2026-01-02T00:00:00Z'),
        ('${sectorId(6)}', 'Sexto',    '2026-01-06T00:00:00Z'),
        ('${sectorId(4)}', 'Quarto',   '2026-01-04T00:00:00Z');
    `);

    await applyMigration(pg, migrationFile("0005"));

    expect(await colorsByName(pg)).toEqual({
      Primeiro: "lilac",
      Segundo: "peach",
      Terceiro: "sky",
      Quarto: "green",
      Quinto: "pink",
      Sexto: "lilac",
      Sétimo: "peach",
    });
  });

  it("setores com o mesmo created_at desempatam pelo id (resultado estável)", async () => {
    const pg = await dbBeforeColor(`
      INSERT INTO sector (id, name, created_at) VALUES
        ('${sectorId(2)}', 'Id dois', '2026-02-01T00:00:00Z'),
        ('${sectorId(1)}', 'Id um',   '2026-02-01T00:00:00Z'),
        ('${sectorId(3)}', 'Depois',  '2026-02-02T00:00:00Z');
    `);

    await applyMigration(pg, migrationFile("0005"));

    expect(await colorsByName(pg)).toEqual({
      "Id um": "lilac",
      "Id dois": "peach",
      Depois: "sky",
    });
  });

  it("setor inativo também recebe cor, e nome, ativo e pessoas ficam como estavam", async () => {
    const pg = await dbBeforeColor(`
      INSERT INTO sector (id, name, active, created_at) VALUES
        ('${sectorId(1)}', 'ULD', true, '2026-03-01T00:00:00Z'),
        ('${sectorId(2)}', 'Antigo', false, '2026-03-02T00:00:00Z');
      INSERT INTO "user" (id, name, email, role, sector_id)
        VALUES ('u-ana', 'Ana Teste', 'ana@example.test', 'operator', '${sectorId(1)}');
    `);

    await applyMigration(pg, migrationFile("0005"));

    const { rows } = await pg.query(
      "SELECT name, active, color FROM sector ORDER BY created_at",
    );
    expect(rows).toEqual([
      { name: "ULD", active: true, color: "lilac" },
      { name: "Antigo", active: false, color: "peach" },
    ]);
    const people = await pg.query(
      `SELECT sector_id FROM "user" WHERE id = 'u-ana'`,
    );
    expect(people.rows).toEqual([{ sector_id: sectorId(1) }]);
  });

  it("banco sem nenhum setor migra sem erro", async () => {
    const pg = await dbBeforeColor();

    await applyMigration(pg, migrationFile("0005"));

    const { rows } = await pg.query("SELECT count(*)::int AS n FROM sector");
    expect(rows).toEqual([{ n: 0 }]);
  });

  it("depois da migração a coluna é NOT NULL e não tem valor padrão", async () => {
    const pg = await dbBeforeColor();
    await applyMigration(pg, migrationFile("0005"));

    const { rows } = await pg.query(
      `SELECT is_nullable, column_default FROM information_schema.columns
       WHERE table_name = 'sector' AND column_name = 'color'`,
    );
    expect(rows).toEqual([{ is_nullable: "NO", column_default: null }]);

    expect(
      (
        await sqlErrorOf(pg.query("INSERT INTO sector (name) VALUES ('Sem cor')"))
      ).code,
    ).toBe("23502");
  });

  it("depois da migração uma cor fora da paleta é recusada com 23514 e o nome da constraint", async () => {
    const pg = await dbBeforeColor();
    await applyMigration(pg, migrationFile("0005"));

    for (const invalid of ["red", "", "Lilac", "lilac "]) {
      expect(
        await sqlErrorOf(
          pg.query("INSERT INTO sector (name, color) VALUES ('X', $1)", [
            invalid,
          ]),
        ),
        invalid,
      ).toEqual({ code: "23514", constraint: "sector_color_valid" });
    }
    const { rows } = await pg.query("SELECT count(*)::int AS n FROM sector");
    expect(rows).toEqual([{ n: 0 }]);
  });

  it("depois da migração as cinco cores da paleta são aceitas", async () => {
    const pg = await dbBeforeColor();
    await applyMigration(pg, migrationFile("0005"));

    for (const color of ["lilac", "peach", "sky", "green", "pink"]) {
      await pg.query("INSERT INTO sector (name, color) VALUES ($1, $1)", [
        color,
      ]);
    }
    const { rows } = await pg.query("SELECT count(*)::int AS n FROM sector");
    expect(rows).toEqual([{ n: 5 }]);
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `bunx vitest run src/db/schema/migration0005.test.ts`
Expected: FAIL com "migração 0005 não encontrada" (a migração ainda não existe).

- [ ] **Step 7: Declarar a coluna e o check no schema**

Edit `src/db/schema/sectors.ts` (arquivo inteiro, no estado final):

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { SECTOR_COLORS } from "@/features/sectors/colors";

// Setor da operação (primeiro: ULD). Operador pertence a um setor; admin vê todos.
// Nome único sem diferença de caixa: "Uld" e "ULD" são o mesmo setor.
// `color` é uma chave da paleta fechada (D-V3): a cor é do setor e só muda pela tela
// Setores; nunca é derivada da ordem da lista. Sem valor padrão de propósito: um insert
// sem cor tem que falhar (a tela sugere uma cor, o banco não adivinha).
export const sector = pgTable(
  "sector",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    color: text("color", { enum: SECTOR_COLORS }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("sector_name_lower_uq").on(sql`lower(${table.name})`),
    check(
      "sector_color_valid",
      sql`${table.color} in ('lilac', 'peach', 'sky', 'green', 'pink')`,
    ),
  ],
);
```

(A lista literal do check repete as chaves de propósito: o SQL da migração é texto fixo. O teste do Step 12 garante que o check e `SECTOR_COLORS` não se separem.)

- [ ] **Step 8: Gerar a migração**

Run: `bun run db:generate --name=cor_do_setor`
Expected: o `drizzle-kit` lista `sector 5 columns 0 indexes ...`, grava `drizzle/0005_cor_do_setor.sql` e `drizzle/meta/0005_snapshot.json` e acrescenta a entrada `idx: 5, tag: "0005_cor_do_setor"` em `drizzle/meta/_journal.json`. (O `db:generate` não conecta ao banco; o `drizzle.config.ts` aceita a URL vazia.) Se o `--name` não chegar ao `drizzle-kit`, renomeie o `.sql` gerado para `0005_cor_do_setor.sql` e troque o `tag` no `_journal.json` para o mesmo nome sem `.sql`.

O SQL gerado (esperado; confira antes de editar):

```sql
ALTER TABLE "sector" ADD COLUMN "color" text NOT NULL;--> statement-breakpoint
ALTER TABLE "sector" ADD CONSTRAINT "sector_color_valid" CHECK ("sector"."color" in ('lilac', 'peach', 'sky', 'green', 'pink'));
```

Esse SQL **falharia no Neon** (e em qualquer banco com setores): adicionar coluna `NOT NULL` sem valor padrão a uma tabela com linhas é erro `23502`. Por isso o arquivo é editado à mão no passo seguinte.

- [ ] **Step 9: Editar o SQL gerado (preenchimento único)**

Substitua o **conteúdo inteiro** de `drizzle/0005_cor_do_setor.sql` (use a ferramenta Write; o arquivo tem acento no comentário).

Atenção: o `statementsOf` do harness só remove espaços das pontas de cada trecho; um comentário `--` no topo ficaria colado no primeiro statement e o teste do Step 5 espera `statements[0]` igual a `ALTER TABLE "sector" ADD COLUMN "color" text;`. Por isso o comentário explicativo vai **no fim** do arquivo. O arquivo final é:

```sql
ALTER TABLE "sector" ADD COLUMN "color" text;--> statement-breakpoint
UPDATE "sector" SET "color" = (ARRAY['lilac', 'peach', 'sky', 'green', 'pink'])[(((ordered."position" - 1) % 5) + 1)::int]
FROM (
	SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS "position" FROM "sector"
) AS ordered
WHERE "sector"."id" = ordered."id";--> statement-breakpoint
ALTER TABLE "sector" ALTER COLUMN "color" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sector" ADD CONSTRAINT "sector_color_valid" CHECK ("sector"."color" in ('lilac', 'peach', 'sky', 'green', 'pink'));
-- Editada à mão depois do db:generate: o SQL gerado adicionava a coluna NOT NULL de uma vez, o que falha
-- com setores já cadastrados. Passos: (1) coluna anulável; (2) preenchimento ÚNICO pela ordem de
-- created_at (desempate por id), ciclando a paleta: o único lugar em que a cor vem da ordem, depois disso
-- a cor é do setor; (3) NOT NULL; (4) check da paleta. O estado final é o do schema (NOT NULL + check),
-- então drizzle/meta/0005_snapshot.json (gerado do schema) continua correto sem edição.
```

(O comentário final fica no mesmo trecho do último statement, depois do `;`; o `psql`/`pg` o executa sem problema, e o `statementsOf` só confere o início de `statements[3]`.)

- [ ] **Step 10: Provar que o snapshot continua consistente com o schema**

Run: `bun run db:generate`
Expected: `No schema changes, nothing to migrate` e nenhum arquivo novo em `drizzle/` (`git status --short drizzle` mostra só `0005_cor_do_setor.sql`, `meta/0005_snapshot.json` e `meta/_journal.json`). Se aparecer uma `0006_*`, o schema e o snapshot divergem: apague a `0006` e a entrada 6 do journal e reveja o Step 7.

- [ ] **Step 11: Rodar o teste da migração**

Run: `bunx vitest run src/db/schema/migration0005.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 12: Consertar os inserts diretos que a coluna NOT NULL quebra, e testar a coluna**

`src/db/schema/sectors.test.ts`: troque o import e os inserts. Edits (cada um é uma troca exata):

1. Linha do import `import { sector } from "./sectors";` →

```ts
import { sqlErrorOf } from "../../../test/sqlError";
import { SECTOR_COLORS } from "@/features/sectors/colors";
import { sector } from "./sectors";
```

(No arquivo as importações de `../../../test/*` ficam juntas: coloque `sqlErrorOf` ao lado de `createTestDb`; o `bun run lint` do último passo reordena se faltar.)

2. Todo `.values({ name: "ULD" })`, `.values({ name: "Uld" })`, `.values({ name: "Revertido" })`, `.values({ name: "Confirmado" })` ganha `color: "lilac"`:

```bash
sed -i -E 's/\.values\(\{ name: ("[^"]*") \}\)/.values({ name: \1, color: "lilac" })/' src/db/schema/sectors.test.ts
```

3. O teste de nome nulo passa a mandar cor (para continuar falhando só por causa do nome): `"INSERT INTO sector (name) VALUES (NULL)"` →

```ts
      .query("INSERT INTO sector (name, color) VALUES (NULL, 'lilac')")
```

4. Acrescente, antes do teste `"transação que lança é revertida por inteiro"`, estes testes:

```ts
  it("grava e devolve a cor", async () => {
    const [inserted] = await db
      .insert(sector)
      .values({ name: "ULD", color: "sky" })
      .returning();
    expect(inserted?.color).toBe("sky");

    const [read] = await db.select().from(sector).where(eq(sector.name, "ULD"));
    expect(read?.color).toBe("sky");
  });

  it("aceita cada cor da paleta", async () => {
    for (const color of SECTOR_COLORS) {
      await db.insert(sector).values({ name: `Setor ${color}`, color });
    }
    expect(await db.select().from(sector)).toHaveLength(SECTOR_COLORS.length);
  });

  it("recusa cor fora da paleta com 23514 e o nome da constraint", async () => {
    for (const invalid of ["red", "", "Lilac"]) {
      expect(
        await sqlErrorOf(
          client.query("INSERT INTO sector (name, color) VALUES ('X', $1)", [
            invalid,
          ]),
        ),
        invalid,
      ).toEqual({ code: "23514", constraint: "sector_color_valid" });
    }
    expect(await db.select().from(sector)).toEqual([]);
  });

  it("recusa cor nula (23502)", async () => {
    expect(
      (
        await sqlErrorOf(
          client.query("INSERT INTO sector (name, color) VALUES ('X', NULL)"),
        )
      ).code,
    ).toBe("23502");
  });

  it("recusa insert sem cor: o banco não escolhe uma por padrão (23502)", async () => {
    expect(
      (await sqlErrorOf(client.query("INSERT INTO sector (name) VALUES ('X')")))
        .code,
    ).toBe("23502");
  });

  it("o check do banco lista exatamente as cores de SECTOR_COLORS (a paleta e o SQL não se separam)", async () => {
    const { rows } = await client.query<{ definition: string }>(
      `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
       WHERE conname = 'sector_color_valid'`,
    );
    const definition = rows[0]?.definition ?? "";
    const quoted = [...definition.matchAll(/'([a-z]+)'::text/g)].map(
      (match) => match[1],
    );
    expect(quoted).toEqual([...SECTOR_COLORS]);
  });
```

`src/features/admin/dbErrors.test.ts` (dois inserts da função `duplicateInsertError`):

```ts
  async function duplicateInsertError(): Promise<unknown> {
    await db.insert(sector).values({ name: "ULD", color: "lilac" });
    try {
      await db.insert(sector).values({ name: "uld", color: "lilac" });
    } catch (error) {
      return error;
    }
    throw new Error("o segundo insert deveria falhar");
  }
```

`test/db.test.ts`, no teste `"resetDb apaga os dados de todas as tabelas"`:

```ts
    await client.exec("INSERT INTO sector (name, color) VALUES ('ULD', 'lilac')");
```

- [ ] **Step 13: `insertSector` ganha a cor (e o teste dela)**

`test/fixtures.ts`: troque o import e a função `insertSector` (o resto do arquivo não muda).

```ts
import { sector } from "@/db/schema/sectors";
```

continua, e acrescente junto dos outros imports de `@/features`:

```ts
import type { SectorColor } from "@/features/sectors/colors";
```

```ts
export async function insertSector(
  db: Db,
  name = `Setor ${randomUUID().slice(0, 8)}`,
  options: { active?: boolean; color?: SectorColor } = {},
): Promise<{ id: string; name: string }> {
  const [created] = await db
    .insert(sector)
    .values({
      name,
      active: options.active ?? true,
      color: options.color ?? "lilac",
    })
    .returning({ id: sector.id, name: sector.name });
  if (!created) throw new Error("fixture: setor não criado");
  return created;
}
```

(O retorno continua `{ id, name }`: nenhum teste existente muda.) Em `test/fixtures.test.ts`, acrescente ao fim do arquivo:

```ts
describe("insertSector", () => {
  async function colorOf(sectorId: string): Promise<string | undefined> {
    const [row] = await db
      .select({ color: sector.color })
      .from(sector)
      .where(eq(sector.id, sectorId));
    return row?.color;
  }

  it("sem opção, o setor sai lilac e ativo", async () => {
    const created = await insertSector(db, "ULD Teste");

    expect(await colorOf(created.id)).toBe("lilac");
    expect(await activeOf(created.id)).toBe(true);
  });

  it("aceita a cor e o estado pelas opções", async () => {
    const pink = await insertSector(db, "Setor Rosa", { color: "pink" });
    const idle = await insertSector(db, "Setor Parado", {
      active: false,
      color: "green",
    });

    expect(await colorOf(pink.id)).toBe("pink");
    expect(await colorOf(idle.id)).toBe("green");
    expect(await activeOf(idle.id)).toBe(false);
  });
});
```

- [ ] **Step 14: Rodar os testes de banco que tocam a coluna**

Run: `bunx vitest run src/db/schema/sectors.test.ts src/features/admin/dbErrors.test.ts test/db.test.ts test/fixtures.test.ts src/db/schema/migration0005.test.ts`
Expected: PASS. (O `global-setup` regenera o dump migrando a `0005`; se um teste reclamar de `color` nulo, falta um insert direto: `grep -rn "INSERT INTO sector\|insert(sector)" src test e2e scripts` e conserte como acima.)

- [ ] **Step 15: Escrever os testes do domínio e da validação (falham)**

Write `src/features/admin/sectorColor.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { sector } from "@/db/schema/sectors";
import type { SectorColor } from "@/features/sectors/colors";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertSector } from "../../../test/fixtures";
import { SECTOR_COLOR_INVALID_MESSAGE } from "./messages";
import {
  createSector,
  listActiveSectors,
  listSectors,
  renameSector,
  suggestColorForNewSector,
} from "./sectors";

const NOW = new Date("2026-11-27T12:00:00.000Z");
const INVALID = "red" as unknown as SectorColor;

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
});

async function colorOf(id: string): Promise<string | undefined> {
  const [row] = await db
    .select({ color: sector.color })
    .from(sector)
    .where(eq(sector.id, id));
  return row?.color;
}

describe("createSector com cor", () => {
  it("grava a cor escolhida", async () => {
    const result = await createSector(db, { name: "Pátio", color: "green" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await colorOf(result.id)).toBe("green");
  });

  it("cor fora da paleta volta INVALID_INPUT no campo color e não grava", async () => {
    expect(await createSector(db, { name: "Pátio", color: INVALID })).toEqual({
      ok: false,
      code: "INVALID_INPUT",
      message: SECTOR_COLOR_INVALID_MESSAGE,
      fieldErrors: { color: SECTOR_COLOR_INVALID_MESSAGE },
    });
    expect(await db.select().from(sector)).toEqual([]);
  });

  it("cor repetida entre setores é permitida (a paleta só tem 5)", async () => {
    await createSector(db, { name: "Um", color: "sky" });

    expect((await createSector(db, { name: "Dois", color: "sky" })).ok).toBe(
      true,
    );
  });

  it("com nome vazio e cor inválida, o erro do nome vem primeiro e a cor não é gravada", async () => {
    const result = await createSector(db, { name: " ", color: INVALID });

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Informe o nome.",
    });
    expect(await db.select().from(sector)).toEqual([]);
  });
});

describe("renameSector com cor", () => {
  it("troca nome e cor juntos", async () => {
    const created = await insertSector(db, "Velho", { color: "lilac" });

    const result = await renameSector(db, {
      id: created.id,
      name: "Novo",
      color: "pink",
    });

    expect(result).toEqual({ ok: true });
    const [row] = await db
      .select()
      .from(sector)
      .where(eq(sector.id, created.id));
    expect(row).toMatchObject({ name: "Novo", color: "pink" });
  });

  it("troca só a cor (o nome fica igual e não colide com ele mesmo)", async () => {
    const created = await insertSector(db, "Pátio", { color: "lilac" });

    const result = await renameSector(db, {
      id: created.id,
      name: "Pátio",
      color: "sky",
    });

    expect(result).toEqual({ ok: true });
    expect(await colorOf(created.id)).toBe("sky");
  });

  it("cor fora da paleta volta INVALID_INPUT e não mexe no setor", async () => {
    const created = await insertSector(db, "Pátio", { color: "peach" });

    const result = await renameSector(db, {
      id: created.id,
      name: "Outro",
      color: INVALID,
    });

    expect(result).toEqual({
      ok: false,
      code: "INVALID_INPUT",
      message: SECTOR_COLOR_INVALID_MESSAGE,
      fieldErrors: { color: SECTOR_COLOR_INVALID_MESSAGE },
    });
    const [row] = await db
      .select()
      .from(sector)
      .where(eq(sector.id, created.id));
    expect(row).toMatchObject({ name: "Pátio", color: "peach" });
  });

  it("nome repetido não troca a cor", async () => {
    await insertSector(db, "ULD", { color: "lilac" });
    const other = await insertSector(db, "Pátio", { color: "peach" });

    const result = await renameSector(db, {
      id: other.id,
      name: "uld",
      color: "pink",
    });

    expect(result).toMatchObject({ ok: false, code: "NAME_TAKEN" });
    expect(await colorOf(other.id)).toBe("peach");
  });

  it("id inexistente é NOT_FOUND", async () => {
    expect(
      await renameSector(db, {
        id: "00000000-0000-4000-8000-000000000000",
        name: "X",
        color: "sky",
      }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("a cor nas listas", () => {
  it("listSectors devolve a cor de cada setor", async () => {
    await insertSector(db, "Alfa", { color: "green" });
    await insertSector(db, "Bravo", { color: "pink", active: false });

    const page = await listSectors(db, { page: 1 }, NOW);

    expect(page.rows.map((row) => [row.name, row.color])).toEqual([
      ["Alfa", "green"],
      ["Bravo", "pink"],
    ]);
  });

  it("listActiveSectors devolve a cor e deixa os inativos de fora", async () => {
    const alfa = await insertSector(db, "Alfa", { color: "sky" });
    await insertSector(db, "Inativo", { color: "pink", active: false });

    expect(await listActiveSectors(db)).toEqual([
      { id: alfa.id, name: "Alfa", color: "sky" },
    ]);
  });
});

describe("suggestColorForNewSector", () => {
  it("nenhum setor: lilac", async () => {
    expect(await suggestColorForNewSector(db)).toBe("lilac");
  });

  it("devolve a primeira cor livre da paleta entre os setores ativos", async () => {
    await insertSector(db, "A", { color: "lilac" });
    expect(await suggestColorForNewSector(db)).toBe("peach");

    await insertSector(db, "B", { color: "sky" });
    expect(await suggestColorForNewSector(db)).toBe("peach");

    await insertSector(db, "C", { color: "peach" });
    expect(await suggestColorForNewSector(db)).toBe("green");
  });

  it("ignora os setores inativos (a cor deles volta a ficar livre)", async () => {
    await insertSector(db, "Ativo", { color: "peach" });
    await insertSector(db, "Parado", { color: "lilac", active: false });

    expect(await suggestColorForNewSector(db)).toBe("lilac");
  });

  it("todas em uso: a menos usada entre os ativos, empate pela ordem da paleta", async () => {
    const colors: SectorColor[] = ["lilac", "peach", "sky", "green", "pink"];
    for (const color of colors) {
      await insertSector(db, `Setor ${color}`, { color });
    }
    // Empate total: a primeira da paleta.
    expect(await suggestColorForNewSector(db)).toBe("lilac");

    await insertSector(db, "Mais um lilás", { color: "lilac" });
    await insertSector(db, "Mais um pêssego", { color: "peach" });
    // lilac e peach duas vezes; sky, green e pink uma: sky vem primeiro na paleta.
    expect(await suggestColorForNewSector(db)).toBe("sky");
  });

  it("todas em uso só porque há inativos: a cor livre ainda aparece", async () => {
    const colors: SectorColor[] = ["lilac", "peach", "sky", "green", "pink"];
    for (const color of colors) {
      await insertSector(db, `Setor ${color}`, {
        color,
        active: color !== "green",
      });
    }

    expect(await suggestColorForNewSector(db)).toBe("green");
  });
});
```

Em `src/features/admin/schemas.test.ts`, as quatro mudanças (Edit com texto exato):

1. O teste `"criar: nome normalizado; sobra de chave é descartada"` vira:

```ts
  it("criar: nome normalizado e cor; sobra de chave é descartada", () => {
    expect(
      createSectorSchema.parse({ name: " ULD ", color: "sky", admin: true }),
    ).toEqual({ name: "ULD", color: "sky" });
    expect(createDestinationSchema.parse({ name: "Almoxarifado" })).toEqual({
      name: "Almoxarifado",
    });
  });

  it("criar: aceita as cinco cores e recusa o resto, com mensagem em português", () => {
    for (const color of ["lilac", "peach", "sky", "green", "pink"]) {
      expect(
        createSectorSchema.safeParse({ name: "ULD", color }).success,
        color,
      ).toBe(true);
    }
    for (const color of ["red", "", "Lilac", " lilac", 1, null, undefined]) {
      expect(errorsOf(createSectorSchema, { name: "ULD", color }), String(color)).toEqual({
        color: "Escolha uma das cores da lista.",
      });
    }
  });
```

2. O teste `"renomear exige id e nome"` vira:

```ts
  it("renomear exige id, nome e cor", () => {
    expect(
      renameSectorSchema.safeParse({ id: ID, name: "ULD", color: "pink" })
        .success,
    ).toBe(true);
    expect(errorsOf(renameSectorSchema, { id: ID, name: "ULD" })).toEqual({
      color: "Escolha uma das cores da lista.",
    });
    expect(
      errorsOf(renameSectorSchema, { id: "x", name: "", color: "red" }),
    ).toEqual({
      id: "Registro inválido. Atualize a página.",
      name: "Informe o nome.",
      color: "Escolha uma das cores da lista.",
    });
    expect(errorsOf(renameDestinationSchema, { id: ID, name: "" })).toEqual({
      name: "Informe o nome.",
    });
  });
```

3. No bloco `"nenhuma mensagem sai em inglês"`, o objeto `wrongTypes` ganha `color: 1,` (depois de `kind: 1,`).

4. O teste `"devolve só a primeira mensagem de cada campo"` (`createSectorSchema.safeParse({ name: "a".repeat(100) })`) passa a mandar a cor para continuar provando só o nome: `createSectorSchema.safeParse({ name: "a".repeat(100), color: "sky" })`.

Em `src/features/admin/sectors.test.ts` (testes que já existiam e agora precisam de cor; nenhum teste novo aqui, os novos estão em `sectorColor.test.ts`):

```bash
sed -i -E 's/createSector\(db, \{ name(: [^}]*)? \}\)/createSector(db, { name\1, color: "lilac" })/g; s/renameSector\(db, \{ ([^}]*) \}\)/renameSector(db, { \1, color: "lilac" })/g' src/features/admin/sectors.test.ts
```

e, à mão, a chamada de várias linhas do teste `"renomeia e normaliza"`:

```ts
    const result = await renameSector(db, {
      id: created.id,
      name: "  Novo   nome ",
      color: "lilac",
    });
```

e o teste `"devolve só id e name"` de `listActiveSectors` (renomeie o título e o esperado):

```ts
  it("devolve só id, name e color", async () => {
    const created = await insertSector(db, "Alfa");

    expect(await listActiveSectors(db)).toEqual([
      { id: created.id, name: "Alfa", color: "lilac" },
    ]);
  });
```

e os literais de `resolveSectorFilter` (são `SectorChoice`):

```ts
  const alfa = { id: "a", name: "Alfa", color: "lilac" } as const;
  const bravo = { id: "b", name: "Bravo", color: "peach" } as const;
```

Em `src/app/(app)/admin/setores/actions.test.ts` as chamadas válidas passam a levar a cor:

```bash
sed -i -E 's/(createSectorAction|renameSectorAction)\(\{ ([^}]*) \}\)/\1({ \2, color: "lilac" })/g' "src/app/(app)/admin/setores/actions.test.ts"
```

(O `createSectorAction({})` e o `null` continuam como estão: o padrão exige `{ ` com espaço.) Confira com `git diff --stat` que só linhas de chamada mudaram.

Write `src/app/(app)/admin/setores/actionsColor.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { sector } from "@/db/schema/sectors";
import { authzOf } from "../../../../../test/authz";
import { createTestDb, resetDb, type TestDb } from "../../../../../test/db";
import { insertSector } from "../../../../../test/fixtures";

// Mesmo arranjo de actions.test.ts: o banco de verdade (PGlite) entra no lugar de
// "@/db" por um getter; operador recebe o mesmo 404 do requireAdmin.
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  database: { current: undefined as unknown },
  touched: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db", () => ({
  get db() {
    mocks.touched();
    return mocks.database.current;
  },
}));

import { createSectorAction, renameSectorAction } from "./actions";

const NOT_FOUND = Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;404"), {
  digest: "NEXT_HTTP_ERROR_FALLBACK;404",
});
const COLOR_ERROR = "Escolha uma das cores da lista.";

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
  mocks.database.current = db;
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
  mocks.requireAdmin.mockReset();
  mocks.revalidatePath.mockReset();
  mocks.touched.mockReset();
  mocks.requireAdmin.mockResolvedValue(authzOf({ role: "admin" }));
});

async function colorOf(id: string): Promise<string | undefined> {
  const [row] = await db
    .select({ color: sector.color })
    .from(sector)
    .where(eq(sector.id, id));
  return row?.color;
}

describe("a cor nas actions de setor: operador", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockRejectedValue(NOT_FOUND);
  });

  it("createSectorAction com cor recebe notFound e não toca o banco", async () => {
    await expect(
      createSectorAction({ name: "Novo", color: "pink" }),
    ).rejects.toBe(NOT_FOUND);

    expect(mocks.touched).not.toHaveBeenCalled();
    expect(await db.select().from(sector)).toEqual([]);
  });

  it("renameSectorAction com cor recebe notFound e a cor não muda", async () => {
    const created = await insertSector(db, "Original", { color: "sky" });

    await expect(
      renameSectorAction({ id: created.id, name: "Original", color: "pink" }),
    ).rejects.toBe(NOT_FOUND);

    expect(mocks.touched).not.toHaveBeenCalled();
    expect(await colorOf(created.id)).toBe("sky");
  });
});

describe("createSectorAction com cor", () => {
  it("grava a cor escolhida", async () => {
    const result = await createSectorAction({ name: "Pátio", color: "green" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await colorOf(result.id)).toBe("green");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)/admin", "layout");
  });

  it("cor fora da paleta volta INVALID_INPUT no campo color, sem gravar nem revalidar", async () => {
    expect(await createSectorAction({ name: "Pátio", color: "red" })).toEqual({
      ok: false,
      code: "INVALID_INPUT",
      message: COLOR_ERROR,
      fieldErrors: { color: COLOR_ERROR },
    });
    expect(await db.select().from(sector)).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("sem cor (campo ausente) é recusado: o servidor nunca escolhe a cor", async () => {
    expect(await createSectorAction({ name: "Pátio" })).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { color: COLOR_ERROR },
    });
    expect(await db.select().from(sector)).toEqual([]);
  });

  it("cor com tipo errado (número, nulo) é recusada", async () => {
    for (const color of [1, null, ["lilac"], { key: "lilac" }]) {
      expect(await createSectorAction({ name: "Pátio", color })).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
      });
    }
    expect(await db.select().from(sector)).toEqual([]);
  });
});

describe("renameSectorAction com cor", () => {
  it("troca a cor do setor", async () => {
    const created = await insertSector(db, "Pátio", { color: "lilac" });

    expect(
      await renameSectorAction({ id: created.id, name: "Pátio", color: "pink" }),
    ).toEqual({ ok: true });
    expect(await colorOf(created.id)).toBe("pink");
  });

  it("cor fora da paleta é recusada e a cor atual continua", async () => {
    const created = await insertSector(db, "Pátio", { color: "peach" });

    expect(
      await renameSectorAction({ id: created.id, name: "Pátio", color: "red" }),
    ).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { color: COLOR_ERROR },
    });
    expect(await colorOf(created.id)).toBe("peach");
  });

  it("sem cor é recusado (o formulário sempre manda)", async () => {
    const created = await insertSector(db, "Pátio", { color: "peach" });

    expect(
      await renameSectorAction({ id: created.id, name: "Novo" }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(await colorOf(created.id)).toBe("peach");
  });
});
```

- [ ] **Step 16: Rodar e ver falhar**

Run: `bunx vitest run src/features/admin/sectorColor.test.ts src/features/admin/schemas.test.ts "src/app/(app)/admin/setores/actionsColor.test.ts"`
Expected: FAIL (`SECTOR_COLOR_INVALID_MESSAGE` e `suggestColorForNewSector` não existem; os schemas ainda aceitam entrada sem cor).

- [ ] **Step 17: Implementar a mensagem, os schemas e o domínio**

`src/features/admin/messages.ts`: depois da linha `export const SECTOR_REQUIRED_MESSAGE = "Escolha o setor do operador.";` acrescente:

```ts
export const SECTOR_COLOR_INVALID_MESSAGE = "Escolha uma das cores da lista.";
```

`src/features/admin/schemas.ts`:

1. No import de `./messages`, junte `SECTOR_COLOR_INVALID_MESSAGE`:

```ts
import {
  INVITE_LABEL_TOO_LONG_MESSAGE,
  SECTOR_COLOR_INVALID_MESSAGE,
  SECTOR_REQUIRED_MESSAGE,
} from "./messages";
```

2. Acrescente o import da paleta (junto dos outros `@/`):

```ts
import { SECTOR_COLORS } from "@/features/sectors/colors";
```

3. Depois de `const textSchema = ...;` acrescente:

```ts
// Só as chaves da paleta (D-V3). Mensagem própria em português para qualquer valor fora dela
// (ausente, tipo errado ou outra cor): a tela só oferece as cinco, então isso é defesa.
const sectorColorSchema = z.enum(SECTOR_COLORS, {
  error: SECTOR_COLOR_INVALID_MESSAGE,
});
```

4. Troque as duas linhas dos schemas de setor:

```ts
export const createSectorSchema = z.object({
  name: nameSchema,
  color: sectorColorSchema,
});
export const renameSectorSchema = z.object({
  id: idSchema,
  name: nameSchema,
  color: sectorColorSchema,
});
```

`src/features/admin/sectors.ts`: o arquivo muda assim (trechos com o contexto para achar o lugar).

Imports (o bloco inteiro do topo, no estado final):

```ts
import "server-only";

import { asc, count, desc, eq, sql } from "drizzle-orm";

import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import {
  isSectorColor,
  type SectorColor,
  suggestSectorColor,
} from "@/features/sectors/colors";
import { isUniqueViolation } from "./dbErrors";
import {
  nameTakenMessage,
  notFoundMessage,
  SECTOR_COLOR_INVALID_MESSAGE,
  sectorBlockedMessage,
} from "./messages";
import { validateName } from "./names";
import {
  CHOICE_LIST_LIMIT,
  PAGE_SIZE,
  type Page,
  resolvePage,
} from "./pagination";
import { type AdminResult, fail, ok } from "./result";
```

Tipos:

```ts
export type SectorRow = {
  id: string;
  name: string;
  color: SectorColor;
  active: boolean;
  activePeople: number;
  pendingInvites: number;
};

export type SectorChoice = { id: string; name: string; color: SectorColor };
```

`listSectors`: o `select` ganha `color: sector.color,` depois de `name: sector.name,`:

```ts
    .select({
      id: sector.id,
      name: sector.name,
      color: sector.color,
      active: sector.active,
      activePeople: activePeopleSql(),
      pendingInvites: pendingInvitesSql(now),
    })
```

`listActiveSectors`:

```ts
export async function listActiveSectors(db: Db): Promise<SectorChoice[]> {
  return db
    .select({ id: sector.id, name: sector.name, color: sector.color })
    .from(sector)
    .where(eq(sector.active, true))
    .orderBy(sql`lower(${sector.name})`, asc(sector.id))
    .limit(CHOICE_LIST_LIMIT);
}

// Cor que a tela de criação já traz marcada (o formulário nunca começa em branco): a primeira
// da paleta que nenhum setor ativo usa; se todas estão em uso, a menos usada. A regra é pura
// (`suggestSectorColor`); aqui só entram as cores dos setores ativos.
export async function suggestColorForNewSector(db: Db): Promise<SectorColor> {
  const rows = await db
    .select({ color: sector.color })
    .from(sector)
    .where(eq(sector.active, true));
  return suggestSectorColor(rows.map((row) => row.color));
}
```

`createSector` e `renameSector` (substituem as duas funções atuais; `nameTakenFailure` não muda):

```ts
function colorFailure() {
  return fail("INVALID_INPUT", SECTOR_COLOR_INVALID_MESSAGE, {
    color: SECTOR_COLOR_INVALID_MESSAGE,
  });
}

export async function createSector(
  db: Db,
  input: { name: string; color: SectorColor },
): Promise<AdminResult<{ id: string }>> {
  const checked = validateName(input.name);
  if (!checked.ok) {
    return fail("INVALID_INPUT", checked.message, { name: checked.message });
  }
  // A action já valida com o schema; isto protege quem chamar o domínio direto (o check do
  // banco é a última barreira e viraria erro 500).
  if (!isSectorColor(input.color)) return colorFailure();
  try {
    const [created] = await db
      .insert(sector)
      .values({ name: checked.name, color: input.color })
      .returning({ id: sector.id });
    if (!created) throw new Error("setor não criado");
    return ok({ id: created.id });
  } catch (error) {
    if (isUniqueViolation(error)) return nameTakenFailure(db, checked.name);
    throw error;
  }
}

// Edita nome e cor do setor (o nome da função vem da Fase 2; a cor entrou em 2026-11-27).
export async function renameSector(
  db: Db,
  input: { id: string; name: string; color: SectorColor },
): Promise<AdminResult> {
  const checked = validateName(input.name);
  if (!checked.ok) {
    return fail("INVALID_INPUT", checked.message, { name: checked.message });
  }
  if (!isSectorColor(input.color)) return colorFailure();
  try {
    const updated = await db
      .update(sector)
      .set({ name: checked.name, color: input.color })
      .where(eq(sector.id, input.id))
      .returning({ id: sector.id });
    if (updated.length === 0) {
      return fail("NOT_FOUND", notFoundMessage("setor"));
    }
    return ok();
  } catch (error) {
    if (isUniqueViolation(error)) return nameTakenFailure(db, checked.name);
    throw error;
  }
}
```

`SectorPicker.tsx` (só para o `check-types`; a Task 7 reescreve este trecho): troque

```ts
  const options: readonly SectorChoice[] = allowAll
```

por

```ts
  const options: readonly Pick<SectorChoice, "id" | "name">[] = allowAll
```

- [ ] **Step 18: Consertar os literais de teste tipados como `SectorChoice`**

Cada linha abaixo ganha `color` (qualquer cor da paleta serve; os testes não olham a cor). Edit com o texto exato:

- `src/components/admin/team/InviteForm.test.tsx` e `src/components/admin/team/PersonForm.test.tsx`:

```ts
const SECTOR_A: SectorChoice = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Almoxarifado",
  color: "lilac",
};
const SECTOR_B: SectorChoice = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Recebimento",
  color: "peach",
};
```

- `src/components/admin/team/PersonRowActions.test.tsx`:

```ts
const SECTOR: SectorChoice = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Almoxarifado",
  color: "lilac",
};
```

- `src/components/admin/SectorSwitcher.test.tsx`:

```ts
const uld = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "ULD",
  color: "lilac",
} as const;
const gelo = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Água & Gelo",
  color: "peach",
} as const;
```

- `src/features/handovers/sectorChoice.test.ts`:

```ts
const ULD = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "ULD",
  color: "lilac",
} as const;
const CARGA = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Carga",
  color: "peach",
} as const;
```

- `src/components/passagens/SectorPicker.test.tsx` (a Task 7 reescreve este arquivo; aqui só para compilar):

```ts
const ULD = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "ULD",
  color: "lilac",
} as const;
const CARGA = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Carga",
  color: "peach",
} as const;
```

- `src/features/handovers/screenSector.test.ts` (compara com `toEqual` o que vem de `listActiveSectors`, que agora leva a cor; os setores vêm de `insertSector`, cor padrão `lilac`): nos dois `sectors: [...]` esperados,

```ts
      sectors: [
        { id: camara.id, name: "Câmara Teste", color: "lilac" },
        { id: uld.id, name: "ULD Teste", color: "lilac" },
      ],
```

e

```ts
      sectors: [{ id: uld.id, name: "ULD Teste", color: "lilac" }],
```

- `src/components/admin/team/TeamAdmin.test.tsx` (mock sem tipo; só para refletir o dado real):

```ts
  mocks.listActiveSectors.mockResolvedValue([
    { id: SECTOR_ID, name: "Almoxarifado", color: "lilac" },
  ]);
```

- `src/components/solicitacoes/RequestForm.test.tsx` (o `setup` passa `sectors` ao `RequestForm`, cujo tipo é `readonly SectorChoice[] | null`; sem a cor o `check-types` acusa). Acrescente `import type { SectorChoice } from "@/features/admin/sectors";` aos imports, troque no `setup` (linha 79)

```ts
    sectors?: { id: string; name: string }[] | null;
```

por

```ts
    sectors?: SectorChoice[] | null;
```

e, no `describe("admin", ...)` (linhas 283-286):

```ts
    const SECTORS: SectorChoice[] = [
      { id: SECTOR_A, name: "Almoxarifado Teste", color: "lilac" },
      { id: SECTOR_B, name: "Outro Setor", color: "peach" },
    ];
```

Depois rode `bun run check-types`. Se ele apontar outro literal `{ id, name }` passado onde se espera `SectorChoice`/`SectorRow` (por exemplo `SectorRow` em `SectorRowActions.test.tsx` e `SectorsAdmin.test.tsx`, que a Task 6 corrige), conserte do mesmo jeito. Os dois arquivos da Task 6 falham o tipo até o Step 1 da Task 6; **por isso o `check-types` desta tarefa só fica 100% verde depois da Task 6**: rode-o aqui e confirme que os únicos erros restantes estão em `SectorRowActions.test.tsx`, `SectorsAdmin.test.tsx`, `SectorCreateForm.tsx`/`SectorRowActions.tsx` (chamam as actions sem `color`) e nenhum outro arquivo.

Nota: como `actions.ts` não muda e os componentes chamam `createSectorAction({ name })`, o `check-types` não acusa (a action recebe `unknown`); em tempo de execução as chamadas dos componentes passam a ser recusadas pelo schema até a Task 6. Por isso as Tasks 5 e 6 entram na mesma branch e a Task 6 não pode ser pulada.

- [ ] **Step 19: Rodar e ver passar (tudo que a tarefa toca)**

Run: `bunx biome check --write src/features/sectors src/features/admin/sectors.ts src/features/admin/sectors.test.ts src/features/admin/sectorColor.test.ts src/features/admin/schemas.ts src/features/admin/schemas.test.ts src/features/admin/messages.ts src/features/admin/dbErrors.test.ts src/db/schema/sectors.ts src/db/schema/sectors.test.ts src/db/schema/migration0005.test.ts test/fixtures.ts test/fixtures.test.ts test/db.test.ts "src/app/(app)/admin/setores/actions.test.ts" "src/app/(app)/admin/setores/actionsColor.test.ts" src/components/passagens/SectorPicker.tsx src/components/passagens/SectorPicker.test.tsx src/components/admin/team src/components/admin/SectorSwitcher.test.tsx src/features/handovers/sectorChoice.test.ts src/features/handovers/screenSector.test.ts src/components/solicitacoes/RequestForm.test.tsx`
Expected: `Checked N files ... Fixed M files` (formata e reordena imports; a pasta `drizzle/` fica fora do Biome).

Run: `bunx vitest run src/features/sectors src/features/admin src/db/schema test/db.test.ts test/fixtures.test.ts "src/app/(app)/admin/setores/actions.test.ts" "src/app/(app)/admin/setores/actionsColor.test.ts" src/features/handovers/sectorChoice.test.ts src/features/handovers/screenSector.test.ts src/components/admin/SectorSwitcher.test.tsx src/components/admin/team src/components/passagens/SectorPicker.test.tsx src/components/solicitacoes/RequestForm.test.tsx`
Expected: PASS em todos (a suíte inteira não é rodada aqui).

Run: `bun run lint`
Expected: sem erros.

Testes existentes que mencionam o que a tarefa tocou e que **não** precisam mudar (conferi por `grep -rl "insertSector\|listActiveSectors\|createSector\|renameSector" src test e2e`): todos os que usam `insertSector` sem opções (cor padrão `lilac`), `ItemsAdmin.test.tsx`/`ShiftsAdmin.test.tsx` (mockam o loader), `scope.test.ts`, `loaders.test.ts`. Rode também, para ter certeza, os que usam `listActiveSectors` de verdade: `bunx vitest run src/features/dashboard/scope.test.ts src/features/handovers/loaders.test.ts`.

- [ ] **Step 20: Commit**

Write `.git/sdd/visual/msg-task-5.txt`:

```
feat(setores): cor do setor (schema, migração, paleta e validação)

Coluna sector.color com check sector_color_valid; a migração 0005 foi editada à mão
para preencher os setores existentes pela ordem de created_at antes do NOT NULL.
colors.ts concentra a paleta, os rótulos, as classes e a sugestão de cor.
createSector e renameSector gravam a cor; suggestColorForNewSector lê os setores ativos.
A migração não foi aplicada no Neon.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Run: `git add src/features/sectors drizzle src/db/schema src/features/admin test src/app/\(app\)/admin/setores/actions.test.ts src/app/\(app\)/admin/setores/actionsColor.test.ts src/components/passagens/SectorPicker.tsx src/components/passagens/SectorPicker.test.tsx src/components/admin/team src/components/admin/SectorSwitcher.test.tsx src/features/handovers/sectorChoice.test.ts src/features/handovers/screenSector.test.ts src/components/solicitacoes/RequestForm.test.tsx && git commit -F .git/sdd/visual/msg-task-5.txt`

Se o hook de commit reclamar do `check-types` por causa dos componentes da Task 6, faça os dois commits em sequência: a regra é "tarefa termina verde", então rode a Task 6 inteira antes de empurrar a branch.

---

### Task 6: Tela Setores — escolha de cor na criação e na edição

**Files:**
- Create: `src/components/admin/sectors/SectorColorChoice.tsx`
- Create: `src/components/admin/sectors/SectorColorChoice.test.tsx`
- Modify: `src/components/admin/NameForm.tsx` (slot `children` entre o campo e o botão)
- Modify: `src/components/admin/NameForm.test.tsx` (teste do slot)
- Modify: `src/components/admin/sectors/SectorCreateForm.tsx` (+ `.test.tsx`)
- Modify: `src/components/admin/sectors/SectorRowActions.tsx` (+ `.test.tsx`)
- Modify: `src/components/admin/sectors/SectorsAdmin.tsx` (+ `.test.tsx`): calcula a cor sugerida
- Modify: `e2e/cadastros.spec.ts` (cenário (a): escolher cor, persistir, editar)
- Modify: `.context/ui-registry.md` (entrada `SectorColorChoice` + Históricos)
- Test: os arquivos acima e `test/uiRegistryDoc.test.ts` (guarda do catálogo; não muda)

**Interfaces:**
- Consumes (Task 5): `SECTOR_COLORS`, `SECTOR_COLOR_LABELS`, `SECTOR_COLOR_BG`, `SectorColor` (`@/features/sectors/colors`); `SectorRow` com `color`; `suggestColorForNewSector(db)`; `createSectorAction`/`renameSectorAction` (validam `color`). Consumes (Task 4): nada de `Button` novo (o botão de enviar continua `Button` padrão).
- Produces:
  ```tsx
  // src/components/admin/sectors/SectorColorChoice.tsx ("use client")
  export function SectorColorChoice(props: {
    defaultValue: SectorColor;
    onValueChange?: (color: SectorColor) => void;
    name?: string;      // padrão "color"
    legend?: string;    // padrão "Cor"
    disabled?: boolean;
  }): JSX.Element;
  // NameForm ganha: children?: ReactNode (renderizado entre o campo de nome e o botão)
  // SectorCreateForm({ suggestedColor }: { suggestedColor: SectorColor })
  ```

- [ ] **Step 1: Escrever os testes que falham**

Write `src/components/admin/sectors/SectorColorChoice.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SectorColorChoice } from "@/components/admin/sectors/SectorColorChoice";
import { SECTOR_COLORS } from "@/features/sectors/colors";

describe("SectorColorChoice", () => {
  it("é um grupo de escolha 'Cor' com as cinco opções, cada uma com o nome escrito", () => {
    render(<SectorColorChoice defaultValue="lilac" />);

    const group = screen.getByRole("radiogroup", { name: "Cor" });
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(SECTOR_COLORS.length);
    expect(radios.map((radio) => radio.textContent)).toEqual([
      "Lilás",
      "Pêssego",
      "Azul",
      "Verde",
      "Rosa",
    ]);
    for (const radio of radios) expect(group).toContainElement(radio);
  });

  it("cada opção mostra uma amostra de 16px com a classe da cor, e a amostra não é lida", () => {
    render(<SectorColorChoice defaultValue="lilac" />);

    const expected = [
      ["Lilás", "bg-sector-lilac"],
      ["Pêssego", "bg-sector-peach"],
      ["Azul", "bg-sector-sky"],
      ["Verde", "bg-sector-green"],
      ["Rosa", "bg-sector-pink"],
    ] as const;
    for (const [label, bg] of expected) {
      const swatch = screen
        .getByRole("radio", { name: label })
        .querySelector("[data-slot='sector-color-swatch']");
      expect(swatch, label).not.toBeNull();
      expect(swatch).toHaveClass(bg, "size-4");
      expect(swatch).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("começa com a cor do defaultValue marcada, e só ela", () => {
    render(<SectorColorChoice defaultValue="sky" />);

    expect(screen.getByRole("radio", { name: "Azul" })).toBeChecked();
    for (const label of ["Lilás", "Pêssego", "Verde", "Rosa"]) {
      expect(screen.getByRole("radio", { name: label })).not.toBeChecked();
    }
  });

  it("clicar em outra cor marca ela, desmarca a anterior e avisa com a chave", async () => {
    const onValueChange = vi.fn();
    render(
      <SectorColorChoice defaultValue="lilac" onValueChange={onValueChange} />,
    );

    await userEvent.click(screen.getByRole("radio", { name: "Rosa" }));

    expect(screen.getByRole("radio", { name: "Rosa" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Lilás" })).not.toBeChecked();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("pink");
  });

  it("clicar na cor já marcada não desmarca (nunca fica sem cor)", async () => {
    const onValueChange = vi.fn();
    render(
      <SectorColorChoice defaultValue="green" onValueChange={onValueChange} />,
    );

    await userEvent.click(screen.getByRole("radio", { name: "Verde" }));

    expect(screen.getByRole("radio", { name: "Verde" })).toBeChecked();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("desabilitado: nada muda ao clicar", async () => {
    const onValueChange = vi.fn();
    render(
      <SectorColorChoice
        defaultValue="lilac"
        disabled
        onValueChange={onValueChange}
      />,
    );

    await userEvent.click(screen.getByRole("radio", { name: "Azul" }));

    expect(screen.getByRole("radio", { name: "Lilás" })).toBeChecked();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("a legenda pode ser trocada", () => {
    render(<SectorColorChoice defaultValue="lilac" legend="Cor do setor" />);

    expect(
      screen.getByRole("radiogroup", { name: "Cor do setor" }),
    ).toBeInTheDocument();
  });
});
```

Em `src/components/admin/NameForm.test.tsx` acrescente (dentro do `describe("NameForm", ...)`, depois do último `it`):

```tsx
  it("mostra o que vem em children entre o campo e o botão", () => {
    render(
      <NameForm
        entity="setor"
        initialName=""
        submitLabel="Criar setor"
        onSubmit={vi.fn()}
      >
        <p>Escolha extra</p>
      </NameForm>,
    );

    const extra = screen.getByText("Escolha extra");
    const field = screen.getByLabelText("Nome do setor");
    const button = screen.getByRole("button", { name: "Criar setor" });
    expect(
      field.compareDocumentPosition(extra) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      extra.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
```

Substitua `src/components/admin/sectors/SectorCreateForm.test.tsx` por (mesmos casos de antes, agora com a cor, e os novos):

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SectorCreateForm } from "@/components/admin/sectors/SectorCreateForm";

const mocks = vi.hoisted(() => ({
  createSectorAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/setores/actions", () => ({
  createSectorAction: mocks.createSectorAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

describe("SectorCreateForm", () => {
  beforeEach(() => {
    mocks.createSectorAction.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
  });

  it("mostra o campo 'Nome do setor' vazio, a cor sugerida marcada e o botão 'Criar setor'", () => {
    render(<SectorCreateForm suggestedColor="sky" />);

    expect(screen.getByLabelText("Nome do setor")).toHaveValue("");
    expect(screen.getByRole("radiogroup", { name: "Cor" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Azul" })).toBeChecked();
    expect(screen.getAllByRole("radio", { checked: true })).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Criar setor" }),
    ).toBeInTheDocument();
  });

  it("cria o setor com a cor sugerida sem a pessoa tocar na cor", async () => {
    mocks.createSectorAction.mockResolvedValue({ ok: true, id: "s1" });
    render(<SectorCreateForm suggestedColor="peach" />);

    await userEvent.type(screen.getByLabelText("Nome do setor"), "  Pátio ");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Setor criado."),
    );
    expect(mocks.createSectorAction).toHaveBeenCalledWith({
      name: "Pátio",
      color: "peach",
    });
    expect(screen.getByLabelText("Nome do setor")).toHaveValue("");
  });

  it("cria o setor com a cor que a pessoa escolheu", async () => {
    mocks.createSectorAction.mockResolvedValue({ ok: true, id: "s1" });
    render(<SectorCreateForm suggestedColor="lilac" />);

    await userEvent.type(screen.getByLabelText("Nome do setor"), "Pátio");
    await userEvent.click(screen.getByRole("radio", { name: "Rosa" }));
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    await waitFor(() =>
      expect(mocks.createSectorAction).toHaveBeenCalledWith({
        name: "Pátio",
        color: "pink",
      }),
    );
  });

  it("depois de criar, a cor volta à sugerida (o formulário não começa em branco nem repete a escolha)", async () => {
    mocks.createSectorAction.mockResolvedValue({ ok: true, id: "s1" });
    render(<SectorCreateForm suggestedColor="lilac" />);

    await userEvent.type(screen.getByLabelText("Nome do setor"), "Pátio");
    await userEvent.click(screen.getByRole("radio", { name: "Verde" }));
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Setor criado."),
    );
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Lilás" })).toBeChecked(),
    );
    expect(screen.getByRole("radio", { name: "Verde" })).not.toBeChecked();
  });

  it("quando a sugestão do servidor muda (tela recarregada), a cor marcada acompanha", () => {
    const { rerender } = render(<SectorCreateForm suggestedColor="lilac" />);
    expect(screen.getByRole("radio", { name: "Lilás" })).toBeChecked();

    rerender(<SectorCreateForm suggestedColor="peach" />);

    expect(screen.getByRole("radio", { name: "Pêssego" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Lilás" })).not.toBeChecked();
  });

  it("nome vazio mostra o erro sem chamar o servidor", async () => {
    render(<SectorCreateForm suggestedColor="lilac" />);

    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Informe o nome.",
    );
    expect(mocks.createSectorAction).not.toHaveBeenCalled();
  });

  it("nome com 61 caracteres mostra o erro de tamanho", async () => {
    render(<SectorCreateForm suggestedColor="lilac" />);

    await userEvent.click(screen.getByLabelText("Nome do setor"));
    await userEvent.paste("a".repeat(61));
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O nome pode ter no máximo 60 caracteres.",
    );
    expect(mocks.createSectorAction).not.toHaveBeenCalled();
  });

  it("quando o servidor recusa, mostra a mensagem e preserva o nome e a cor escolhidos", async () => {
    mocks.createSectorAction.mockResolvedValue({
      ok: false,
      code: "NAME_TAKEN",
      message: "Já existe um setor com este nome.",
      fieldErrors: { name: "Já existe um setor com este nome." },
    });
    render(<SectorCreateForm suggestedColor="lilac" />);

    await userEvent.type(screen.getByLabelText("Nome do setor"), "ULD");
    await userEvent.click(screen.getByRole("radio", { name: "Azul" }));
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe um setor com este nome.",
    );
    expect(screen.getByLabelText("Nome do setor")).toHaveValue("ULD");
    expect(screen.getByRole("radio", { name: "Azul" })).toBeChecked();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("falha de rede mostra a mensagem genérica e preserva o texto", async () => {
    mocks.createSectorAction.mockRejectedValue(new Error("fetch failed"));
    render(<SectorCreateForm suggestedColor="lilac" />);

    await userEvent.type(screen.getByLabelText("Nome do setor"), "ULD");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir. Tente de novo.",
    );
    expect(screen.getByLabelText("Nome do setor")).toHaveValue("ULD");
  });
});
```

Em `src/components/admin/sectors/SectorRowActions.test.tsx`:

1. `SECTOR` ganha a cor: `color: "green",` (depois de `name: "Pátio",`).
2. O teste `"Editar abre o diálogo 'Editar setor' com o nome atual e salva"` vira:

```tsx
  it("Editar abre o diálogo 'Editar setor' com o nome e a cor atuais e salva", async () => {
    mocks.renameSectorAction.mockResolvedValue({ ok: true });
    render(<SectorRowActions sector={SECTOR} />);

    await userEvent.click(screen.getByRole("button", { name: "Editar Pátio" }));

    const dialog = await screen.findByRole("dialog", { name: "Editar setor" });
    const field = screen.getByLabelText("Nome do setor");
    expect(field).toHaveValue("Pátio");
    expect(screen.getByRole("radio", { name: "Verde" })).toBeChecked();

    await userEvent.clear(field);
    await userEvent.type(field, "Pátio Norte");
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Alterações salvas."),
    );
    expect(mocks.renameSectorAction).toHaveBeenCalledWith({
      id: "s1",
      name: "Pátio Norte",
      color: "green",
    });
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("trocar só a cor e salvar manda o nome atual e a cor nova", async () => {
    mocks.renameSectorAction.mockResolvedValue({ ok: true });
    render(<SectorRowActions sector={SECTOR} />);

    await userEvent.click(screen.getByRole("button", { name: "Editar Pátio" }));
    await screen.findByRole("dialog", { name: "Editar setor" });
    await userEvent.click(screen.getByRole("radio", { name: "Rosa" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    await waitFor(() =>
      expect(mocks.renameSectorAction).toHaveBeenCalledWith({
        id: "s1",
        name: "Pátio",
        color: "pink",
      }),
    );
  });

  it("fechar o diálogo sem salvar descarta a cor trocada: ao reabrir, volta a atual", async () => {
    render(<SectorRowActions sector={SECTOR} />);

    await userEvent.click(screen.getByRole("button", { name: "Editar Pátio" }));
    await screen.findByRole("dialog", { name: "Editar setor" });
    await userEvent.click(screen.getByRole("radio", { name: "Azul" }));
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: "Editar Pátio" }));
    await screen.findByRole("dialog", { name: "Editar setor" });
    expect(screen.getByRole("radio", { name: "Verde" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Azul" })).not.toBeChecked();
    expect(mocks.renameSectorAction).not.toHaveBeenCalled();
  });
```

3. No teste `"nome repetido na edição mantém o diálogo aberto com o erro"`, acrescente ao final:

```tsx
    expect(screen.getByRole("radio", { name: "Verde" })).toBeChecked();
```

Em `src/components/admin/sectors/SectorsAdmin.test.tsx`:

1. `mocks` ganha `suggestColorForNewSector: vi.fn(),`:

```tsx
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listSectors: vi.fn(),
  suggestColorForNewSector: vi.fn(),
}));
```

2. O mock do módulo:

```tsx
vi.mock("@/features/admin/sectors", () => ({
  listSectors: mocks.listSectors,
  suggestColorForNewSector: mocks.suggestColorForNewSector,
}));
```

3. `row()` ganha `color: "lilac",` (depois de `name: "ULD",`).
4. No `beforeEach`, depois do `mockResolvedValue({ role: "admin" })`:

```tsx
    mocks.suggestColorForNewSector.mockReset();
    mocks.suggestColorForNewSector.mockResolvedValue("lilac");
```

5. Novos testes (dentro do `describe("SectorsAdmin", ...)`):

```tsx
  it("o formulário de criação já vem com a cor sugerida pelo servidor marcada", async () => {
    mocks.listSectors.mockResolvedValue(page([row()]));
    mocks.suggestColorForNewSector.mockResolvedValue("green");

    render(await SectorsAdmin({ searchParams: NO_PARAMS }));

    expect(screen.getByRole("radiogroup", { name: "Cor" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Verde" })).toBeChecked();
    expect(screen.getAllByRole("radio", { checked: true })).toHaveLength(1);
    expect(mocks.suggestColorForNewSector).toHaveBeenCalledWith({});
  });

  it("sem setores ainda, a sugestão também aparece (primeiro setor: a primeira cor)", async () => {
    mocks.listSectors.mockResolvedValue(page([]));

    render(await SectorsAdmin({ searchParams: NO_PARAMS }));

    expect(screen.getByRole("radio", { name: "Lilás" })).toBeChecked();
  });

  it("operador (sem acesso): nenhuma leitura de cor acontece antes do portão", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("404"));

    await expect(SectorsAdmin({ searchParams: NO_PARAMS })).rejects.toThrow(
      "404",
    );

    expect(mocks.listSectors).not.toHaveBeenCalled();
    expect(mocks.suggestColorForNewSector).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bunx vitest run src/components/admin/sectors src/components/admin/NameForm.test.tsx`
Expected: FAIL com "Failed to resolve import "@/components/admin/sectors/SectorColorChoice"" (e os outros arquivos falham por `color`/`suggestedColor`).

- [ ] **Step 3: Implementar `SectorColorChoice`**

Write `src/components/admin/sectors/SectorColorChoice.tsx`:

```tsx
"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { useId } from "react";

import { FieldLegend, FieldSet } from "@/components/ui/field";
import {
  SECTOR_COLOR_BG,
  SECTOR_COLOR_LABELS,
  SECTOR_COLORS,
  type SectorColor,
} from "@/features/sectors/colors";
import { cn } from "@/lib/utils";

// Escolha da cor do setor: cinco opções fixas, cada uma com a amostra (16px) E o nome
// (ui-rules §2.1: a cor nunca é a única pista). Conjunto fechado e conhecido, então é um
// grupo de escolha, nunca um campo de texto. Nunca fica sem cor: o grupo sempre nasce com
// uma marcada (`defaultValue`) e clicar na marcada não a desmarca. Não guarda a escolha
// em formulário nativo; quem usa lê `onValueChange` e remonta (`key`) para voltar ao padrão.
export function SectorColorChoice({
  defaultValue,
  onValueChange,
  name = "color",
  legend = "Cor",
  disabled = false,
}: {
  defaultValue: SectorColor;
  onValueChange?: (color: SectorColor) => void;
  name?: string;
  legend?: string;
  disabled?: boolean;
}) {
  const legendId = useId();

  return (
    <FieldSet>
      <FieldLegend id={legendId} variant="label">
        {legend}
      </FieldLegend>
      <RadioGroup
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        aria-labelledby={legendId}
        onValueChange={(next) => onValueChange?.(next)}
        className="flex flex-wrap gap-2"
      >
        {SECTOR_COLORS.map((color) => (
          <Radio.Root
            key={color}
            value={color}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border border-input bg-transparent px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none max-md:h-11",
              "hover:bg-muted focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
              "data-checked:border-foreground data-checked:bg-muted",
              "data-disabled:pointer-events-none data-disabled:opacity-50",
            )}
          >
            <span
              data-slot="sector-color-swatch"
              aria-hidden="true"
              className={cn(
                "size-4 shrink-0 rounded-full border border-foreground/20",
                SECTOR_COLOR_BG[color],
              )}
            />
            {SECTOR_COLOR_LABELS[color]}
          </Radio.Root>
        ))}
      </RadioGroup>
    </FieldSet>
  );
}
```

Detalhe a conferir ao rodar: o Base UI põe `data-checked` (sem valor) no `Radio.Root` marcado; se o teste de "marcada" passar mas o estilo não aparecer no navegador, confira o atributo no inspetor (a classe `data-checked:` do Tailwind 4 casa com a presença do atributo).

- [ ] **Step 4: `NameForm` ganha o slot e os dois formulários usam a cor**

`src/components/admin/NameForm.tsx`: troque o import do React e a assinatura, e renderize os `children` entre o campo e o botão.

```tsx
import { type FormEvent, type ReactNode, useId, useState } from "react";
```

```tsx
export function NameForm({
  entity,
  initialName,
  submitLabel,
  onSubmit,
  successMessage,
  onDone,
  children,
}: {
  entity: "setor" | "destino";
  initialName: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<AdminResult<object>>;
  successMessage?: string;
  onDone?: () => void;
  // Controles extras do mesmo formulário (ex.: a cor do setor), entre o nome e o botão.
  children?: ReactNode;
}) {
```

```tsx
        {error && <FieldError id={errorId}>{error}</FieldError>}
      </Field>
      {children}
      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
```

Write `src/components/admin/sectors/SectorCreateForm.tsx`:

```tsx
"use client";

import { useState } from "react";

import { createSectorAction } from "@/app/(app)/admin/setores/actions";
import { NameForm } from "@/components/admin/NameForm";
import { SectorColorChoice } from "@/components/admin/sectors/SectorColorChoice";
import type { SectorColor } from "@/features/sectors/colors";

// `suggestedColor` vem do servidor (`suggestColorForNewSector`): a cor já nasce marcada, o
// formulário nunca começa em branco. Depois de criar, a tela é revalidada e chega uma nova
// sugestão; a `key` remonta a escolha quando ela muda, e o `reset` cobre o caso em que a
// sugestão continua a mesma (a cor escolhida não "gruda" no próximo cadastro).
export function SectorCreateForm({
  suggestedColor,
}: {
  suggestedColor: SectorColor;
}) {
  const [color, setColor] = useState(suggestedColor);
  const [syncedFrom, setSyncedFrom] = useState(suggestedColor);
  const [resets, setResets] = useState(0);

  // Sugestão nova vinda do servidor: acompanha (padrão "ajustar estado durante a renderização").
  if (syncedFrom !== suggestedColor) {
    setSyncedFrom(suggestedColor);
    setColor(suggestedColor);
  }

  return (
    <NameForm
      entity="setor"
      initialName=""
      submitLabel="Criar setor"
      successMessage="Setor criado."
      onSubmit={(name) => createSectorAction({ name, color })}
      onDone={() => {
        setColor(suggestedColor);
        setResets((count) => count + 1);
      }}
    >
      <SectorColorChoice
        key={`${suggestedColor}-${resets}`}
        defaultValue={color}
        onValueChange={setColor}
      />
    </NameForm>
  );
}
```

Write `src/components/admin/sectors/SectorRowActions.tsx`:

```tsx
"use client";

import { useState } from "react";

import {
  renameSectorAction,
  setSectorActiveAction,
} from "@/app/(app)/admin/setores/actions";
import { ActiveToggleButton } from "@/components/admin/ActiveToggleButton";
import { EditDialog } from "@/components/admin/EditDialog";
import { NameForm } from "@/components/admin/NameForm";
import { SectorColorChoice } from "@/components/admin/sectors/SectorColorChoice";
import type { SectorRow } from "@/features/admin/sectors";
import type { SectorColor } from "@/features/sectors/colors";

export function SectorRowActions({ sector }: { sector: SectorRow }) {
  return (
    <>
      <EditDialog title="Editar setor" name={sector.name}>
        {(close) => <SectorEditForm sector={sector} onDone={close} />}
      </EditDialog>
      <ActiveToggleButton
        entity="Setor"
        name={sector.name}
        active={sector.active}
        onToggle={(active) => setSectorActiveAction({ id: sector.id, active })}
      />
    </>
  );
}

// Monta quando o diálogo abre (o conteúdo do diálogo desmonta ao fechar), então a cor sempre
// começa na atual do setor e fechar sem salvar descarta a troca.
function SectorEditForm({
  sector,
  onDone,
}: {
  sector: SectorRow;
  onDone: () => void;
}) {
  const [color, setColor] = useState<SectorColor>(sector.color);

  return (
    <NameForm
      entity="setor"
      initialName={sector.name}
      submitLabel="Salvar alterações"
      successMessage="Alterações salvas."
      onSubmit={(name) => renameSectorAction({ id: sector.id, name, color })}
      onDone={onDone}
    >
      <SectorColorChoice defaultValue={sector.color} onValueChange={setColor} />
    </NameForm>
  );
}
```

`src/components/admin/sectors/SectorsAdmin.tsx`: imports e a leitura (o resto do arquivo não muda).

```tsx
import { listSectors, suggestColorForNewSector } from "@/features/admin/sectors";
```

```tsx
  const params = await searchParams;
  const [data, suggestedColor] = await Promise.all([
    listSectors(db, { page: parsePage(params.pagina) }, new Date()),
    suggestColorForNewSector(db),
  ]);
```

```tsx
        <CardContent>
          <SectorCreateForm suggestedColor={suggestedColor} />
        </CardContent>
```

- [ ] **Step 5: Rodar e ver passar**

Run: `bunx biome check --write src/components/admin/NameForm.tsx src/components/admin/NameForm.test.tsx src/components/admin/sectors`
Expected: arquivos formatados, sem erro.

Run: `bunx vitest run src/components/admin/sectors src/components/admin/NameForm.test.tsx src/components/admin/EditDialog.test.tsx "src/app/(app)/admin/setores"`
Expected: PASS em todos. (`EditDialog.test.tsx` e `page.test.tsx` rodam só para provar que nada que não mudou quebrou. Os testes de `DestinationCreateForm`/`DestinationRowActions` usam `NameForm` sem `children`: rode também `bunx vitest run src/components/admin/destinations`.)

Run: `bunx vitest run src/components/admin/destinations`
Expected: PASS.

- [ ] **Step 6: E2E — escolher a cor, ver persistir, editar**

`e2e/cadastros.spec.ts`, no cenário `(a)`, bloco `// Setor.`. Troque o trecho do setor (de `await page.goto("/admin/setores");` até a asserção `Formulário limpo`) por:

```ts
  // Setor.
  await page.goto("/admin/setores");
  await expect(page.getByRole("heading", { name: "Setores" })).toBeVisible();
  // A cor já vem marcada (sugestão do servidor): o formulário nunca começa em branco.
  const colorChoice = page.getByRole("radiogroup", { name: "Cor" });
  await expect(colorChoice.getByRole("radio", { checked: true })).toHaveCount(1);
  await page.getByLabel("Nome do setor").fill(sectorName);
  await colorChoice.getByRole("radio", { name: "Rosa" }).click();
  await expect(colorChoice.getByRole("radio", { name: "Rosa" })).toBeChecked();
  await page.getByRole("button", { name: "Criar setor" }).click();
  await expect(page.getByText("Setor criado.")).toBeVisible();
  await expect(rowWith(page, sectorName)).toContainText("0 pessoas ativas");
  // Formulário limpo depois de criar com sucesso.
  await expect(page.getByLabel("Nome do setor")).toHaveValue("");

  // A cor escolhida foi gravada: o diálogo de edição abre com ela marcada.
  await rowWith(page, sectorName)
    .getByRole("button", { name: `Editar ${sectorName}` })
    .click();
  const editDialog = page.getByRole("dialog", { name: "Editar setor" });
  await expect(editDialog.getByRole("radio", { name: "Rosa" })).toBeChecked();
  // Troca só a cor e salva.
  await editDialog.getByRole("radio", { name: "Azul" }).click();
  await editDialog.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Alterações salvas.")).toBeVisible();
  await expect(editDialog).toBeHidden();
  // Depois de recarregar (veio do banco): a cor nova persiste.
  await page.reload();
  await rowWith(page, sectorName)
    .getByRole("button", { name: `Editar ${sectorName}` })
    .click();
  await expect(
    page
      .getByRole("dialog", { name: "Editar setor" })
      .getByRole("radio", { name: "Azul" }),
  ).toBeChecked();
  await page.keyboard.press("Escape");
```

O restante do cenário (Turno, Item, Destino) não muda. Os cenários (b) e (c) criam setor por `insertSector(db, ...)` (cor padrão) e não mexem na tela Setores: nada a mudar. Não rode o E2E aqui (o controlador roda no fim; é a única verificação do fluxo real da cor).

- [ ] **Step 7: Catálogo de componentes (`.context/ui-registry.md`)**

O guarda `test/uiRegistryDoc.test.ts` exige que `SectorColorChoice` (nome do arquivo em `src/components/admin/`) apareça no catálogo; as quatro edições abaixo cobrem isso e mantêm o Histórico em dia. Cada uma é uma troca exata (Edit).

1. Depois da entrada `SectorRowActions` (a que termina com `Usa: EditDialog, NameForm, ActiveToggleButton` + `Histórico ... Fase 2 (Tarefa 6)` logo após o texto `Desativar setor com pessoas ativas ou convites pendentes volta ...`), troque

```
- **Como funciona:** `"use client"`; `EditDialog` "Editar setor" com `NameForm` ("Salvar alterações", toast "Alterações salvas.", fecha ao salvar) e `ActiveToggleButton` → `setSectorActiveAction`. Desativar setor com pessoas ativas ou convites pendentes volta `SECTOR_IN_USE` e a mensagem com as contagens aparece em toast.
- **Usa:** `EditDialog`, `NameForm`, `ActiveToggleButton`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 6).
```

por

```
- **Como funciona:** `"use client"`; `EditDialog` "Editar setor" com `NameForm` ("Salvar alterações", toast "Alterações salvas.", fecha ao salvar) e a `SectorColorChoice` já na cor atual do setor, e `ActiveToggleButton` → `setSectorActiveAction`. O formulário de edição (`SectorEditForm`, interno) monta quando o diálogo abre, então fechar sem salvar descarta a cor trocada. `renameSectorAction({ id, name, color })`. Desativar setor com pessoas ativas ou convites pendentes volta `SECTOR_IN_USE` e a mensagem com as contagens aparece em toast.
- **Usa:** `EditDialog`, `NameForm`, `SectorColorChoice`, `ActiveToggleButton`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 6). 2026-11-27 — a edição ganha a escolha de cor (visual novo, Task 6).

### SectorColorChoice
- **Status:** ✅ pronto (2026-11-27)
- **Local:** `src/components/admin/sectors/SectorColorChoice.tsx` (client)
- **Propósito:** escolher a cor do setor entre as cinco da paleta (Lilás, Pêssego, Azul, Verde, Rosa), na criação e na edição do setor.
- **Como funciona:** `<fieldset>` com `<legend>` "Cor" + `RadioGroup`/`Radio.Root` do Base UI (`@base-ui/react/radio-group`, `@base-ui/react/radio`; `role="radiogroup"` nomeado pela legenda, `role="radio"` por opção). Cada opção é uma pílula (`h-9`, `max-md:h-11`) com a amostra de 16px (`size-4 rounded-full`, classe `SECTOR_COLOR_BG[cor]`, `aria-hidden`) **e o nome escrito**: a cor nunca é a única pista (`ui-rules.md §2.1`). A marcada ganha `data-checked` (`border-foreground bg-muted`). Props: `defaultValue: SectorColor` (sempre há uma marcada), `onValueChange?(cor)`, `name` (padrão `"color"`), `legend` (padrão "Cor"), `disabled`. Clicar na marcada não a desmarca. Não é controlado: quem usa guarda a escolha em `onValueChange` e remonta pela `key` para voltar ao padrão (o `SectorCreateForm` faz isso depois de criar). Por que não o `ChoiceGroup`: ele é um `ToggleGroup` com rótulo `string`, sem lugar para a amostra, e botões `aria-pressed` não são um `radiogroup`.
- **Usa:** `FieldSet`, `FieldLegend`, `RadioGroup`, `Radio`, `SECTOR_COLORS`, `SECTOR_COLOR_LABELS`, `SECTOR_COLOR_BG`, tokens `bg-sector-*`.
- **Histórico:** 2026-11-27 — criado no visual novo (Task 6).
```

2. `SectorCreateForm`: troque

```
- **Como funciona:** `"use client"`; `NameForm` (entity "setor", nome começa vazio por ser a identidade do registro) → `createSectorAction`; toast "Setor criado."; erro de nome repetido inline (com o aviso "Ele está inativo: reative-o na lista." quando for o caso).
- **Usa:** `NameForm`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 6).

### SectorRowActions
```

por

```
- **Como funciona:** `"use client"`; `NameForm` (entity "setor", nome começa vazio por ser a identidade do registro) + `SectorColorChoice` com a cor sugerida pelo servidor (`suggestedColor`, de `suggestColorForNewSector`) marcada → `createSectorAction({ name, color })`; toast "Setor criado."; erro de nome repetido inline (com o aviso "Ele está inativo: reative-o na lista." quando for o caso). Depois de criar, a cor volta à sugerida (a escolha não "gruda" no próximo cadastro); se o servidor recusar, nome e cor escolhidos ficam.
- **Usa:** `NameForm`, `SectorColorChoice`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 6). 2026-11-27 — ganha a escolha de cor e a prop `suggestedColor` (visual novo, Task 6).

### SectorRowActions
```

3. `NameForm`: troque a linha de Histórico

```
- **Histórico:** 2026-11-21 — criado na Fase 2. Exceção documentada a "nunca em branco" (F2-9): o nome é a identidade do registro.
```

por

```
- **Histórico:** 2026-11-21 — criado na Fase 2. Exceção documentada a "nunca em branco" (F2-9): o nome é a identidade do registro. 2026-11-27 — `children` opcional, renderizado entre o campo e o botão (a escolha de cor do setor); destinos não usam.
```

4. `SectorsAdmin`: troque

```
- **Usa:** `AdminPageHeader`, `AdminListRow`, `EmptyState`, `Pagination`, `Card*`, `pluralize`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 6).
```

por

```
- **Usa:** `AdminPageHeader`, `AdminListRow`, `EmptyState`, `Pagination`, `Card*`, `pluralize`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 6). 2026-11-27 — lê também `suggestColorForNewSector` (em paralelo com `listSectors`, depois do portão) e passa `suggestedColor` ao `SectorCreateForm` (visual novo, Task 6).
```

Run: `bunx vitest run test/uiRegistryDoc.test.ts`
Expected: PASS (inclui `src/components/admin/sectors/SectorColorChoice.tsx está no catálogo`).

- [ ] **Step 8: Verificação final das duas tarefas**

Run: `bun run check-types`
Expected: sem erros (agora os componentes e os testes da Task 6 fecham os tipos que a Task 5 deixou abertos).

Run: `bun run lint`
Expected: sem erros.

Run: `bunx vitest run src/components/admin src/features/sectors src/features/admin src/db/schema/sectors.test.ts src/db/schema/migration0005.test.ts "src/app/(app)/admin" test/uiRegistryDoc.test.ts test/fixtures.test.ts test/db.test.ts`
Expected: PASS. (Um subconjunto; a suíte inteira e o E2E ficam para o controlador.)

Confirme que a migração **não** foi aplicada em lugar nenhum: nenhum `db:migrate` foi rodado. O controlador roda `bun run db:hosts`, confere o host e só então `bun run db:migrate` no Neon, **antes** de pôr o código desta branch em produção (o código novo lê `sector.color`).

- [ ] **Step 9: Commit**

Write `.git/sdd/visual/msg-task-6.txt`:

```
feat(setores): escolha da cor na criação e na edição do setor

SectorColorChoice (radiogroup do Base UI, amostra de 16px mais o nome) entra no
formulário de criação, já com a cor sugerida pelo servidor, e no de edição, com a
cor atual. NameForm ganha o slot children. O E2E de cadastros cobre escolher,
persistir e editar a cor.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Run: `git add src/components/admin e2e/cadastros.spec.ts .context/ui-registry.md && git commit -F .git/sdd/visual/msg-task-6.txt`

---

### Task 7: `SectorPicker` deslizante em todas as telas, `color` em toda lista de setores e seletores do E2E

**Files:**
- Modify: `src/components/passagens/SectorPicker.tsx` (vira `RadioGroup`/`Radio` do Base UI com trilho e thumb deslizante, `useOptimistic`, sem `Button`/`FieldSet`; parte do estado deixado pela Task 5, que só trocou o tipo de `options` por `Pick<SectorChoice, "id" | "name">`)
- Modify: `src/components/passagens/SectorPicker.test.tsx` (reescrito; a Task 5 só pôs `color` nos dois literais)
- Modify (testes existentes, `group`/`button`/`aria-pressed` viram `radiogroup`/`radio`/`aria-checked`): `src/components/dashboard/DashboardScreen.test.tsx`, `src/components/passagens/HandoverHistory.test.tsx`, `src/components/passagens/HomeHandovers.test.tsx`, `src/components/passagens/NewHandover.test.tsx`, `src/components/solicitacoes/RequestsScreen.test.tsx`
- Modify: `src/features/handovers/screenSector.test.ts` (um teste novo: a cor chega às escolhas do admin)
- Modify (E2E): `e2e/dashboard.spec.ts` (linhas 354-360), `e2e/passagem.spec.ts` (linhas 426 e 453-470)
- Modify: `.context/ui-registry.md` (entrada `SectorPicker`, `Histórico` 2026-11-27)
- Test: `src/components/passagens/SectorPicker.test.tsx`, `src/features/handovers/screenSector.test.ts`
- **Já feito pela Task 5 (não repetir):** `listActiveSectors` seleciona `color` (`src/features/admin/sectors.ts`) e todos os literais de teste tipados como `SectorChoice` ganharam `color` (`sectors.test.ts`, `screenSector.test.ts`, `sectorChoice.test.ts`, `SectorSwitcher.test.tsx`, `InviteForm.test.tsx`, `PersonForm.test.tsx`, `PersonRowActions.test.tsx`, `TeamAdmin.test.tsx`, `RequestForm.test.tsx`). Os Steps 4 e 7 só conferem.

**Interfaces:**
- Consumes (Task 5): `SectorColor` e `SECTOR_COLOR_BG: Record<SectorColor, string>` de `@/features/sectors/colors`; `SectorChoice = { id: string; name: string; color: SectorColor }` de `@/features/admin/sectors`; coluna `sector.color` em `@/db/schema/sectors`; `insertSector(db, name, { active?, color? })` em `test/fixtures.ts` com `color` padrão `"lilac"`.
- Consumes (Task 1): tokens `bg-seg`, `bg-thumb`, `text-thumb-foreground`, `shadow-thumb` (a sombra do thumb, valor só no `globals.css`), `bg-sector-*` (via `SECTOR_COLOR_BG`), `ring-ring`, `font-heading` (a Satoshi chega pela Task 2; antes dela `font-heading` cai na Geist, sem erro). Breakpoint `md` = 860px (Task 1).
- Consumes (Task 4): nada de `Button`; este componente deixa de importar `Button`, `FieldSet` e `FieldLegend`.
- Produces: `SectorPicker({ sectors, selectedId, path, allowAll?, query? })` com a MESMA assinatura de hoje (`sectors: readonly SectorChoice[]`, `selectedId: string`, `path: SectorPickerPath`, `allowAll?: boolean`, `query?: string`). Semântica nova: `role="radiogroup"` com `aria-label="Setor"`, um `role="radio"` por opção com `aria-checked` e `aria-label` = nome. As Tasks 11 e 14 só importam o componente; quem testar o seletor usa `getByRole("radiogroup", { name: "Setor" })` e `getByRole("radio", { name })`.
- (Da Task 5, só consumido aqui: `listActiveSectors(db): Promise<SectorChoice[]>` já devolve `{ id, name, color }`.)

**Decisões de desenho (para o revisor):**
1. **Base UI `RadioGroup` + `Radio.Root`** (conferido em `node_modules/@base-ui/react` 1.9.0): o grupo renderiza `role="radiogroup"` (um `div` que recebe `className`/`style`/`aria-label`) e o `Radio.Root` renderiza `<span role="radio" aria-checked>` mais um `<input aria-hidden>` escondido. As setas do teclado movem o foco **e selecionam** (comportamento nativo de radio, `onKeyDownCapture` do grupo marca `touched` e o `onFocus` do radio dispara o clique no input), Espaço seleciona, Enter não faz nada, Tab entra no radio marcado (tabindex rotativo). `value`/`onValueChange` controlam a seleção; `disabled` no grupo desativa todos (`aria-disabled`). Clicar no já marcado não dispara `onValueChange` (e `choose` ainda confere `sectorId === selectedId`, como hoje).
2. **`useOptimistic(selectedId)`** dentro da `useTransition`: ao escolher, o thumb já desliza para o setor novo (é o ganho do visual) e, se a action devolver erro ou lançar, a transição acaba e o valor volta sozinho ao `selectedId` do servidor (o thumb volta). No sucesso a Server Action faz `redirect`, a página nova traz o `selectedId` novo. A lógica de `chooseSectorAction`, `unstable_rethrow` e `toast.error` fica igual.
3. **Geometria.** Trilho externo = o próprio `RadioGroup`: `h-12 p-1 rounded-full bg-seg overflow-x-auto`, largura `min(100%, max(30rem, N*6.5rem + 0.5rem))`. Dentro dele um `div` interno `relative flex` com `min-width: max(100%, N*6.5rem)` que contém o thumb e os radios. O thumb é filho do interno (não do trilho), então `left: calc(i * 100% / N)` e `width: calc(100% / N)` valem também quando há rolagem (a fórmula da spec, `calc(4px + i*((100% - 8px)/N))` sobre o trilho com padding, é a mesma coisa sobre a área interna de `100% - 8px`). `N` e `i` vão como variáveis CSS (`--n` no grupo, `--i` no thumb): o jsdom descarta `calc()` inválido em `style`, mas mantém variáveis, e o teste lê a variável.
4. **Mínimo do segmento: `6.5rem` (104px).** Justificativa: o maior nome comum, "Operações" em Satoshi 15px/700, mais a bolinha de 8px, o gap de 7px e o padding de 12px, cabe em cerca de 100px; "Todos os setores" (o mais longo) trunca com reticências (`truncate`) e o nome completo continua no `aria-label`. Com 4 setores o trilho tem 30rem (480px, o valor da spec) e cada segmento recebe 118px, sem rolagem. Com mais de 4 (ou 4 + "Todos os setores" no Histórico, Dashboard e Solicitações), a largura **cresce** até `N*104 + 8` em vez de rolar, limitada a 100% do espaço; só rola quando nem isso cabe (celular com 4 ou mais opções: 358px úteis, cabem 3). Em 390px a spec manda 100%, o `min(100%, ...)` já dá isso.
5. **Toque.** O guarda `e2e/touch-targets.spec.ts` (390x844) mede todo `[role=radio]` visível e reprova abaixo de 44x44 (o `<input>` escondido do Base UI é `aria-hidden`, o guarda o ignora). O segmento da spec tem 40px (trilho de 48 com padding 4). Abaixo de 860px o radio ganha `max-md:h-11 max-md:-my-0.5`: 44px de altura, centrado, invadindo 2px do padding do trilho (o trilho continua com 48px e o thumb com 40px; o radio é transparente, a diferença é invisível). Não há rolagem vertical, porque os 44px cabem nos 48px do trilho. Largura mínima 104px já passa de 44. No desktop (acima de 860px) fica os 40px da spec, como todo controle de 40px do projeto acima do `md`. O teste de unidade confere as classes `max-md:h-11`; o guarda E2E existente cobre a medida real.
6. **`prefers-reduced-motion`**: `motion-reduce:transition-none` no thumb (sem deslize) e nas cores dos segmentos.
7. **Foco**: `focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring` (inset, para o anel não ser cortado pelo `overflow-x-auto`).
8. **"Todos os setores"**: `color: null`, sem bolinha. Selecionado fora da lista (`index < 0`): nenhum radio marcado, thumb com `opacity-0`.
9. A sombra do thumb é o token `shadow-thumb` da Task 1 (`--shadow-thumb` no bloco `@theme` do `globals.css`, com o valor da spec §4.5). Nenhum `rgba(...)` no `.tsx`: o guarda `rawColors` recusa cor dentro de valor arbitrário (`shadow-[...rgba(...)]`).

- [ ] **Step 1: Escrever o teste novo do `SectorPicker` (falha)**

Substitua o arquivo inteiro `src/components/passagens/SectorPicker.test.tsx`:

```tsx
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { redirect } from "next/navigation";
import { Component, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SECTOR_COLOR_BG } from "@/features/sectors/colors";

import { SectorPicker } from "./SectorPicker";

const mocks = vi.hoisted(() => ({
  chooseSectorAction: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/actions", () => ({
  chooseSectorAction: mocks.chooseSectorAction,
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

const ULD = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "ULD",
  color: "lilac",
} as const;
const CARGA = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Carga",
  color: "peach",
} as const;
const OPERACOES = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Operações",
  color: "sky",
} as const;
const ECO = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Eco",
  color: "green",
} as const;
const GELO = {
  id: "55555555-5555-4555-8555-555555555555",
  name: "Gelo",
  color: "pink",
} as const;

class Catcher extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    return this.state.error ? <p>capturado</p> : this.props.children;
  }
}

function radio(name: string) {
  return screen.getByRole("radio", { name });
}

describe("SectorPicker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mocks.chooseSectorAction.mockReset();
    mocks.toastError.mockReset();
  });

  it("é um radiogroup 'Setor' com um radio por setor, o selecionado com aria-checked", () => {
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    const group = screen.getByRole("radiogroup", { name: "Setor" });
    expect(within(group).getAllByRole("radio")).toHaveLength(2);
    expect(radio("ULD")).toHaveAttribute("aria-checked", "true");
    expect(radio("Carga")).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("cada setor leva a bolinha na cor dele, o thumb fica no índice do selecionado", () => {
    render(
      <SectorPicker
        sectors={[ULD, CARGA, OPERACOES]}
        selectedId={CARGA.id}
        path="/"
      />,
    );

    for (const [name, color] of [
      ["ULD", ULD.color],
      ["Carga", CARGA.color],
      ["Operações", OPERACOES.color],
    ] as const) {
      const dot = radio(name).querySelector("[data-sector-dot]");
      expect(dot).not.toBeNull();
      for (const token of SECTOR_COLOR_BG[color].split(" ")) {
        expect(dot).toHaveClass(token);
      }
    }
    const thumb = document.querySelector<HTMLElement>(
      "[data-slot=sector-picker-thumb]",
    );
    expect(thumb).not.toBeNull();
    expect(thumb?.style.getPropertyValue("--i")).toBe("1");
    expect(thumb).not.toHaveClass("opacity-0");
    expect(
      screen.getByRole("radiogroup", { name: "Setor" }).style.getPropertyValue(
        "--n",
      ),
    ).toBe("3");
  });

  it("o thumb desliza sem animação para quem pede menos movimento", () => {
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    const thumb = document.querySelector("[data-slot=sector-picker-thumb]");
    expect(thumb).toHaveClass("motion-reduce:transition-none");
    expect(thumb).toHaveClass("transition-[left]");
    // A sombra é o token da Task 1, nunca rgba() no .tsx.
    expect(thumb).toHaveClass("shadow-thumb", "bg-thumb");
  });

  it("clicar em outro setor chama a action com setor e caminho", async () => {
    mocks.chooseSectorAction.mockResolvedValue({ ok: true });
    render(
      <SectorPicker
        sectors={[ULD, CARGA]}
        selectedId={ULD.id}
        path="/passagens/nova"
      />,
    );

    await userEvent.click(radio("Carga"));

    expect(mocks.chooseSectorAction).toHaveBeenCalledWith({
      sectorId: CARGA.id,
      path: "/passagens/nova",
    });
  });

  it("com query, a action recebe o query dos filtros junto (P45)", async () => {
    mocks.chooseSectorAction.mockResolvedValue({ ok: true });
    render(
      <SectorPicker
        sectors={[ULD, CARGA]}
        selectedId={ULD.id}
        path="/passagens"
        query="periodo=30&situacao=aguardando"
      />,
    );

    await userEvent.click(radio("Carga"));

    expect(mocks.chooseSectorAction).toHaveBeenCalledWith({
      sectorId: CARGA.id,
      path: "/passagens",
      query: "periodo=30&situacao=aguardando",
    });
  });

  it("com query vazio, a action recebe o query vazio (a tela sem filtros)", async () => {
    mocks.chooseSectorAction.mockResolvedValue({ ok: true });
    render(
      <SectorPicker
        sectors={[ULD, CARGA]}
        selectedId={ULD.id}
        path="/solicitacoes"
        query=""
      />,
    );

    await userEvent.click(radio("Carga"));

    expect(mocks.chooseSectorAction).toHaveBeenCalledWith({
      sectorId: CARGA.id,
      path: "/solicitacoes",
      query: "",
    });
  });

  it("clicar no setor já selecionado não chama a action", async () => {
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    await userEvent.click(radio("ULD"));

    expect(mocks.chooseSectorAction).not.toHaveBeenCalled();
  });

  it("as setas do teclado trocam de setor (radio nativo)", async () => {
    mocks.chooseSectorAction.mockResolvedValue({ ok: true });
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    await userEvent.tab();
    expect(radio("ULD")).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");

    await waitFor(() =>
      expect(mocks.chooseSectorAction).toHaveBeenCalledWith({
        sectorId: CARGA.id,
        path: "/",
      }),
    );
  });

  it("durante a troca o thumb já vai ao setor novo, o grupo fica desativado e os segmentos mais claros", async () => {
    let finish: (value: { ok: true }) => void = () => {};
    mocks.chooseSectorAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    await userEvent.click(radio("Carga"));

    await waitFor(() =>
      expect(radio("Carga")).toHaveAttribute("aria-checked", "true"),
    );
    expect(
      screen.getByRole("radiogroup", { name: "Setor" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(radio("ULD")).toHaveClass("opacity-60");
    expect(radio("Carga")).toHaveClass("opacity-60");
    expect(
      document
        .querySelector<HTMLElement>("[data-slot=sector-picker-thumb]")
        ?.style.getPropertyValue("--i"),
    ).toBe("1");

    // Pendente: outro clique não chama a action de novo.
    await userEvent.click(radio("ULD"));
    expect(mocks.chooseSectorAction).toHaveBeenCalledTimes(1);

    finish({ ok: true });
    await waitFor(() =>
      expect(
        screen.getByRole("radiogroup", { name: "Setor" }),
      ).not.toHaveAttribute("aria-disabled"),
    );
  });

  it("falha da action vira toast com a mensagem e o thumb volta ao setor de antes", async () => {
    mocks.chooseSectorAction.mockResolvedValue({
      ok: false,
      code: "SECTOR_INACTIVE",
      message:
        "Este setor está inativo. Peça a um administrador para reativá-lo.",
    });
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    await userEvent.click(radio("Carga"));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Este setor está inativo. Peça a um administrador para reativá-lo.",
      ),
    );
    await waitFor(() =>
      expect(radio("ULD")).toHaveAttribute("aria-checked", "true"),
    );
    expect(radio("Carga")).toHaveAttribute("aria-checked", "false");
  });

  it("exceção de rede vira o toast genérico", async () => {
    mocks.chooseSectorAction.mockRejectedValue(new Error("Failed to fetch"));
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    await userEvent.click(radio("Carga"));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Não foi possível concluir. Tente de novo.",
      ),
    );
  });

  it("o redirect do sucesso segue adiante: sem toast", async () => {
    mocks.chooseSectorAction.mockImplementation(async () => {
      redirect("/?setor=x");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Catcher>
        <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />
      </Catcher>,
    );

    await userEvent.click(radio("Carga"));

    expect(await screen.findByText("capturado")).toBeInTheDocument();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("allowAll acrescenta 'Todos os setores', sem bolinha, e escolher um setor chama a action", async () => {
    mocks.chooseSectorAction.mockResolvedValue({ ok: true });
    render(
      <SectorPicker
        sectors={[ULD]}
        selectedId="todos"
        path="/passagens"
        allowAll
      />,
    );

    expect(radio("Todos os setores")).toHaveAttribute("aria-checked", "true");
    expect(radio("Todos os setores").querySelector("[data-sector-dot]")).toBeNull();
    expect(radio("ULD").querySelector("[data-sector-dot]")).not.toBeNull();

    await userEvent.click(radio("ULD"));
    expect(mocks.chooseSectorAction).toHaveBeenCalledWith({
      sectorId: ULD.id,
      path: "/passagens",
    });
  });

  it("allowAll com lista vazia deixa só 'Todos os setores'", () => {
    render(
      <SectorPicker sectors={[]} selectedId="todos" path="/passagens" allowAll />,
    );

    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(radio("Todos os setores")).toHaveAttribute("aria-checked", "true");
  });

  it("sem allowAll não há 'Todos os setores'", () => {
    render(<SectorPicker sectors={[ULD]} selectedId={ULD.id} path="/" />);

    expect(
      screen.queryByRole("radio", { name: "Todos os setores" }),
    ).not.toBeInTheDocument();
  });

  it("selecionado fora da lista: nenhum radio marcado e o thumb escondido", () => {
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId="outro" path="/" />,
    );

    for (const item of screen.getAllByRole("radio")) {
      expect(item).toHaveAttribute("aria-checked", "false");
    }
    expect(
      document.querySelector("[data-slot=sector-picker-thumb]"),
    ).toHaveClass("opacity-0");
  });

  it("mais de 4 opções: o trilho rola e cada segmento tem largura mínima", () => {
    render(
      <SectorPicker
        sectors={[ULD, CARGA, OPERACOES, ECO, GELO]}
        selectedId={GELO.id}
        path="/"
        allowAll
      />,
    );

    const group = screen.getByRole("radiogroup", { name: "Setor" });
    expect(group).toHaveClass("overflow-x-auto");
    expect(group.style.getPropertyValue("--n")).toBe("6");
    for (const item of screen.getAllByRole("radio")) {
      expect(item).toHaveClass("min-w-[6.5rem]");
    }
    expect(
      document
        .querySelector<HTMLElement>("[data-slot=sector-picker-thumb]")
        ?.style.getPropertyValue("--i"),
    ).toBe("4");
  });

  it("nome longo trunca com reticências, o nome inteiro fica no aria-label", () => {
    const longo = {
      id: "66666666-6666-4666-8666-666666666666",
      name: "Recebimento e conferência de carga especial",
      color: "green",
    } as const;
    render(<SectorPicker sectors={[longo]} selectedId={longo.id} path="/" />);

    const item = radio(longo.name);
    expect(item).toHaveAttribute("aria-label", longo.name);
    expect(within(item).getByText(longo.name)).toHaveClass("truncate");
  });

  it("alvo de toque: 44px abaixo de 860px (guarda de 44px), 40px da spec acima", () => {
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    for (const item of screen.getAllByRole("radio")) {
      expect(item).toHaveClass("max-md:h-11");
    }
  });
});
```

- [ ] **Step 2: Escrever o teste novo das escolhas do admin (falha só se a Task 5 faltar)**

A Task 5 já fez o `select` de `listActiveSectors` levar `color` e já pôs a cor em todo literal de teste tipado como `SectorChoice` (inclusive o `toEqual` de `screenSector.test.ts` e o teste "devolve só id, name e color" de `sectors.test.ts`). Aqui entra só um teste a mais, para travar que a cor própria do setor chega ao seletor pelas escolhas do admin.

Em `src/features/handovers/screenSector.test.ts`, logo depois do teste `?setor=todos com allowAll devolve all` (use a mesma `admin` e o mesmo `db` do arquivo):

```ts
  it("as escolhas do admin levam a cor de cada setor ativo", async () => {
    const uld = await insertSector(db, "ULD Teste", { color: "sky" });

    const result = await resolveScreenSector(db, admin, {
      url: uld.id,
      allowAll: false,
    });

    expect(result).toMatchObject({
      kind: "sector",
      sectors: [{ id: uld.id, name: "ULD Teste", color: "sky" }],
    });
  });
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `bunx vitest run src/components/passagens/SectorPicker.test.tsx src/features/handovers/screenSector.test.ts`
Expected: `SectorPicker.test.tsx` FAIL com `Unable to find an accessible element with the role "radiogroup" and name "Setor"` (hoje é `group`). `screenSector.test.ts` PASS (a cor já vem da Task 5; o teste novo trava o comportamento). Se ele falhar com `color` ausente, a Task 5 não foi aplicada: pare e aplique-a antes.

- [ ] **Step 4: Conferir o `color` no loader (feito na Task 5)**

Run: `grep -n "color: sector.color" src/features/admin/sectors.ts`
Expected: duas linhas (o `select` de `listSectors` e o de `listActiveSectors`). Nada a editar.

`listActiveSectors` é o único ponto que monta `SectorChoice[]` do banco: `resolveScreenSector` (`screenSector.ts`), `resolveDashboardScope` (`scope.ts`, repassa `screen.sectors`), `RequestsScreen`, `ItemsAdmin`, `ShiftsAdmin` e `TeamAdmin` chamam `listActiveSectors`. Conferido por `grep -rn "SectorChoice" src` e por `grep -rn "sector.id, name: sector.name" src/features`: o `loadSector` (`loaders.ts`) devolve `SectorRow` com `active` e não alimenta o seletor; a cor dele entra na Task 10 (para o `HomeHandovers`).

- [ ] **Step 5: Implementar o `SectorPicker`**

Substitua o arquivo inteiro `src/components/passagens/SectorPicker.tsx`:

```tsx
"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { cn } from "cn";
import { unstable_rethrow } from "next/navigation";
import { type CSSProperties, useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { chooseSectorAction } from "@/app/(app)/actions";
import { INTERNAL_ERROR_MESSAGE } from "@/features/admin/result";
import type { SectorChoice } from "@/features/admin/sectors";
import { ALL_SECTORS } from "@/features/handovers/limits";
import type { SectorPickerPath } from "@/features/handovers/urls";
import { SECTOR_COLOR_BG, type SectorColor } from "@/features/sectors/colors";

// "Todos os setores" não é um setor: não tem cor, então não tem bolinha.
type PickerOption = { id: string; name: string; color: SectorColor | null };

// Largura mínima do segmento (104px): cabe "Operações" em Satoshi 15px/700 com a
// bolinha e o respiro; o nome maior trunca com reticências. O trilho cresce até
// N * 104px (+ o padding de 4px de cada lado) antes de começar a rolar.
const SEGMENT_MIN_REM = 6.5;

// Escolha de setor do admin: seletor deslizante (segmented control) que grava o
// cookie e navega pela Server Action (F3-15). Clicar no setor já selecionado
// não faz nada. `query` é o query canônico dos filtros da tela (sem o setor): o
// servidor o reinterpreta e o leva ao setor novo (P45); sem ele, vai só o setor.
export function SectorPicker({
  sectors,
  selectedId,
  path,
  allowAll = false,
  query,
}: {
  sectors: readonly SectorChoice[];
  selectedId: string | typeof ALL_SECTORS;
  path: SectorPickerPath;
  allowAll?: boolean;
  query?: string;
}) {
  const [pending, startTransition] = useTransition();
  // O thumb vai ao setor novo na hora; se a action falhar, a transição acaba e
  // o valor volta sozinho ao `selectedId` que o servidor mandou.
  const [shownId, setShownId] = useOptimistic<string>(selectedId);
  const options: readonly PickerOption[] = allowAll
    ? [...sectors, { id: ALL_SECTORS, name: "Todos os setores", color: null }]
    : sectors;
  const count = options.length;
  const index = options.findIndex((option) => option.id === shownId);

  function choose(sectorId: string) {
    if (sectorId === selectedId) return;
    startTransition(async () => {
      setShownId(sectorId);
      try {
        const result = await chooseSectorAction(
          query === undefined ? { sectorId, path } : { sectorId, path, query },
        );
        if (!result.ok) toast.error(result.message);
      } catch (error) {
        // O sucesso da action é um redirect, que chega aqui como exceção.
        unstable_rethrow(error);
        toast.error(INTERNAL_ERROR_MESSAGE);
      }
    });
  }

  return (
    <RadioGroup
      aria-label="Setor"
      value={shownId}
      onValueChange={(value) => choose(value)}
      disabled={pending}
      style={{ "--n": count } as CSSProperties}
      className="flex h-12 w-[min(100%,max(30rem,calc(var(--n)*6.5rem+0.5rem)))] overflow-x-auto rounded-full bg-seg p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="relative flex min-w-[max(100%,calc(var(--n)*6.5rem))] flex-1">
        <span
          aria-hidden="true"
          data-slot="sector-picker-thumb"
          style={{ "--i": Math.max(index, 0) } as CSSProperties}
          className={cn(
            "pointer-events-none absolute inset-y-0 left-[calc(var(--i)*100%/var(--n))] w-[calc(100%/var(--n))] rounded-full bg-thumb shadow-thumb transition-[left] duration-[400ms] ease-[cubic-bezier(.3,1.25,.4,1)] motion-reduce:transition-none",
            index < 0 && "opacity-0",
          )}
        />
        {options.map((option) => (
          <Radio.Root
            key={option.id}
            value={option.id}
            aria-label={option.name}
            className={cn(
              "relative z-10 flex min-w-[6.5rem] flex-1 cursor-pointer items-center justify-center gap-[7px] rounded-full px-3 font-heading text-[15px] font-medium text-foreground outline-none transition-colors duration-[250ms] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-checked:font-bold aria-checked:text-thumb-foreground aria-disabled:cursor-default motion-reduce:transition-none max-md:-my-0.5 max-md:h-11",
              pending && "opacity-60",
            )}
          >
            {option.color !== null && (
              <span
                aria-hidden="true"
                data-sector-dot=""
                className={cn(
                  "size-2 flex-none rounded-full",
                  SECTOR_COLOR_BG[option.color],
                )}
              />
            )}
            <span className="truncate">{option.name}</span>
          </Radio.Root>
        ))}
      </div>
    </RadioGroup>
  );
}
```

Notas: `SEGMENT_MIN_REM` documenta o `6.5rem` (as classes arbitrárias do Tailwind não aceitam a constante; o teste trava o valor `min-w-[6.5rem]`). Se o Biome reclamar da constante sem uso (`noUnusedVariables`), apague a constante e deixe só o comentário.

- [ ] **Step 6: Codemod dos testes existentes das telas**

Os cinco testes de tela usam o banco real (PGlite) e `listActiveSectors`, então o `color` já chega pelo Step 4; falta só trocar `group`→`radiogroup`, `button`→`radio` (nos nomes de setor e "Todos os setores") e `aria-pressed`→`aria-checked`. São 8 + 5 + 6 + ... ocorrências; um script confere as contagens e falha alto se algo ficar para trás.

Crie `.git/sdd/visual/codemod-task7.mjs` com a ferramenta Write:

```js
import { readFileSync, writeFileSync } from "node:fs";

const EXPECTED = {
  "src/components/dashboard/DashboardScreen.test.tsx": { g: 2, b: 6, a: 3 },
  "src/components/passagens/HandoverHistory.test.tsx": { g: 5, b: 5, a: 3 },
  "src/components/passagens/HomeHandovers.test.tsx": { g: 2, b: 3, a: 3 },
  "src/components/passagens/NewHandover.test.tsx": { g: 2, b: 2, a: 2 },
  "src/components/solicitacoes/RequestsScreen.test.tsx": { g: 3, b: 2, a: 1 },
};

const GROUP = /"group",(\s*)\{(\s*)name:(\s*)"Setor"/g;
const NAMES =
  '"Todos os setores"|"ULD"|"Carga"|"ULD Teste"|"Câmara Teste"|sector\\.name|other\\.name';
const BUTTON = new RegExp(
  `getByRole\\(\\s*"button",\\s*\\{\\s*name:\\s*(${NAMES})\\s*,?\\s*\\}\\s*\\)`,
  "g",
);
const PRESSED = /toHaveAttribute\(\s*"aria-pressed",\s*"(true|false)",?\s*\)/g;

let failed = false;
for (const [file, want] of Object.entries(EXPECTED)) {
  let text = readFileSync(file, "utf8");
  const got = {
    g: (text.match(GROUP) ?? []).length,
    b: (text.match(BUTTON) ?? []).length,
    a: (text.match(PRESSED) ?? []).length,
  };
  if (got.g !== want.g || got.b !== want.b || got.a !== want.a) {
    console.error(`${file}: esperado ${JSON.stringify(want)}, achou ${JSON.stringify(got)}`);
    failed = true;
    continue;
  }
  text = text
    .replace(GROUP, '"radiogroup",$1{$2name:$3"Setor"')
    .replace(BUTTON, (_all, name) => `getByRole("radio", { name: ${name} })`)
    .replace(PRESSED, (_all, value) => `toHaveAttribute("aria-checked", "${value}")`);
  if (text.includes("aria-pressed")) {
    console.error(`${file}: sobrou aria-pressed`);
    failed = true;
    continue;
  }
  writeFileSync(file, text);
  console.log(`${file}: ok ${JSON.stringify(got)}`);
}
process.exit(failed ? 1 : 0);
```

Run: `node .git/sdd/visual/codemod-task7.mjs`
Expected: cinco linhas `ok`, código de saída 0. Se alguma contagem divergir (o arquivo mudou desde esta leitura), o script não grava nada nesse arquivo e diz qual: ajuste o `EXPECTED` olhando `grep -n 'Setor"\|aria-pressed' <arquivo>` e rode de novo.

Depois: `bunx biome format --write src/components/dashboard/DashboardScreen.test.tsx src/components/passagens/HandoverHistory.test.tsx src/components/passagens/HomeHandovers.test.tsx src/components/passagens/NewHandover.test.tsx src/components/solicitacoes/RequestsScreen.test.tsx src/components/passagens/SectorPicker.test.tsx`
Expected: arquivos reformatados (as linhas quebradas pelo Biome voltam ao estilo do projeto).

Mudanças que o script faz (exemplos, conferidos nas linhas atuais):
- `DashboardScreen.test.tsx` 167, `HandoverHistory.test.tsx` 149, `HomeHandovers.test.tsx` 118, `NewHandover.test.tsx` 300, `RequestsScreen.test.tsx` 149: `queryByRole("group", { name: "Setor" })` → `queryByRole("radiogroup", { name: "Setor" })` (operador nunca vê o seletor).
- `DashboardScreen.test.tsx` 219-229:

```tsx
    const picker = screen.getByRole("radiogroup", { name: "Setor" });
    expect(
      within(picker).getByRole("radio", { name: "ULD Teste" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      within(picker).getByRole("radio", { name: "Câmara Teste" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      within(picker).getByRole("radio", { name: "Todos os setores" }),
    ).toBeInTheDocument();
```

- `DashboardScreen.test.tsx` 270, 302, 318: `screen.getByRole("radio", { name: "Todos os setores" })` (o 270 com `aria-checked`, `"true"`; 302 e 318 são cliques).
- `HandoverHistory.test.tsx` 191-216, 305, 326 e `RequestsScreen.test.tsx` 169-172, 195: o mesmo padrão com `sector.name` / `other.name` / `"Todos os setores"`.
- `HomeHandovers.test.tsx` 438-441, 457, 477 e `NewHandover.test.tsx` 367-370, 386: `getByRole("radiogroup", { name: "Setor" })` e `getByRole("radio", { name: "Carga" })` com `aria-checked`.

- [ ] **Step 7: Conferir as fixtures tipadas (feito na Task 5)**

`SectorChoice` exige `color` desde a Task 5, que já corrigiu os literais de `InviteForm.test.tsx`, `PersonForm.test.tsx`, `PersonRowActions.test.tsx`, `SectorSwitcher.test.tsx`, `sectorChoice.test.ts`, `screenSector.test.ts`, `sectors.test.ts`, `TeamAdmin.test.tsx` e `RequestForm.test.tsx`. Nada a editar aqui.

Run: `bun run check-types`
Expected: sem erros. Qualquer erro restante `Property 'color' is missing in type ... SectorChoice` é um literal `{ id, name }` que a Task 5 não viu: some `color: "lilac"` (anote o tipo ou use `as const`, no mesmo estilo da Task 5) e rode de novo.

- [ ] **Step 8: Seletores do E2E (`group` → `radiogroup`, `button` → `radio`, `aria-pressed` → `toBeChecked`)**

Linhas que mudam (`grep -rn '"group", { name: "Setor" }' e2e` hoje acha 6; `cadastros.spec.ts` usa `navigation`, não muda):

`e2e/dashboard.spec.ts` 354-360 (teste `(f) P45`):

```ts
  const picker = page.getByRole("radiogroup", { name: "Setor" });
  await expect(
    picker.getByRole("radio", { name: first.sector.name }),
  ).toBeChecked();
  await picker.getByRole("radio", { name: second.sector.name }).click();
  await expect(page).toHaveURL(
    `/dashboard?periodo=30&setor=${second.sector.id}`,
  );
```

`e2e/passagem.spec.ts` 426 (operador não vê o seletor):

```ts
  await expect(page.getByRole("radiogroup", { name: "Setor" })).toHaveCount(0);
```

`e2e/passagem.spec.ts` 453-472 (teste `(e)`):

```ts
  const picker = page.getByRole("radiogroup", { name: "Setor" });
  await expect(picker.getByRole("radio", { name: decoy.name })).toBeChecked();
  await picker.getByRole("radio", { name: data.sector.name }).click();
  await expect(page).toHaveURL(`/?setor=${data.sector.id}`);
  await expect(
    page
      .getByRole("radiogroup", { name: "Setor" })
      .getByRole("radio", { name: data.sector.name }),
  ).toBeChecked();

  await page.goto("/passagens");
  await expect(
    page
      .getByRole("radiogroup", { name: "Setor" })
      .getByRole("radio", { name: data.sector.name }),
  ).toBeChecked();
```

O `toBeChecked()` do Playwright lê `aria-checked` de `role=radio` (não precisa do `<input>` escondido). `e2e/touch-targets.spec.ts` não muda: o seletor `[role=radio]` já está na lista dele e agora mede o seletor deslizante de verdade (44px abaixo de 860px, ver decisão 5).

Run: `grep -rn 'role("group", { name: "Setor"\|aria-pressed' e2e`
Expected: nenhuma linha.

- [ ] **Step 9: Rodar e ver passar**

Run: `bunx vitest run src/components/passagens/SectorPicker.test.tsx src/features/admin/sectors.test.ts src/features/handovers/screenSector.test.ts src/features/handovers/sectorChoice.test.ts src/components/dashboard/DashboardScreen.test.tsx src/components/passagens/HandoverHistory.test.tsx src/components/passagens/HomeHandovers.test.tsx src/components/passagens/NewHandover.test.tsx src/components/passagens/NewHandover.requests.test.tsx src/components/solicitacoes/RequestsScreen.test.tsx src/components/solicitacoes/RequestForm.test.tsx src/components/admin/SectorSwitcher.test.tsx src/components/admin/team/InviteForm.test.tsx src/components/admin/team/PersonForm.test.tsx src/components/admin/team/PersonRowActions.test.tsx src/components/admin/team/TeamAdmin.test.tsx src/components/ui/touchTargets.test.tsx`
Expected: PASS em todos. Se o teste de teclado do `SectorPicker.test.tsx` (`as setas do teclado trocam de setor`) falhar só por o jsdom não entregar o foco ao radio via `userEvent.tab()`, troque o `tab()` por `radio("ULD").focus()` (o contrato do Base UI é o mesmo: o foco por seta seleciona) e mantenha o resto. Se o teste do "pendente" mostrar o `aria-checked` ainda no `ULD`, o `useOptimistic` não aplicou: confira que o `setShownId` é a primeira linha do `startTransition`.

- [ ] **Step 10: Registro do componente (`.context/ui-registry.md`)**

Edit com `old_string` = o bloco inteiro de hoje (linhas 734-740) e `new_string` = o bloco abaixo:

```markdown
### SectorPicker
- **Status:** ✏️ estendido (2026-11-27)
- **Local:** `src/components/passagens/SectorPicker.tsx`
- **Propósito:** o admin escolher o setor no Início, na Nova passagem, no Histórico, em Solicitações e no Dashboard (D-F3-3, C-V8: um seletor só).
- **Como funciona:** `"use client"`; seletor deslizante (segmented control). `RadioGroup` e `Radio.Root` do Base UI: `role="radiogroup"` com `aria-label="Setor"` e um `role="radio"` (`aria-checked`, `aria-label` = nome) por setor ativo; com `allowAll`, o último é "Todos os setores" (`todos`, sem bolinha). As setas do teclado trocam de setor (radio nativo), Tab entra no marcado. Trilho `h-12 p-1 rounded-full bg-seg`, largura `min(100%, max(30rem, N*6.5rem + 0.5rem))` (480px com 4 opções; cresce com mais; rola em `overflow-x-auto` só quando nem o espaço da tela comporta); cada segmento tem `min-w-[6.5rem]`, bolinha de 8px na cor do setor (`SECTOR_COLOR_BG[color]`), nome em Satoshi 15px (`truncate`; 700 no marcado com `text-thumb-foreground`, 500 nos outros). O thumb (`bg-thumb`, `shadow-thumb`: a sombra única do app, token da Task 1) fica em `left: calc(i * 100% / N)` por variáveis CSS (`--i`, `--n`) e desliza em `.4s cubic-bezier(.3,1.25,.4,1)`; `motion-reduce:transition-none` tira o deslize. Clicar chama `chooseSectorAction({ sectorId, path })` dentro de `useTransition`, que grava o cookie `closery_setor` e faz `redirect` para `{path}?setor={id}`; com a prop `query` (o query canônico dos filtros da tela, sem o setor) o payload é `{ sectorId, path, query }` e o servidor o reinterpreta pelo parse da tela (P45); o redirect chega como exceção e segue adiante (`unstable_rethrow`). `useOptimistic` leva o thumb ao setor novo na hora e o devolve se a action falhar. Falha da action ou exceção de rede = `toast.error`. Durante o `pending` o grupo fica `disabled` (`aria-disabled`, sem clique) e os segmentos em `opacity-60`. Clicar no setor já selecionado não faz nada. Selecionado fora da lista: nenhum marcado e thumb oculto. Alvo de toque: o segmento tem 40px acima de 860px e `max-md:h-11` (44px, centrado sobre o padding do trilho) abaixo, para o guarda `e2e/touch-targets.spec.ts`. O `SectorSwitcher` (links) das telas Turnos e Itens continua separado.
- **Usa:** `RadioGroup`, `Radio` (`@base-ui/react`), `SECTOR_COLOR_BG`, tokens `seg`, `thumb`, `thumb-foreground`, `shadow-thumb`, `ring`, `chooseSectorAction`, `sonner`. Recebe `SectorChoice` (agora com `color`).
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 7). 2026-11-25 — Fase 5 (Tarefa 3, P45): prop opcional `query`; sem ela o payload continua exatamente `{ sectorId, path }`. 2026-11-27 — visual novo (Task 7): vira o seletor deslizante em todas as telas (era `fieldset` com um `Button` por setor e `aria-pressed`); semântica `radiogroup`/`radio`; a bolinha usa a `color` que `listActiveSectors` passou a levar na Task 5; sem mudança na lógica nem na assinatura.
```

Run: `bunx vitest run test/uiRegistryDoc.test.ts`
Expected: PASS (o guarda procura o nome `SectorPicker` por arquivo de `src/components/passagens`; a entrada continua lá, nenhum componente novo foi criado).

- [ ] **Step 11: Tipos, lint e formatação**

Run: `bun run check-types`
Expected: sem erros.

Run: `bun run lint`
Expected: sem erros do Biome nos arquivos tocados (se `format` apontar diferença, rode `bunx biome format --write` nos arquivos listados em **Files** e confira o `git diff --stat`).

Run: `bunx vitest run src/app/rawColors.test.ts`
Expected: PASS (existe desde a Task 1; `SectorPicker.tsx` não tem hex, `rgba()` nem classe de cor crua do Tailwind: a sombra do thumb é o token `shadow-thumb`).

- [ ] **Step 12: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/visual/msg-task-7.txt`:

```
feat(setores): seletor de setor deslizante em todas as telas

O SectorPicker vira o segmented control do visual novo (RadioGroup do
Base UI, thumb deslizante, bolinha na cor do setor) no Início, Nova
passagem, Histórico, Solicitações e Dashboard, com a sombra do thumb no
token shadow-thumb. Os testes e o E2E trocam group/button/aria-pressed por
radiogroup/radio/aria-checked.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Run: `git add src/components/passagens/SectorPicker.tsx src/components/passagens/SectorPicker.test.tsx src/features/handovers/screenSector.test.ts src/components/dashboard/DashboardScreen.test.tsx src/components/passagens/HandoverHistory.test.tsx src/components/passagens/HomeHandovers.test.tsx src/components/passagens/NewHandover.test.tsx src/components/solicitacoes/RequestsScreen.test.tsx e2e/dashboard.spec.ts e2e/passagem.spec.ts .context/ui-registry.md && git commit -F .git/sdd/visual/msg-task-7.txt`
Expected: um commit; `git status` limpo (o `codemod-task7.mjs` fica em `.git/`, fora do git).

---

### Task 8: Avatares (DiceBear, `avatarDataUri`, `UserAvatar`)

**Files:**
- Modify: `package.json`, `bun.lock` (dependências exatas)
- Create: `src/lib/avatar.ts`
- Create: `src/components/app-shell/UserAvatar.tsx`
- Modify: `.context/ui-registry.md` (entrada `### UserAvatar`)
- Modify: `.context/library-docs.md` (seção 19, DiceBear; as 17 e 18 são das Tasks 2 e 3)
- Test: `src/lib/avatar.test.ts`, `src/components/app-shell/UserAvatar.test.tsx`

**Interfaces:**
- Consumes (Task 1): utilitários `bg-frame`, `bg-on-pastel`.
- Produces:
  - `src/lib/avatar.ts` (`import "server-only"`): `export const AVATAR_BACKGROUNDS: readonly ["#b6e3f4", "#ffdfbf", "#ffd5dc", "#d1d4f9"]` e `export function avatarDataUri(seed: string): string` (cache em `Map`; semente vazia ou só espaços lança `Error("avatarDataUri: a semente não pode ser vazia")`).
  - `src/components/app-shell/UserAvatar.tsx` (sem `server-only`): `export type UserAvatarSize = 34 | 36 | 44 | 52 | 84;` e `export function UserAvatar({ src, size, tilt, frame, className }: { src: string; size: UserAvatarSize; tilt?: number; frame?: "default" | "on-pastel"; className?: string })`. A moldura é o tamanho cheio (border-box). Padding, raio da moldura e raio da imagem são os do protótipo (`Inicio.dc.html`), que vence a spec nesses valores finos: 34 → 2,5px / 11px / 9px; 36 → 2,5px / 12px / 10px; 44 → 3px / 15px / 12px; 52 → 3px / 17px / 14px; 84 → 4px / 26px / 22px.

- [ ] **Step 1: Instalar as dependências com versão exata**

Run: `bun add @dicebear/core@10.7.0 @dicebear/styles@10.6.0 --exact`
Expected: `installed @dicebear/core@10.7.0` e `installed @dicebear/styles@10.6.0`.

Run: `grep -n "dicebear" package.json`
Expected: exatamente `"@dicebear/core": "10.7.0",` e `"@dicebear/styles": "10.6.0",` (sem `^`) em `dependencies`. Se vier com `^`, edite o `package.json` para tirar o `^` e rode `bun install` de novo (o `bun.lock` é atualizado junto).

Run: `ls node_modules/@dicebear/styles/dist/notionists.min.json`
Expected: o arquivo existe (é o alvo do `exports["./notionists.json"]`).

- [ ] **Step 2: Escrever o teste de `avatarDataUri` (falha)**

Crie `src/lib/avatar.test.ts` (projeto `node` do Vitest; o alias `server-only` já aponta para `test/empty.ts`):

```ts
import { describe, expect, it } from "vitest";

import { AVATAR_BACKGROUNDS, avatarDataUri } from "./avatar";

describe("avatarDataUri", () => {
  it("devolve um data URI de SVG", () => {
    const uri = avatarDataUri("usuario-1");
    expect(uri.startsWith("data:image/svg+xml")).toBe(true);
    expect(decodeURIComponent(uri.slice(uri.indexOf(",") + 1))).toContain(
      "<svg",
    );
  });

  it("é determinístico: a mesma semente dá exatamente o mesmo resultado", () => {
    expect(avatarDataUri("usuario-1")).toBe(avatarDataUri("usuario-1"));
  });

  it("é determinístico mesmo sem o cache (instância nova do módulo)", async () => {
    const primeiro = avatarDataUri("usuario-fixo");
    const { vi } = await import("vitest");
    vi.resetModules();
    const outroModulo = await import("./avatar");
    expect(outroModulo.avatarDataUri("usuario-fixo")).toBe(primeiro);
  });

  it("sementes diferentes dão avatares diferentes", () => {
    expect(avatarDataUri("usuario-1")).not.toBe(avatarDataUri("usuario-2"));
  });

  it("semente de uma letra e semente longa com acento funcionam", () => {
    expect(avatarDataUri("a").startsWith("data:image/svg+xml")).toBe(true);
    const longa = `ação-${"x".repeat(500)}`;
    expect(avatarDataUri(longa).startsWith("data:image/svg+xml")).toBe(true);
  });

  it.each([
    "",
    "   ",
    "\n\t",
  ])("semente vazia (%j) lança erro claro em vez de gerar um avatar anônimo", (seed) => {
    expect(() => avatarDataUri(seed)).toThrow(
      "avatarDataUri: a semente não pode ser vazia",
    );
  });

  it("exporta os quatro fundos pastel da spec (única exceção de cor crua do projeto)", () => {
    expect(AVATAR_BACKGROUNDS).toEqual([
      "#b6e3f4",
      "#ffdfbf",
      "#ffd5dc",
      "#d1d4f9",
    ]);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `bunx vitest run src/lib/avatar.test.ts`
Expected: FAIL com `Failed to resolve import "./avatar"` (o arquivo não existe).

- [ ] **Step 4: Implementar `src/lib/avatar.ts`**

Crie `src/lib/avatar.ts`:

```ts
import "server-only";

import { Avatar, Style } from "@dicebear/core";
import notionists from "@dicebear/styles/notionists.json" with { type: "json" };

// Fundos da arte do avatar: dados do DiceBear, não tokens de interface. É a
// única exceção de cor crua do projeto (ui-tokens.md), e este arquivo é .ts,
// fora do guarda de cor crua dos .tsx.
export const AVATAR_BACKGROUNDS = [
  "#b6e3f4",
  "#ffdfbf",
  "#ffd5dc",
  "#d1d4f9",
] as const;

const style = new Style(notionists);

// ~26 KB por avatar: o cache evita regerar o mesmo SVG a cada render no servidor.
const cache = new Map<string, string>();

/**
 * Avatar `notionists` do DiceBear como data URI (sem requisição a terceiros).
 * A semente é o id do usuário, para o avatar não mudar quando o nome muda.
 */
export function avatarDataUri(seed: string): string {
  if (seed.trim() === "") {
    throw new Error("avatarDataUri: a semente não pode ser vazia");
  }
  const cached = cache.get(seed);
  if (cached !== undefined) return cached;
  const uri = new Avatar(style, {
    seed,
    backgroundColor: [...AVATAR_BACKGROUNDS],
  }).toDataUri();
  cache.set(seed, uri);
  return uri;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `bunx vitest run src/lib/avatar.test.ts`
Expected: PASS (7 grupos de teste verdes). Isto também confirma que o Vitest aceita `with { type: "json" }`.

Fallback se o Vitest recusar o import (erro do tipo `Unexpected token` ou `import attributes`): troque, em `src/lib/avatar.ts`, a linha do JSON por `import notionists from "@dicebear/styles/notionists.json";` (sem o `with`), rode `bun run check-types` e o teste de novo. O `next build` (Turbopack) aceita as duas formas; se o fallback for usado, registre na seção de dúvidas do PR.

- [ ] **Step 6: Escrever o teste de `UserAvatar` (falha)**

Crie `src/components/app-shell/UserAvatar.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UserAvatar } from "./UserAvatar";

const SRC = "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E";

function parts(container: HTMLElement): {
  frame: HTMLElement;
  img: HTMLImageElement;
} {
  const frame = container.firstElementChild;
  const img = container.querySelector("img");
  if (!(frame instanceof HTMLElement) || !img) {
    throw new Error("UserAvatar não renderizou moldura e imagem");
  }
  return { frame, img };
}

describe("UserAvatar — tamanhos, padding e raios (protótipo Inicio.dc.html)", () => {
  it.each([
    [34, "size-[34px]", "p-[2.5px]", "rounded-[11px]", "rounded-[9px]", 29],
    [36, "size-[36px]", "p-[2.5px]", "rounded-[12px]", "rounded-[10px]", 31],
    [44, "size-[44px]", "p-[3px]", "rounded-[15px]", "rounded-[12px]", 38],
    [52, "size-[52px]", "p-[3px]", "rounded-[17px]", "rounded-[14px]", 46],
    [84, "size-[84px]", "p-1", "rounded-[26px]", "rounded-[22px]", 76],
  ] as const)("size=%s: moldura %s %s %s, imagem %s e %spx de lado", (size, sizeClass, padding, frameRadius, imgRadius, inner) => {
    const { container } = render(<UserAvatar src={SRC} size={size} />);
    const { frame, img } = parts(container);
    expect(frame).toHaveClass(sizeClass, padding, frameRadius, "flex-none");
    expect(img).toHaveClass(imgRadius, "size-full");
    expect(img).toHaveAttribute("width", String(inner));
    expect(img).toHaveAttribute("height", String(inner));
  });
});

describe("UserAvatar — imagem decorativa", () => {
  it("usa <img alt=\"\"> com o data URI recebido e não arrastável", () => {
    const { container } = render(<UserAvatar src={SRC} size={44} />);
    const { img } = parts(container);
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("src", SRC);
    expect(img).toHaveAttribute("draggable", "false");
  });

  it("não expõe nada na árvore de acessibilidade (o nome sempre aparece ao lado)", () => {
    const { getByRole, queryByRole } = render(
      <UserAvatar src={SRC} size={44} />,
    );
    expect(queryByRole("img")).toBeNull();
    expect(getByRole("presentation", { hidden: true })).toBeInTheDocument();
  });
});

describe("UserAvatar — moldura e inclinação", () => {
  it("moldura padrão usa bg-frame", () => {
    const { container } = render(<UserAvatar src={SRC} size={44} />);
    const { frame } = parts(container);
    expect(frame).toHaveClass("bg-frame");
    expect(frame).not.toHaveClass("bg-on-pastel");
  });

  it("frame=on-pastel usa bg-on-pastel (sobre os cards coloridos)", () => {
    const { container } = render(
      <UserAvatar src={SRC} size={52} frame="on-pastel" />,
    );
    const { frame } = parts(container);
    expect(frame).toHaveClass("bg-on-pastel");
    expect(frame).not.toHaveClass("bg-frame");
  });

  it("tilt gira a moldura em graus (negativo e positivo)", () => {
    const { container, rerender } = render(
      <UserAvatar src={SRC} size={44} tilt={-4} />,
    );
    expect(parts(container).frame.style.transform).toBe("rotate(-4deg)");
    rerender(<UserAvatar src={SRC} size={36} tilt={3} />);
    expect(parts(container).frame.style.transform).toBe("rotate(3deg)");
  });

  it("sem tilt (ou tilt 0) não escreve transform", () => {
    const { container, rerender } = render(<UserAvatar src={SRC} size={34} />);
    expect(parts(container).frame.style.transform).toBe("");
    rerender(<UserAvatar src={SRC} size={34} tilt={0} />);
    expect(parts(container).frame.style.transform).toBe("");
  });

  it("className de quem usa entra na moldura sem perder as classes fixas", () => {
    const { container } = render(
      <UserAvatar src={SRC} size={84} className="mb-2" />,
    );
    expect(parts(container).frame).toHaveClass("mb-2", "size-[84px]", "bg-frame");
  });
});
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `bunx vitest run src/components/app-shell/UserAvatar.test.tsx`
Expected: FAIL com `Failed to resolve import "./UserAvatar"`.

- [ ] **Step 8: Implementar `UserAvatar`**

Crie `src/components/app-shell/UserAvatar.tsx`:

```tsx
import { cn } from "cn";

export type UserAvatarSize = 34 | 36 | 44 | 52 | 84;

// Classes inteiras e estáticas (o Tailwind só gera o que aparece escrito).
// Moldura = tamanho cheio (border-box). Padding e raios são os do protótipo
// (Inicio.dc.html), que vence a spec nesses valores finos: 2,5px nos de 34 e
// 36, 3px nos de 44 e 52, 4px no de 84; a imagem acompanha a curva da moldura.
const SIZE_CLASSES: Record<
  UserAvatarSize,
  { frame: string; image: string; inner: number }
> = {
  34: {
    frame: "size-[34px] p-[2.5px] rounded-[11px]",
    image: "rounded-[9px]",
    inner: 29,
  },
  36: {
    frame: "size-[36px] p-[2.5px] rounded-[12px]",
    image: "rounded-[10px]",
    inner: 31,
  },
  44: {
    frame: "size-[44px] p-[3px] rounded-[15px]",
    image: "rounded-[12px]",
    inner: 38,
  },
  52: {
    frame: "size-[52px] p-[3px] rounded-[17px]",
    image: "rounded-[14px]",
    inner: 46,
  },
  84: { frame: "size-[84px] p-1 rounded-[26px]", image: "rounded-[22px]", inner: 76 },
};

// Avatar decorativo (alt vazio): o nome da pessoa sempre aparece ao lado.
// `src` é o data URI de `avatarDataUri` (src/lib/avatar.ts), gerado no servidor.
export function UserAvatar({
  src,
  size,
  tilt,
  frame = "default",
  className,
}: {
  src: string;
  size: UserAvatarSize;
  tilt?: number;
  frame?: "default" | "on-pastel";
  className?: string;
}) {
  const sizing = SIZE_CLASSES[size];
  return (
    <div
      className={cn(
        "box-border flex-none",
        sizing.frame,
        frame === "on-pastel" ? "bg-on-pastel" : "bg-frame",
        className,
      )}
      // A inclinação é geometria, não cor: não cabe em token.
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
    >
      {/* biome-ignore lint/performance/noImgElement: data URI de SVG gerado no servidor; next/image não otimiza SVG nem data URI */}
      <img
        src={src}
        alt=""
        width={sizing.inner}
        height={sizing.inner}
        draggable={false}
        className={cn("block size-full", sizing.image)}
      />
    </div>
  );
}
```

- [ ] **Step 9: Rodar e ver passar**

Run: `bunx vitest run src/components/app-shell/UserAvatar.test.tsx src/lib/avatar.test.ts`
Expected: PASS. Se `getByRole("presentation", { hidden: true })` falhar no jsdom (o `img alt=""` tem role `presentation` ou `none` conforme a versão do `aria-query`), troque essa asserção por `expect(container.querySelector("img")?.getAttribute("alt")).toBe("")` e remova o `getByRole`.

- [ ] **Step 10: Entrada no `.context/ui-registry.md`**

Com a ferramenta Edit, insira esta entrada logo ANTES de `### AppError e AppNotFound` (depois da entrada `### Greeting`):

```markdown
### UserAvatar
- **Status:** ✅ pronto (2026-11-27)
- **Local:** `src/components/app-shell/UserAvatar.tsx` (sem `"use client"`, sem `server-only`: só desenha)
- **Propósito:** avatar decorativo da pessoa (sidebar, "Passagem para confirmar", turno, solicitações vazias, convite).
- **Como funciona:** props `{ src, size: 34 | 36 | 44 | 52 | 84, tilt?, frame?: "default" | "on-pastel", className? }`. `src` é o data URI de `avatarDataUri(userId)` (`src/lib/avatar.ts`, `server-only`, DiceBear `notionists`, semente = id do usuário, cache por semente; semente vazia lança erro). Moldura de tamanho cheio com padding e raios do protótipo (34 → 2,5px e 11px; 36 → 2,5px e 12px; 44 → 3px e 15px; 52 → 3px e 17px; 84 → 4px e 26px), imagem com o raio que acompanha a moldura (9, 10, 12, 14 e 22px); `bg-frame` (padrão) ou `bg-on-pastel` sobre os cards coloridos; `tilt` em graus via `style.transform` (geometria, não cor). `<img alt="" draggable={false}>` com `width`/`height`: o nome da pessoa sempre aparece ao lado, então a imagem não entra na árvore de acessibilidade. `biome-ignore noImgElement` com motivo (SVG em data URI não passa pelo `next/image`).
- **Usa:** tokens `frame`, `on-pastel`; `avatarDataUri` (quem chama, no servidor).
- **Histórico:** 2026-11-27 — criado no visual novo do Início (Task 8).
```

Com a ferramenta Edit, em `.context/library-docs.md`, insira a seção 19 logo depois da seção 18 (`next-themes`, da Task 3), antes de `## Como adicionar uma biblioteca nova`:

old_string:
```
## Como adicionar uma biblioteca nova
```
new_string:
```
## 19. DiceBear (`@dicebear/core` 10.7.0 + `@dicebear/styles` 10.6.0) · visual novo

- **Versões exatas, sem `^`** (`bun add ... --exact`). A 10.7.0 de `styles` não existe; a 11.0.0 (2026-11-25) é nova demais
  para a regra das duas semanas. Trocar de versão exige rodar `src/lib/avatar.test.ts`: o determinismo trava mudança de saída.
- **API (conferida no `node_modules` em 2026-11-27):** `import { Avatar, Style } from "@dicebear/core"`,
  `import notionists from "@dicebear/styles/notionists.json" with { type: "json" }`, `new Style(notionists)` uma vez por módulo e
  `new Avatar(style, { seed, backgroundColor: [...] }).toDataUri()` por semente.
- **Só no servidor:** `src/lib/avatar.ts` tem `import "server-only"` e cache em `Map` por semente (~26 KB por data URI). A semente é
  o **id do usuário** (o avatar não muda quando o nome muda); semente vazia lança erro (o DiceBear sozinho geraria um avatar).
  Os componentes recebem o data URI pronto (`UserAvatar src=...`); nenhum client importa `@/lib/avatar`.
- **Sem rede:** nada de `api.dicebear.com`; o SVG nasce no processo do servidor.
- **Cores:** os 4 fundos (`AVATAR_BACKGROUNDS`) são dados da arte, a única exceção de cor crua do projeto (`ui-tokens.md`);
  o arquivo é `.ts`, fora do guarda `rawColors`.
- **Licença:** código MIT; a arte `notionists` é CC0 1.0 (remix de Notionists, de Zoish). Nada a atribuir na interface.
- **`<img>`:** data URI de SVG não passa pelo `next/image`; o `UserAvatar` usa `<img alt="">` com `biome-ignore
  lint/performance/noImgElement` e o motivo.

## Como adicionar uma biblioteca nova
```

- [ ] **Step 11: Verificações da tarefa**

Run: `bun run check-types`
Expected: sem erros (inclui o `import ... with { type: "json" }`).

Run: `bun run lint`
Expected: sem erros. Se o Biome só reclamar de formatação dos testes ou do mapa `SIZE_CLASSES`, rode `bunx biome format --write src/lib/avatar.ts src/lib/avatar.test.ts src/components/app-shell/UserAvatar.tsx src/components/app-shell/UserAvatar.test.tsx` e confira o diff. Se acusar `noImgElement` apesar do `biome-ignore`, mova o comentário para a linha imediatamente acima de `<img` (já está) e confirme que o id da regra é exatamente o que o Biome imprime.

Run: `bunx vitest run src/lib/avatar.test.ts src/components/app-shell/UserAvatar.test.tsx test/uiRegistryDoc.test.ts`
Expected: PASS.

- [ ] **Step 12: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/visual/msg-task-8.txt` e rode
`git add package.json bun.lock src/lib/avatar.ts src/lib/avatar.test.ts src/components/app-shell/UserAvatar.tsx src/components/app-shell/UserAvatar.test.tsx .context/ui-registry.md .context/library-docs.md && git commit -F .git/sdd/visual/msg-task-8.txt`.
Mensagem:

```
feat(avatar): avatares DiceBear no servidor e componente UserAvatar

Adiciona @dicebear/core 10.7.0 e @dicebear/styles 10.6.0 (versões exatas).
avatarDataUri(seed) gera o estilo notionists como data URI, determinístico e com
cache por semente; semente vazia lança erro. UserAvatar desenha a moldura com os
raios da spec, imagem decorativa e inclinação opcional.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 9: App shell (sidebar 280px, cabeçalho 76px, drawer abaixo de 860px, contêiner do conteúdo)

**Files:**
- Create: `src/components/app-shell/AppHeader.tsx`
- Create: `src/components/app-shell/AppHeader.test.tsx`
- Modify: `src/components/app-shell/navItems.ts` (`mainNavItems` e `adminNavItems`; `NAV_ITEMS` e `visibleNavItems` continuam)
- Modify: `src/components/app-shell/AppSidebar.tsx` (wordmark, dois grupos, card do usuário, botão X no drawer; recebe `avatarSrc`)
- Modify: `src/components/app-shell/AuthedSidebar.tsx` (passa `avatarSrc = avatarDataUri(authz.userId)`)
- Modify: `src/components/app-shell/MenuToggle.tsx` (botão redondo de 44px: `PanelLeft` no desktop, `Menu` no celular)
- Modify: `src/components/app-shell/SidebarSkeleton.tsx` (forma nova)
- Modify: `src/components/ui/sidebar.tsx` (`SIDEBAR_WIDTH` 17.5rem, `SIDEBAR_WIDTH_MOBILE` 17.5rem, sem borda no desktop, drawer com sombra, scrim e curva do protótipo)
- Modify: `src/components/ui/sheet.tsx` (`SheetContent` ganha a prop opcional `overlayClassName`; o resto não muda)
- Modify: `src/app/(app)/layout.tsx` (`AppHeader` + contêiner `@container/main`)
- Modify: `e2e/touch-targets.spec.ts` (uma asserção: o drawer aberto tem o botão "Fechar menu")
- Modify: `.context/ui-registry.md` (AppSidebar, AuthedSidebar, SidebarSkeleton, MenuToggle, Sidebar, Sheet; entrada nova AppHeader)
- Modify: `.context/library-docs.md` (seção 20, container queries; a 19 é da Task 8)
- Test: `src/components/app-shell/navItems.test.ts`, `src/components/app-shell/AppSidebar.test.tsx`, `src/components/app-shell/AuthedSidebar.test.tsx`, `src/components/app-shell/MenuToggle.test.tsx`, `src/components/app-shell/SidebarSkeleton.test.tsx`, `src/components/app-shell/AppHeader.test.tsx`, `src/components/ui/sidebar.test.tsx`, `src/app/(app)/layout.test.tsx`

**Interfaces:**
- Consumes (contrato):
  - Task 1: `md` = 860px (`--breakpoint-md: 53.75rem`) e `MOBILE_BREAKPOINT = 860` em `src/hooks/use-mobile.ts`; tokens `bg-background`, `bg-card`, `bg-accent`, `bg-primary`/`text-primary-foreground`, `bg-sidebar`, `text-muted-foreground`, e os extras `shadow-drawer` (sombra da gaveta) e `bg-scrim` (véu da gaveta).
  - Task 2: utilitário `font-heading` (Satoshi).
  - Task 3: `export function ThemeSwitch()` em `src/components/app-shell/ThemeSwitch.tsx`.
  - Task 4: `Button` com `variant="surface"` e `size="icon-pill"` (`size-11`: 44px redondo em qualquer tela, sem `max-md:`; é um dos `ALWAYS_TOUCH_SIZED` do `button.test.ts` da Task 4).
  - Task 8: `avatarDataUri(seed: string): string` em `src/lib/avatar.ts` (`server-only`) e `UserAvatar` com `{ src: string; size: 34 | 36 | 44 | 52 | 84; tilt?: number; frame?: "default" | "on-pastel"; className?: string }` em `src/components/app-shell/UserAvatar.tsx`.
- Produces:
  - `mainNavItems: readonly NavItem[]` (Início, Passagens, Solicitações, Dashboard, Conta) e `adminNavItems: readonly NavItem[]` (Administração); `NAV_ITEMS` (os dois juntos) e `visibleNavItems(isAdmin)` ficam como estão; `isNavItemActive` não muda.
  - `AppSidebar` props: `{ isAdmin: boolean; userName: string; userEmail: string; avatarSrc: string }`.
  - `AuthedSidebar` (servidor) passa `{ isAdmin, userName, userEmail, avatarSrc }` ao `AppSidebar`.
  - `AppHeader()` em `src/components/app-shell/AppHeader.tsx` (client, sem props).
  - `SheetContent` aceita `overlayClassName?: string`.
  - Contêiner do conteúdo (para as Tasks 11 a 14), em dois níveis: o invólucro **sem padding** `@container/main flex w-full flex-1 flex-col` (largura toda do `SidebarInset` = tela menos sidebar, o `mainW` do protótipo) e, dentro dele, `mx-auto flex w-full max-w-[1240px] flex-1 flex-col px-10 pb-12 max-md:px-4`. As container queries das Tasks 11 a 14 (`@min-[1040px]/main:`, `@min-[1040px]/main:@max-[1239px]/main:`, `md:@max-[899px]/main:`) medem o invólucro, então os cortes são os da spec sem descontar o padding. As páginas de `(app)` não precisam mais de padding próprio do layout; o cabeçalho de 76px já fica dentro do div centrado.

**Como o cabeçalho mostra o wordmark só no celular (sem JavaScript, sem piscar):** `AppHeader` e `MenuToggle` são renderizados no servidor e o CSS decide. O wordmark leva `hidden max-md:inline`; o ícone `Menu` leva `hidden max-md:block` e o `PanelLeft` leva `max-md:hidden`. `max-md:` é `@media (width < 53.75rem)` (Task 1), ou seja, abaixo de 860px, o mesmo corte do `useIsMobile` que troca a sidebar pela gaveta. Como é CSS puro, o primeiro paint já está certo nos dois tamanhos (o `useIsMobile` começa em `false` e só corrige depois do efeito, mas a sidebar desktop já é `hidden md:block`).

- [ ] **Step 1: Escrever o teste de `navItems` que falha**

Edição 1 em `src/components/app-shell/navItems.test.ts`: troque o import do topo.

old_string:
```ts
import {
  isNavItemActive,
  NAV_ITEMS,
  visibleNavItems,
} from "@/components/app-shell/navItems";
```
new_string:
```ts
import {
  adminNavItems,
  isNavItemActive,
  mainNavItems,
  NAV_ITEMS,
  visibleNavItems,
} from "@/components/app-shell/navItems";
```

Edição 2 no mesmo arquivo: acrescente um bloco no fim do arquivo.

old_string:
```ts
  it("rota diferente não é ativa", () => {
    expect(isNavItemActive("/entrar", "/conta")).toBe(false);
  });
});
```
new_string:
```ts
  it("rota diferente não é ativa", () => {
    expect(isNavItemActive("/entrar", "/conta")).toBe(false);
  });
});

describe("grupos do menu (mainNavItems e adminNavItems)", () => {
  it("o grupo principal tem os cinco itens abertos a todos, nesta ordem", () => {
    expect(mainNavItems.map((item) => item.label)).toEqual([
      "Início",
      "Passagens",
      "Solicitações",
      "Dashboard",
      "Conta",
    ]);
    expect(mainNavItems.some((item) => item.adminOnly)).toBe(false);
  });

  it("o grupo de administração tem só Administração, restrita a admin", () => {
    expect(adminNavItems.map((item) => item.href)).toEqual(["/admin"]);
    expect(adminNavItems.every((item) => item.adminOnly)).toBe(true);
  });

  it("NAV_ITEMS é a soma dos dois grupos, sem item repetido", () => {
    expect(NAV_ITEMS).toEqual([...mainNavItems, ...adminNavItems]);
    expect(new Set(NAV_ITEMS.map((item) => item.href)).size).toBe(
      NAV_ITEMS.length,
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bunx vitest run src/components/app-shell/navItems.test.ts`
Expected: FAIL (os três testes novos com `mainNavItems`/`adminNavItems` indefinidos: "Cannot read properties of undefined (reading 'map')").

- [ ] **Step 3: Implementar `navItems.ts`**

Substitua o bloco `export const NAV_ITEMS ...` inteiro (do `export const NAV_ITEMS` até o `];` que o fecha, antes de `visibleNavItems`) por:

```ts
export const mainNavItems: readonly NavItem[] = [
  { href: "/", label: "Início", icon: House, adminOnly: false },
  {
    href: "/passagens",
    label: "Passagens",
    icon: ClipboardList,
    adminOnly: false,
  },
  {
    href: "/solicitacoes",
    label: "Solicitações",
    icon: PackageOpen,
    adminOnly: false,
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: ChartColumn,
    adminOnly: false,
  },
  { href: "/conta", label: "Conta", icon: UserRound, adminOnly: false },
];

export const adminNavItems: readonly NavItem[] = [
  {
    href: "/admin",
    label: "Administração",
    icon: ShieldCheck,
    adminOnly: true,
  },
];

export const NAV_ITEMS: readonly NavItem[] = [
  ...mainNavItems,
  ...adminNavItems,
];
```

(`visibleNavItems` e `isNavItemActive` ficam exatamente como estão.)

- [ ] **Step 4: Rodar e ver passar**

Run: `bunx vitest run src/components/app-shell/navItems.test.ts`
Expected: PASS (todos os testes do arquivo, os antigos e os 3 novos).

- [ ] **Step 5: Escrever os testes das primitivas (`sidebar.tsx` e `sheet.tsx`) que falham**

Edição 1 em `src/components/ui/sidebar.test.tsx`: troque o import do topo.

old_string:
```tsx
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
```
new_string:
```tsx
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
```

Edição 2: acrescente no fim do arquivo (depois do último `});`).

old_string:
```tsx
    expect(heightUnit(className, "max-md:")).toBe(TOUCH_UNIT);
  });
});
```
new_string:
```tsx
    expect(heightUnit(className, "max-md:")).toBe(TOUCH_UNIT);
  });
});

describe("Sidebar — visual novo (280px, sem borda)", () => {
  function renderDesktop() {
    return render(
      <TooltipProvider>
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>conteúdo</SidebarContent>
          </Sidebar>
        </SidebarProvider>
      </TooltipProvider>,
    );
  }

  it("a largura da barra é 17.5rem (280px)", () => {
    const { container } = renderDesktop();
    const wrapper = container.querySelector<HTMLElement>(
      '[data-slot="sidebar-wrapper"]',
    );
    expect(wrapper?.style.getPropertyValue("--sidebar-width")).toBe("17.5rem");
  });

  it("no desktop a barra não tem borda lateral", () => {
    const { container } = renderDesktop();
    const panel = container.querySelector<HTMLElement>(
      '[data-slot="sidebar-container"]',
    );
    expect(panel).not.toBeNull();
    expect(panel?.className).not.toMatch(/(^|[\s:])border-[rl]($|\s)/);
  });

  it("o corpo da barra usa o token bg-sidebar", () => {
    const { container } = renderDesktop();
    const inner = container.querySelector<HTMLElement>(
      '[data-slot="sidebar-inner"]',
    );
    expect(inner?.className).toContain("bg-sidebar");
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `bunx vitest run src/components/ui/sidebar.test.tsx`
Expected: FAIL com `expected '16rem' to be '17.5rem'` e, no teste da borda, a classe `group-data-[side=left]:border-r` ainda presente.

- [ ] **Step 7: Implementar as primitivas**

`src/components/ui/sheet.tsx`, em `SheetContent`: a prop `overlayClassName` vai para o `SheetOverlay` (o resto fica igual; sem a prop, o comportamento de hoje se mantém).

old_string:
```tsx
  side = "right",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
```
new_string:
```tsx
  side = "right",
  showCloseButton = true,
  overlayClassName,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
  overlayClassName?: string;
}) {
  return (
    <SheetPortal>
      <SheetOverlay className={overlayClassName} />
```

`src/components/ui/sidebar.tsx`, três edições.

1. Larguras.

old_string:
```tsx
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
```
new_string:
```tsx
const SIDEBAR_WIDTH = "17.5rem";
const SIDEBAR_WIDTH_MOBILE = "17.5rem";
```

2. Gaveta do celular: largura da barra (a `data-[side=left]:w-3/4` do `Sheet` perdia para a classe sem variante), sem borda, a sombra `data-[side=left]:shadow-drawer` (token da Task 1: `20px 0 60px`; com o variante para vencer, por especificidade, o `shadow-lg` da base do `SheetContent`, que o `cn` não reconhece como conflito de um token próprio), curva `cubic-bezier(.2,.8,.2,1)` em 350ms, deslize de −105% sem fade, e o scrim `bg-scrim` (token da Task 1: preto a 45%) sem blur. `motion-reduce` desliga a transição. Nenhum `rgba(...)` no `.tsx` (o guarda `rawColors` recusa cor em valor arbitrário).

old_string:
```tsx
          className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
```
new_string:
```tsx
          className="bg-sidebar p-0 text-sidebar-foreground duration-[350ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none data-[side=left]:w-(--sidebar-width) data-[side=left]:border-r-0 data-[side=left]:shadow-drawer data-[side=left]:sm:max-w-none data-[side=left]:data-starting-style:translate-x-[-105%] data-[side=left]:data-ending-style:translate-x-[-105%] data-starting-style:opacity-100 data-ending-style:opacity-100 [&>button]:hidden"
          overlayClassName="bg-scrim supports-backdrop-filter:backdrop-blur-none"
```

3. Desktop sem borda.

old_string:
```tsx
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
```
new_string:
```tsx
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
```

- [ ] **Step 8: Rodar e ver passar**

Run: `bunx vitest run src/components/ui/sidebar.test.tsx src/components/ui/touchTargets.test.tsx`
Expected: PASS (o teste de `h-9 max-md:h-11` do `SidebarMenuButton` continua verde: o `default` do componente não mudou, o visual novo vem por `className` no `AppSidebar`).

- [ ] **Step 9: Escrever os testes do `AppSidebar` e do `AuthedSidebar` que falham**

Substitua o arquivo inteiro `src/components/app-shell/AppSidebar.test.tsx` (use a ferramenta Write):

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/components/app-shell/AppSidebar";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const mocks = vi.hoisted(() => ({ pathname: "/", isMobile: false }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

// O jsdom não mede viewport: o teste decide se a barra é a do desktop ou a
// gaveta do celular.
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mocks.isMobile,
}));

const AVATAR = "data:image/svg+xml;utf8,avatar-de-teste";

// Expõe o estado da gaveta do celular e deixa o teste abri-la.
function MobileSheetProbe() {
  const { openMobile, setOpenMobile } = useSidebar();
  return (
    <>
      <output aria-label="gaveta">{openMobile ? "aberta" : "fechada"}</output>
      <button type="button" onClick={() => setOpenMobile(true)}>
        abrir gaveta
      </button>
    </>
  );
}

function renderSidebar(props: Partial<Parameters<typeof AppSidebar>[0]> = {}) {
  return render(
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar
          isAdmin={false}
          userName="Maria Souza"
          userEmail="maria@example.com"
          avatarSrc={AVATAR}
          {...props}
        />
        <MobileSheetProbe />
      </SidebarProvider>
    </TooltipProvider>,
  );
}

describe("AppSidebar", () => {
  beforeEach(() => {
    mocks.pathname = "/";
    mocks.isMobile = false;
  });

  it("operador vê Início, Passagens e Conta, e não vê Administração", () => {
    renderSidebar({ isAdmin: false });

    expect(screen.getByRole("link", { name: "Passagens" })).toHaveAttribute(
      "href",
      "/passagens",
    );

    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Conta" })).toHaveAttribute(
      "href",
      "/conta",
    );
    expect(
      screen.queryByRole("link", { name: "Administração" }),
    ).not.toBeInTheDocument();
  });

  it("operador e admin veem o Dashboard apontando para /dashboard", () => {
    const { unmount } = renderSidebar({ isAdmin: false });
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    unmount();

    renderSidebar({ isAdmin: true });
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("Dashboard fica ativo em /dashboard e só nele", () => {
    mocks.pathname = "/dashboard";
    renderSidebar();

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Passagens" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("admin vê Administração apontando para /admin", () => {
    renderSidebar({ isAdmin: true });

    expect(screen.getByRole("link", { name: "Administração" })).toHaveAttribute(
      "href",
      "/admin",
    );
  });

  it("marca só o item da rota atual com aria-current", () => {
    mocks.pathname = "/conta";
    renderSidebar({ isAdmin: true });

    expect(screen.getByRole("link", { name: "Conta" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Início" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(
      screen.getByRole("link", { name: "Administração" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("Passagens fica ativo em /passagens/nova e Início não", () => {
    mocks.pathname = "/passagens/nova";
    renderSidebar();

    expect(screen.getByRole("link", { name: "Passagens" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Início" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("Início fica ativo na raiz", () => {
    mocks.pathname = "/";
    renderSidebar();

    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("subrota de /admin mantém Administração ativo", () => {
    mocks.pathname = "/admin/equipe";
    renderSidebar({ isAdmin: true });

    expect(screen.getByRole("link", { name: "Administração" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("rota fora do menu não marca nenhum item", () => {
    mocks.pathname = "/bem-vindo";
    renderSidebar({ isAdmin: true });

    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("mostra nome e e-mail da pessoa no card do usuário", () => {
    renderSidebar({ userName: "Maria Souza", userEmail: "maria@example.com" });

    expect(screen.getByText("Maria Souza")).toBeInTheDocument();
    expect(screen.getByText("maria@example.com")).toBeInTheDocument();
  });

  it("fecha a gaveta do celular ao navegar", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: "abrir gaveta" }));
    expect(screen.getByLabelText("gaveta")).toHaveTextContent("aberta");

    await user.click(screen.getByRole("link", { name: "Conta" }));
    expect(screen.getByLabelText("gaveta")).toHaveTextContent("fechada");
  });
});

describe("AppSidebar: forma nova", () => {
  beforeEach(() => {
    mocks.pathname = "/";
    mocks.isMobile = false;
  });

  it("mostra o wordmark Closery", () => {
    renderSidebar();

    const wordmark = screen.getByText("Closery");
    expect(wordmark.className).toContain("font-heading");
    expect(wordmark.className).toContain("font-black");
  });

  it("o grupo Principal tem os cinco itens, na ordem", () => {
    renderSidebar();

    const main = screen.getByRole("navigation", { name: "Principal" });
    expect(
      within(main)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Início", "Passagens", "Solicitações", "Dashboard", "Conta"]);
  });

  it("o grupo Administração existe só para o admin e tem só um item", () => {
    const { unmount } = renderSidebar({ isAdmin: false });
    expect(
      screen.queryByRole("navigation", { name: "Administração" }),
    ).not.toBeInTheDocument();
    unmount();

    renderSidebar({ isAdmin: true });
    const admin = screen.getByRole("navigation", { name: "Administração" });
    expect(within(admin).getAllByRole("link")).toHaveLength(1);
    expect(
      within(admin).getByRole("link", { name: "Administração" }),
    ).toHaveAttribute("href", "/admin");
  });

  it("os itens são pílulas de 48px com a fonte display", () => {
    renderSidebar();

    const classes = screen
      .getByRole("link", { name: "Passagens" })
      .className.split(" ");
    expect(classes).toContain("h-12");
    expect(classes).toContain("rounded-full");
    expect(classes).toContain("font-heading");
    expect(classes).toContain("data-active:bg-primary");
    expect(classes).not.toContain("h-9");
  });

  it("o card do usuário mostra o avatar decorativo e o chip COLEGA", () => {
    const { container } = renderSidebar({ isAdmin: false });

    const avatar = container.querySelector("img");
    expect(avatar).not.toBeNull();
    expect(avatar).toHaveAttribute("src", AVATAR);
    expect(avatar).toHaveAttribute("alt", "");
    expect(screen.getByText("COLEGA")).toBeInTheDocument();
    expect(screen.queryByText("ADMIN")).not.toBeInTheDocument();
  });

  it("admin vê o chip ADMIN, e não COLEGA", () => {
    renderSidebar({ isAdmin: true });

    expect(screen.getByText("ADMIN")).toBeInTheDocument();
    expect(screen.queryByText("COLEGA")).not.toBeInTheDocument();
  });

  it("nome e e-mail muito longos ficam truncados (não estouram o card)", () => {
    renderSidebar({
      userName: "Fulana de Tal da Silva Sauro Teste Muito Comprida",
      userEmail: "endereco.muito.comprido.de.teste@example.com",
    });

    expect(
      screen.getByText("Fulana de Tal da Silva Sauro Teste Muito Comprida")
        .className,
    ).toContain("truncate");
    expect(
      screen.getByText("endereco.muito.comprido.de.teste@example.com")
        .className,
    ).toContain("truncate");
  });

  it("no desktop não existe o botão Fechar menu (ele é só do drawer)", () => {
    renderSidebar();

    expect(
      screen.queryByRole("button", { name: "Fechar menu" }),
    ).not.toBeInTheDocument();
  });
});

describe("AppSidebar: drawer do celular", () => {
  beforeEach(() => {
    mocks.pathname = "/";
    mocks.isMobile = true;
  });

  it("aberto, mostra o botão X e ele fecha a gaveta", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: "abrir gaveta" }));
    expect(screen.getByLabelText("gaveta")).toHaveTextContent("aberta");

    await user.click(
      await screen.findByRole("button", { name: "Fechar menu", exact: true }),
    );
    expect(screen.getByLabelText("gaveta")).toHaveTextContent("fechada");
  });

  it("tocar num item fecha a gaveta e o item ativo mantém aria-current", async () => {
    const user = userEvent.setup();
    mocks.pathname = "/conta";
    renderSidebar();

    await user.click(screen.getByRole("button", { name: "abrir gaveta" }));
    const conta = await screen.findByRole("link", { name: "Conta" });
    expect(conta).toHaveAttribute("aria-current", "page");

    await user.click(conta);
    expect(screen.getByLabelText("gaveta")).toHaveTextContent("fechada");
  });

  it("a gaveta tem 280px, sem borda, com a sombra do token, e o scrim é o token bg-scrim sem blur", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: "abrir gaveta" }));
    await screen.findByRole("button", { name: "Fechar menu", exact: true });

    const panel = document.querySelector<HTMLElement>(
      '[data-slot="sheet-content"]',
    );
    const scrim = document.querySelector<HTMLElement>(
      '[data-slot="sheet-overlay"]',
    );
    expect(panel).not.toBeNull();
    expect(scrim).not.toBeNull();

    const panelClasses = (panel?.className ?? "").split(" ");
    expect(panelClasses).toContain("data-[side=left]:w-(--sidebar-width)");
    expect(panelClasses).not.toContain("data-[side=left]:w-3/4");
    expect(panelClasses).toContain("data-[side=left]:border-r-0");
    expect(panelClasses).not.toContain("data-[side=left]:border-r");
    expect(panelClasses).toContain("data-[side=left]:shadow-drawer");
    expect(panel?.className ?? "").not.toMatch(/rgba?\(/);
    expect(panelClasses).toContain("duration-[350ms]");
    expect(panelClasses).toContain("motion-reduce:transition-none");
    expect(panelClasses).toContain(
      "data-[side=left]:data-starting-style:translate-x-[-105%]",
    );

    const scrimClasses = (scrim?.className ?? "").split(" ");
    expect(scrimClasses).toContain("bg-scrim");
    expect(scrimClasses).not.toContain("bg-black/10");
    expect(scrimClasses).toContain("supports-backdrop-filter:backdrop-blur-none");
  });

  it("o botão X tem 44px (icon-pill) e o rótulo acessível do protótipo", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: "abrir gaveta" }));
    const close = await screen.findByRole("button", {
      name: "Fechar menu",
      exact: true,
    });
    expect(close).toHaveAttribute("aria-label", "Fechar menu");
    // O tamanho em si é testado no Button (Task 4): o `icon-pill` é `size-11`
    // (44px) em qualquer tela; o guarda de 44px do E2E mede de verdade.
    expect(close.className.split(" ")).toContain("size-11");
    expect(close.className).toContain("bg-card");
  });
});
```

Substitua o arquivo inteiro `src/components/app-shell/AuthedSidebar.test.tsx`:

```tsx
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/components/app-shell/AppSidebar";
import { AuthedSidebar } from "@/components/app-shell/AuthedSidebar";
import type { Authz } from "@/features/authz/authz";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  avatarDataUri: vi.fn((seed: string) => `data:avatar/${seed}`),
}));

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/avatar", () => ({ avatarDataUri: mocks.avatarDataUri }));

function authz(overrides: Partial<Authz> = {}): Authz {
  return {
    userId: "u1",
    name: "Maria Souza",
    email: "maria@example.com",
    role: "operator",
    sectorId: "s1",
    ...overrides,
  };
}

describe("AuthedSidebar", () => {
  beforeEach(() => {
    mocks.requireUser.mockReset();
    mocks.avatarDataUri.mockClear();
  });

  it("operador: isAdmin false, com nome, e-mail e avatar (semente = id) da sessão", async () => {
    mocks.requireUser.mockResolvedValue(authz());

    const element = await AuthedSidebar();

    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(AppSidebar);
    expect(element.props).toEqual({
      isAdmin: false,
      userName: "Maria Souza",
      userEmail: "maria@example.com",
      avatarSrc: "data:avatar/u1",
    });
    expect(mocks.avatarDataUri).toHaveBeenCalledWith("u1");
  });

  it("o avatar nasce do id, não do nome (trocar o nome não troca o avatar)", async () => {
    mocks.requireUser.mockResolvedValue(authz({ name: "Outro Nome" }));

    const element = await AuthedSidebar();

    expect(element.props.avatarSrc).toBe("data:avatar/u1");
  });

  it("admin: isAdmin true", async () => {
    mocks.requireUser.mockResolvedValue(
      authz({ role: "admin", sectorId: null }),
    );

    const element = await AuthedSidebar();

    expect(element.props.isAdmin).toBe(true);
  });

  it("sem sessão, propaga o redirect de requireUser e não gera avatar", async () => {
    mocks.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(AuthedSidebar()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.avatarDataUri).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 10: Rodar e ver falhar**

Run: `bunx vitest run src/components/app-shell/AppSidebar.test.tsx src/components/app-shell/AuthedSidebar.test.tsx`
Expected: FAIL (`Unable to find an accessible element with the role "navigation" and name "Principal"`, `avatarSrc` ausente em `AuthedSidebar`, e o `@/lib/avatar` mockado ainda não importado).

- [ ] **Step 11: Implementar o `AppSidebar`**

Substitua o arquivo inteiro `src/components/app-shell/AppSidebar.tsx`:

```tsx
"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  adminNavItems,
  isNavItemActive,
  mainNavItems,
  type NavItem,
} from "@/components/app-shell/navItems";
import { UserAvatar } from "@/components/app-shell/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type AppSidebarProps = {
  isAdmin: boolean;
  userName: string;
  userEmail: string;
  avatarSrc: string;
};

// Item da navegação: pílula de 48px (não encolhe no celular), Satoshi 16/700,
// ícone de 18px. O ativo é o botão primário; o hover é o `accent` em 150ms.
// As variantes `data-active:*` repetem hover e pressionado para o ativo não
// perder a cor quando o ponteiro passa por cima.
const NAV_ITEM_CLASS =
  "h-12 gap-3 rounded-full px-[18px] font-heading text-base font-bold transition-colors duration-150 motion-reduce:transition-none max-md:h-12 hover:bg-accent hover:text-foreground active:bg-accent active:text-foreground data-active:bg-primary data-active:font-bold data-active:text-primary-foreground data-active:hover:bg-primary data-active:hover:text-primary-foreground data-active:active:bg-primary data-active:active:text-primary-foreground [&_svg]:size-[18px]";

type NavGroupProps = {
  label: string;
  items: readonly NavItem[];
  pathname: string;
  onNavigate: () => void;
};

function NavGroup({ label, items, pathname, onNavigate }: NavGroupProps) {
  return (
    <nav aria-label={label} className="rounded-[28px] bg-card">
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu className="gap-0.5">
            {items.map(({ href, label: itemLabel, icon: Icon }) => {
              const isActive = isNavItemActive(pathname, href);
              return (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    className={NAV_ITEM_CLASS}
                    isActive={isActive}
                    render={
                      <Link
                        href={href}
                        aria-current={isActive ? "page" : undefined}
                        onClick={onNavigate}
                      />
                    }
                  >
                    <Icon strokeWidth={2.2} aria-hidden="true" />
                    <span>{itemLabel}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </nav>
  );
}

export function AppSidebar({
  isAdmin,
  userName,
  userEmail,
  avatarSrc,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const closeDrawer = () => setOpenMobile(false);

  return (
    <Sidebar>
      <SidebarHeader className="flex-row items-center justify-between gap-3 px-6 pt-[22px] pb-0">
        <span className="font-heading text-[28px] leading-none font-black tracking-[-0.03em]">
          Closery
        </span>
        {isMobile ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="surface"
                  size="icon-pill"
                  aria-label="Fechar menu"
                  onClick={closeDrawer}
                />
              }
            >
              <X strokeWidth={2.2} aria-hidden="true" className="size-[18px]" />
            </TooltipTrigger>
            <TooltipContent>Fechar menu</TooltipContent>
          </Tooltip>
        ) : null}
      </SidebarHeader>
      <SidebarContent className="gap-5 px-4 pt-5">
        <NavGroup
          label="Principal"
          items={mainNavItems}
          pathname={pathname}
          onNavigate={closeDrawer}
        />
        {isAdmin ? (
          <NavGroup
            label="Administração"
            items={adminNavItems}
            pathname={pathname}
            onNavigate={closeDrawer}
          />
        ) : null}
      </SidebarContent>
      <SidebarFooter className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-3 rounded-[24px] bg-card p-3">
          <UserAvatar src={avatarSrc} size={44} tilt={-4} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate font-heading text-[15px] font-bold">
              {userName}
            </span>
            <span className="truncate text-[12.5px] text-muted-foreground">
              {userEmail}
            </span>
          </div>
          <span className="h-6 shrink-0 rounded-full bg-accent px-[9px] font-mono text-[11px] leading-6 font-medium tracking-[.02em]">
            {isAdmin ? "ADMIN" : "COLEGA"}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
```

Observações para quem implementa:
- `Sidebar` (desktop) já é `hidden md:block`; em 860px ou mais ele aparece e abaixo disso só existe a gaveta. `SidebarGroup` traz `p-2` (os 8px de padding do grupo) e `SidebarMenu` o `flex-col`; o `gap-0.5` do `SidebarMenu` dá os 2px entre itens.
- `SidebarHeader` tem `p-2` de base: `px-6` (8 + 16) é o padding de 16px da sidebar mais os 8px laterais do wordmark. `SidebarContent` com `px-4`, e `SidebarFooter` com `px-4 pb-4`, dão os 16px do protótipo. O espaçador do protótipo (`flex:1`) é o próprio `SidebarContent` (`flex-1`).
- `NAV_ITEM_CLASS` foi conferido contra o `cn` do projeto (`node_modules/cn`): `h-12`, `rounded-full`, `data-active:bg-primary` etc. substituem `h-9`, `rounded-md`, `data-active:bg-sidebar-accent`, `max-md:h-11`.
- Sem cor crua: só `bg-card`, `bg-accent`, `bg-primary`, `text-muted-foreground`.

- [ ] **Step 12: Implementar o `AuthedSidebar`**

Substitua o arquivo inteiro `src/components/app-shell/AuthedSidebar.tsx`:

```tsx
import { AppSidebar } from "@/components/app-shell/AppSidebar";
import { requireUser } from "@/lib/auth/session";
import { avatarDataUri } from "@/lib/avatar";

// Lê a sessão no servidor, por isso vive atrás de <Suspense> no layout.
// O avatar nasce aqui (o gerador é server-only) e desce como data URI pronto
// para o AppSidebar, que é client. A semente é o id: o avatar não muda se a
// pessoa trocar de nome.
export async function AuthedSidebar() {
  const authz = await requireUser();

  return (
    <AppSidebar
      isAdmin={authz.role === "admin"}
      userName={authz.name}
      userEmail={authz.email}
      avatarSrc={avatarDataUri(authz.userId)}
    />
  );
}
```

- [ ] **Step 13: Rodar e ver passar**

Run: `bunx vitest run src/components/app-shell/AppSidebar.test.tsx src/components/app-shell/AuthedSidebar.test.tsx`
Expected: PASS (todos). Se o teste "a gaveta tem 280px..." falhar por uma classe, confira o `className` na saída do erro: o `cn` do projeto (`node_modules/cn`) é quem mescla, e os tokens esperados foram conferidos com ele em 2026-11-27.

(Este passo depende de `UserAvatar` da Task 8 já existir em `src/components/app-shell/UserAvatar.tsx`.)

- [ ] **Step 14: Escrever os testes do `MenuToggle` e do `AppHeader` que falham**

Edição em `src/components/app-shell/MenuToggle.test.tsx` (acrescente no fim do `describe`):

old_string:
```tsx
    await userEvent.click(
      screen.getByRole("button", { name: "Alternar menu" }),
    );
    expect(state).toHaveTextContent("collapsed");
  });
});
```
new_string:
```tsx
    await userEvent.click(
      screen.getByRole("button", { name: "Alternar menu" }),
    );
    expect(state).toHaveTextContent("collapsed");
  });

  it("clicar duas vezes recolhe e expande de novo (o estado é do SidebarProvider)", async () => {
    setup();
    const state = screen.getByLabelText("estado da barra");
    const button = screen.getByRole("button", { name: "Alternar menu" });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(state).toHaveTextContent("expanded");
  });

  it("é o botão redondo de 44px (surface, icon-pill)", () => {
    setup();
    const classes = screen
      .getByRole("button", { name: "Alternar menu" })
      .className.split(" ");
    expect(classes).toContain("rounded-full");
    // `icon-pill` (Task 4) é `size-11` em qualquer tela, sem `max-md:`.
    expect(classes).toContain("size-11");
    expect(classes).toContain("bg-card");
  });

  it("tem os dois ícones: PanelLeft só no desktop e Menu só no celular", () => {
    const { container } = setup();
    const desktop = container.querySelector<SVGElement>(
      '[data-viewport="desktop"]',
    );
    const mobile = container.querySelector<SVGElement>(
      '[data-viewport="mobile"]',
    );

    expect(desktop).not.toBeNull();
    expect(mobile).not.toBeNull();
    expect(desktop?.getAttribute("class")).toContain("max-md:hidden");
    expect(mobile?.getAttribute("class")).toContain("hidden");
    expect(mobile?.getAttribute("class")).toContain("max-md:block");
    expect(desktop).toHaveAttribute("aria-hidden", "true");
    expect(mobile).toHaveAttribute("aria-hidden", "true");
  });
});
```

Crie `src/components/app-shell/AppHeader.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppHeader } from "@/components/app-shell/AppHeader";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/components/app-shell/ThemeSwitch", () => ({
  ThemeSwitch: () => <div data-testid="theme-switch" />,
}));

function setup() {
  return render(
    <TooltipProvider>
      <SidebarProvider>
        <AppHeader />
      </SidebarProvider>
    </TooltipProvider>,
  );
}

describe("AppHeader", () => {
  it("tem 76px de altura, sem borda inferior", () => {
    const { container } = setup();
    const header = container.querySelector("header");

    expect(header).not.toBeNull();
    const classes = (header?.className ?? "").split(" ");
    expect(classes).toContain("h-[76px]");
    expect(classes).toContain("justify-between");
    expect(classes.some((name) => name.startsWith("border"))).toBe(false);
  });

  it("o botão de menu fica à esquerda e o ThemeSwitch à direita", () => {
    const { container } = setup();
    const header = container.querySelector("header");
    const toggle = screen.getByRole("button", { name: "Alternar menu" });
    const theme = screen.getByTestId("theme-switch");

    expect(header).toContainElement(toggle);
    expect(header).toContainElement(theme);
    expect(
      toggle.compareDocumentPosition(theme) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(header?.lastElementChild).toBe(theme);
  });

  it("o wordmark do cabeçalho só aparece abaixo de 860px (max-md)", () => {
    const { container } = setup();
    const header = container.querySelector("header");
    const wordmark = screen.getByText("Closery");

    expect(header).toContainElement(wordmark);
    const classes = wordmark.className.split(" ");
    expect(classes).toContain("hidden");
    expect(classes).toContain("max-md:inline");
    expect(classes).toContain("font-heading");
    expect(classes).toContain("text-2xl");
  });
});
```

- [ ] **Step 15: Rodar e ver falhar**

Run: `bunx vitest run src/components/app-shell/MenuToggle.test.tsx src/components/app-shell/AppHeader.test.tsx`
Expected: FAIL (`Failed to resolve import "@/components/app-shell/AppHeader"` e, no `MenuToggle`, `expected null not to be null` para `[data-viewport="desktop"]`).

- [ ] **Step 16: Implementar o `MenuToggle` e o `AppHeader`**

Substitua o arquivo inteiro `src/components/app-shell/MenuToggle.tsx`:

```tsx
"use client";

import { Menu, PanelLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Botão só com ícone: aria-label + tooltip (regra do AGENTS.md). Redondo, 44px
// (`icon-pill`). O ícone troca por CSS, sem esperar o JavaScript: acima de
// 860px é o PanelLeft (recolhe e expande a barra, estado em cookie do
// SidebarProvider); abaixo disso é o Menu (abre a gaveta). `max-md:` é o mesmo
// corte de 860px do useIsMobile.
export function MenuToggle() {
  const { toggleSidebar } = useSidebar();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="surface"
            size="icon-pill"
            aria-label="Alternar menu"
            onClick={toggleSidebar}
          />
        }
      >
        <PanelLeft
          data-viewport="desktop"
          strokeWidth={2.2}
          aria-hidden="true"
          className="size-[18px] max-md:hidden"
        />
        <Menu
          data-viewport="mobile"
          strokeWidth={2.2}
          aria-hidden="true"
          className="hidden size-[18px] max-md:block"
        />
        <span className="sr-only">Alternar menu</span>
      </TooltipTrigger>
      <TooltipContent>Alternar menu</TooltipContent>
    </Tooltip>
  );
}
```

Crie `src/components/app-shell/AppHeader.tsx`:

```tsx
"use client";

import { MenuToggle } from "@/components/app-shell/MenuToggle";
import { ThemeSwitch } from "@/components/app-shell/ThemeSwitch";

// Cabeçalho de 76px, sem borda. À esquerda o botão de menu (e, só abaixo de
// 860px, o wordmark); à direita o switch de tema. O wordmark usa `hidden
// max-md:inline`: `md` é 860px (Task 1), então ele só aparece no celular, onde
// a sidebar fixa não está na tela para mostrar o nome do app.
export function AppHeader() {
  return (
    <header className="flex h-[76px] shrink-0 items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <MenuToggle />
        <span className="hidden font-heading text-2xl leading-none font-black tracking-[-0.03em] max-md:inline">
          Closery
        </span>
      </div>
      <ThemeSwitch />
    </header>
  );
}
```

- [ ] **Step 17: Rodar e ver passar**

Run: `bunx vitest run src/components/app-shell/MenuToggle.test.tsx src/components/app-shell/AppHeader.test.tsx`
Expected: PASS (o teste do tooltip "mostra o tooltip 'Alternar menu' ao passar o mouse" continua verde: o `sr-only` mantém `getAllByText` em 1 antes do hover e 2 depois).

- [ ] **Step 18: Escrever o teste do `SidebarSkeleton` que falha**

Edição em `src/components/app-shell/SidebarSkeleton.test.tsx` (acrescente dentro do `describe`):

old_string:
```tsx
    expect(classes).toContain("hidden");
    expect(classes).toContain("md:flex");
  });
});
```
new_string:
```tsx
    expect(classes).toContain("hidden");
    expect(classes).toContain("md:flex");
  });

  it("tem a forma nova: wordmark, grupo de navegação e card do usuário, sem borda", () => {
    const { container } = render(<SidebarSkeleton />);
    const root = container.firstElementChild as HTMLElement;
    const classes = root.className.split(" ");

    expect(classes).toContain("bg-sidebar");
    expect(classes).not.toContain("border-r");
    expect(root.children).toHaveLength(3);
    expect((root.children[1] as HTMLElement).className).toContain(
      "rounded-[28px]",
    );
    expect((root.children[2] as HTMLElement).className).toContain(
      "rounded-[24px]",
    );
  });
});
```

- [ ] **Step 19: Rodar e ver falhar**

Run: `bunx vitest run src/components/app-shell/SidebarSkeleton.test.tsx`
Expected: FAIL com `expected [ ..., 'border-r', ... ] not to include 'border-r'` e `expected 2 to be 3` (ou similar).

- [ ] **Step 20: Implementar o `SidebarSkeleton`**

Substitua o arquivo inteiro `src/components/app-shell/SidebarSkeleton.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

// Ocupa o lugar da barra lateral enquanto a sessão carrega (só no desktop;
// no celular a barra é uma gaveta e não ocupa espaço). Mesma forma da barra
// real: wordmark, o grupo de navegação (5 itens de 48px + gaps + padding =
// 264px) e o card do usuário (68px) colado embaixo.
export function SidebarSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="hidden w-(--sidebar-width) shrink-0 flex-col gap-5 bg-sidebar px-4 pt-[22px] pb-4 md:flex"
    >
      <Skeleton className="mx-2 h-7 w-28 rounded-full" />
      <Skeleton className="h-[264px] w-full rounded-[28px]" />
      <Skeleton className="mt-auto h-[68px] w-full rounded-[24px]" />
    </div>
  );
}
```

- [ ] **Step 21: Rodar e ver passar**

Run: `bunx vitest run src/components/app-shell/SidebarSkeleton.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 22: Escrever o teste do layout que falha**

Substitua o arquivo inteiro `src/app/(app)/layout.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AppLayout from "./layout";

vi.mock("@/components/app-shell/AuthedSidebar", () => ({
  AuthedSidebar: () => null,
}));
vi.mock("@/components/app-shell/SessionKeepAlive", () => ({
  SessionKeepAlive: () => <div data-testid="keep-alive" />,
}));
vi.mock("@/components/app-shell/ThemeSwitch", () => ({
  ThemeSwitch: () => <div data-testid="theme-switch" />,
}));

function renderLayout(detalhe: React.ReactNode = <p>conteúdo do slot</p>) {
  return render(
    AppLayout({
      params: Promise.resolve({}),
      children: <p>conteúdo da página</p>,
      detalhe,
    }),
  );
}

describe("AppLayout", () => {
  it("renderiza a página (children) e o slot detalhe", () => {
    renderLayout();

    expect(screen.getByText("conteúdo da página")).toBeInTheDocument();
    expect(screen.getByText("conteúdo do slot")).toBeInTheDocument();
  });

  it("o slot vem depois da página (o Sheet fica por cima)", () => {
    renderLayout();

    const page = screen.getByText("conteúdo da página");
    const slot = screen.getByText("conteúdo do slot");
    expect(
      page.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("slot vazio (null) não quebra o layout", () => {
    renderLayout(null);

    expect(screen.getByText("conteúdo da página")).toBeInTheDocument();
  });

  it("monta o SessionKeepAlive", () => {
    renderLayout();

    expect(screen.getByTestId("keep-alive")).toBeInTheDocument();
  });

  it("o cabeçalho (menu e tema) fica no topo, antes da página", () => {
    renderLayout();

    const toggle = screen.getByRole("button", { name: "Alternar menu" });
    const theme = screen.getByTestId("theme-switch");
    const page = screen.getByText("conteúdo da página");
    expect(
      toggle.compareDocumentPosition(page) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      theme.compareDocumentPosition(page) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("o @container/main é um invólucro SEM padding na largura toda do SidebarInset (a área útil do protótipo: tela menos sidebar)", () => {
    const { container } = renderLayout();

    const main = container.querySelector<HTMLElement>(
      '[class*="@container/main"]',
    );
    expect(main).not.toBeNull();
    const classes = (main?.className ?? "").split(" ");
    for (const name of ["@container/main", "flex", "w-full", "flex-1", "flex-col"]) {
      expect(classes).toContain(name);
    }
    // O protótipo mede `mainW` = largura do <main> inteiro, com os 40px de
    // padding dentro: o contêiner da query não pode ter padding nem max-width.
    expect(classes.some((name) => /^(?:max-md:)?p[xlrb]?-/.test(name))).toBe(
      false,
    );
    expect(classes.some((name) => name.startsWith("max-w-"))).toBe(false);
    expect(main?.parentElement).toHaveAttribute("data-slot", "sidebar-inset");
  });

  it("dentro dele, o conteúdo fica centrado em até 1240px, com 40px de padding (16px no celular) e 48px embaixo", () => {
    const { container } = renderLayout();

    const content = container.querySelector<HTMLElement>(
      '[class*="@container/main"] > div',
    );
    expect(content).not.toBeNull();
    const classes = (content?.className ?? "").split(" ");
    for (const name of [
      "mx-auto",
      "flex",
      "w-full",
      "max-w-[1240px]",
      "flex-1",
      "flex-col",
      "px-10",
      "pb-12",
      "max-md:px-4",
    ]) {
      expect(classes).toContain(name);
    }
  });

  it("cabeçalho e página ficam dentro do contêiner; o slot detalhe fica fora dele", () => {
    const { container } = renderLayout();

    const content = container.querySelector<HTMLElement>(
      '[class*="@container/main"]',
    );
    expect(content).toContainElement(
      screen.getByRole("button", { name: "Alternar menu" }),
    );
    expect(content).toContainElement(screen.getByText("conteúdo da página"));
    expect(content).not.toContainElement(screen.getByText("conteúdo do slot"));
  });

  it("não cria um segundo <main> (o SidebarInset já é o <main>)", () => {
    const { container } = renderLayout();

    expect(container.querySelectorAll("main")).toHaveLength(1);
  });
});
```

- [ ] **Step 23: Rodar e ver falhar**

Run: `bunx vitest run "src/app/(app)/layout.test.tsx"`
Expected: FAIL (`expected null not to be null` no contêiner `@container/main`; o cabeçalho antigo ainda tem `border-b`).

- [ ] **Step 24: Implementar o layout**

Substitua o arquivo inteiro `src/app/(app)/layout.tsx`:

```tsx
import { Suspense } from "react";

import { AppHeader } from "@/components/app-shell/AppHeader";
import { AuthedSidebar } from "@/components/app-shell/AuthedSidebar";
import { SessionKeepAlive } from "@/components/app-shell/SessionKeepAlive";
import { SidebarSkeleton } from "@/components/app-shell/SidebarSkeleton";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

// Sem await aqui: a sessão é lida dentro do <Suspense> (Cache Components).
// O layout não protege as páginas: cada página chama requireUser/requireAdmin
// (guardado por src/app/appPagesAuth.test.ts). O slot `detalhe` abre o detalhe
// da solicitação num Sheet por cima da tela atual (rota interceptada); fica
// fora de qualquer <Suspense> daqui e fora do contêiner do conteúdo: o
// Suspense vive na página interceptada.
// O contêiner `@container/main` é o que as telas usam nas container queries
// (`@min-[1040px]/main:` etc.): os cortes são da área útil, a tela menos a
// sidebar (o `mainW` do protótipo), por isso ele fica num invólucro SEM padding
// na largura toda do SidebarInset; o div de dentro é que centra em 1240px e
// leva o padding de 40px (16px no celular).
export default function AppLayout({ children, detalhe }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <SessionKeepAlive />
      <Suspense fallback={<SidebarSkeleton />}>
        <AuthedSidebar />
      </Suspense>
      <SidebarInset className="min-w-0">
        <div className="@container/main flex w-full flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col px-10 pb-12 max-md:px-4">
            <AppHeader />
            {children}
          </div>
        </div>
        {detalhe}
      </SidebarInset>
    </SidebarProvider>
  );
}
```

- [ ] **Step 25: Rodar e ver passar**

Run: `bunx vitest run "src/app/(app)/layout.test.tsx"`
Expected: PASS (9 testes).

- [ ] **Step 26: Guarda de toque do E2E (uma asserção a mais, sem rodar o E2E)**

Edição em `e2e/touch-targets.spec.ts`: a gaveta aberta tem que mostrar o "Fechar menu" (o X do protótipo), medido junto com o resto pelo `smallTargets`.

old_string:
```ts
  await page.getByRole("button", { name: "Alternar menu" }).click();
  expect.soft(await smallTargets(page), "menu lateral").toEqual([]);
```
new_string:
```ts
  await page.getByRole("button", { name: "Alternar menu" }).click();
  await expect(
    page.getByRole("button", { name: "Fechar menu", exact: true }),
  ).toBeVisible();
  expect.soft(await smallTargets(page), "menu lateral").toEqual([]);
```

Nada mais muda nos E2E existentes: os itens do menu continuam `link` com os mesmos nomes (`Administração`, `Conta`, `Passagens` em `auth.spec.ts`, `cadastros.spec.ts`, `dashboard.spec.ts`); o botão do cabeçalho continua com o nome `Alternar menu`; o `getByRole("navigation", { name: "Setor", exact: true })` de `cadastros.spec.ts` não conflita com as novas `nav` "Principal" e "Administração". O E2E em si NÃO é rodado nesta tarefa (o controlador roda no fim); o guarda de 44px mede o novo shell no celular: botão do menu 44px, X 44px, itens 48px, `ThemeSwitch` (`role=switch`) 76x44.

- [ ] **Step 27: Atualizar `.context/ui-registry.md`**

Sete edições no `ui-registry.md` e uma no `library-docs.md` (a 8), todas com a ferramenta Edit (strings exatas do arquivo atual, já com as Tasks 3 e 8 aplicadas).

1. Sidebar, "Como funciona":

old_string: `Breakpoint do celular: 768px (igual ao \`md\`).`
new_string: `Breakpoint do celular: 860px (igual ao \`md\`, Task 1 do visual novo); largura 17,5rem (280px), sem borda no desktop; a gaveta do celular tem a sombra \`data-[side=left]:shadow-drawer\` (token, \`20px 0 60px\`), o scrim \`bg-scrim\` (token, preto a 45%, sem blur) e desliza 350ms com \`cubic-bezier(.2,.8,.2,1)\` (\`motion-reduce\` desliga).`

2. Sidebar, "Histórico" (acrescenta uma linha depois da existente):

old_string: `\`h-9 max-md:h-11\` (P3); textos acessíveis em pt-BR ("Alternar menu", gaveta "Menu").`
new_string: `\`h-9 max-md:h-11\` (P3); textos acessíveis em pt-BR ("Alternar menu", gaveta "Menu").\n  2026-11-27 — visual novo (Task 9): \`SIDEBAR_WIDTH\` e \`SIDEBAR_WIDTH_MOBILE\` 17.5rem; some a borda lateral do desktop; o \`SheetContent\` da gaveta ganha largura pelo token (a \`w-3/4\` do Sheet perdia para a classe sem variante), \`border-r-0\`, sombra, curva e deslize de −105% sem fade; \`overlayClassName\` troca o scrim. O visual dos itens (pílula de 48px) vem por \`className\` no \`AppSidebar\`; o \`default\` de \`SidebarMenuButton\` não mudou.`

3. Sheet, "Histórico":

old_string: `- **Histórico:** 2026-11-20 — \`shadcn add\`; o \`sr-only\` do botão de fechar passa a "Fechar".`
new_string: `- **Histórico:** 2026-11-20 — \`shadcn add\`; o \`sr-only\` do botão de fechar passa a "Fechar". 2026-11-27 — visual novo (Task 9): \`SheetContent\` aceita \`overlayClassName\` (o padrão \`bg-black/10\` + blur continua para os outros Sheets); só a gaveta do menu usa.`

4. AppSidebar: "Como funciona" e "Histórico".

old_string: `recebe \`isAdmin\`, \`userName\`, \`userEmail\`.`
new_string: `recebe \`isAdmin\`, \`userName\`, \`userEmail\`, \`avatarSrc\` (data URI pronto do \`AuthedSidebar\`).`

old_string: `Rodapé com nome e e-mail truncados.`
new_string: `Wordmark "Closery" (Satoshi 900, 28px) no topo; no celular o botão X ("Fechar menu", \`Button surface icon-pill\` com tooltip) fica ao lado dele. Dois grupos em \`nav\` (raio 28, \`bg-card\`): "Principal" (\`mainNavItems\`) e, só para admin, "Administração" (\`adminNavItems\`); itens de 48px em pílula, Satoshi 16/700, ativo em \`bg-primary\`, hover \`bg-accent\` em 150ms. Card do usuário (raio 24) com \`UserAvatar\` de 44px a −4°, nome e e-mail truncados e o chip ADMIN/COLEGA (Geist Mono 11px).`

old_string: `o menu ganha o item Dashboard (\`/dashboard\`, ícone \`ChartColumn\`) entre Solicitações e Conta.`
new_string: `o menu ganha o item Dashboard (\`/dashboard\`, ícone \`ChartColumn\`) entre Solicitações e Conta. 2026-11-27 — visual novo (Task 9): sidebar de 280px sem borda, dois grupos, card do usuário com avatar e chip de papel, X no drawer; \`navItems.ts\` separa \`mainNavItems\` e \`adminNavItems\` (\`NAV_ITEMS\` e \`visibleNavItems\` continuam).`

5. AuthedSidebar:

old_string: `- **Como funciona:** Server Component assíncrono; \`requireUser()\` e devolve \`<AppSidebar />\`.`
new_string: `- **Como funciona:** Server Component assíncrono; \`requireUser()\` e devolve \`<AppSidebar />\` com \`avatarSrc = avatarDataUri(userId)\` (semente = id).`

Histórico do `AuthedSidebar` (fim da linha):

old_string: `o Next não deixa o layout controlar a página; o portão é \`requireUser\`/\`requireAdmin\` em cada página, guardado por \`appPagesAuth.test.ts\`.`
new_string: `o Next não deixa o layout controlar a página; o portão é \`requireUser\`/\`requireAdmin\` em cada página, guardado por \`appPagesAuth.test.ts\`. 2026-11-27 — visual novo (Task 9): passa \`avatarSrc\` ao \`AppSidebar\`.`

6. SidebarSkeleton:

old_string: `- **Como funciona:** só no desktop (\`hidden md:flex\`), \`aria-hidden\`, largura \`--sidebar-width\`.
- **Usa:** \`Skeleton\`; token \`sidebar\`.
- **Histórico:** 2026-11-20 — criado na Fase 1.`
new_string: `- **Como funciona:** só no desktop (\`hidden md:flex\`), \`aria-hidden\`, largura \`--sidebar-width\`, sem borda. Três blocos: wordmark, grupo de navegação (264px, raio 28) e card do usuário (68px, raio 24) colado embaixo.
- **Usa:** \`Skeleton\`; token \`sidebar\`.
- **Histórico:** 2026-11-20 — criado na Fase 1. 2026-11-27 — visual novo (Task 9): forma nova, sem \`border-r\`.`

7. MenuToggle (reescreve o corpo e abre a entrada nova do AppHeader logo depois). Depois da Task 3, a entrada que vem logo depois do `MenuToggle` é a `### ThemeProvider` (a Task 3 inseriu `ThemeProvider` e `ThemeSwitch` antes de `### Greeting`), por isso a âncora é ela:

old_string:
```
- **Como funciona:** `"use client"`; `SidebarTrigger` (só ícone) dentro de `TooltipTrigger render`,
  com `aria-label` e tooltip "Alternar menu". Testado com `fireEvent.pointerEnter/mouseEnter`.
- **Usa:** `SidebarTrigger`, `Tooltip*`.
- **Histórico:** 2026-11-20 — criado na Fase 1.

### ThemeProvider
```
new_string:
```
- **Como funciona:** `"use client"`; `Button variant="surface" size="icon-pill"` (44px, redondo) dentro de
  `TooltipTrigger render`, com `aria-label`, `sr-only` e tooltip "Alternar menu", chamando
  `useSidebar().toggleSidebar`. Os dois ícones (`PanelLeft` e `Menu`) estão sempre no HTML e o CSS
  escolhe: `PanelLeft` com `max-md:hidden`, `Menu` com `hidden max-md:block` (abaixo de 860px abre a
  gaveta). Testado com `fireEvent.pointerEnter/mouseEnter`.
- **Usa:** `Button`, `useSidebar`, `Tooltip*`.
- **Histórico:** 2026-11-20 — criado na Fase 1. 2026-11-27 — visual novo (Task 9): deixa de usar o
  `SidebarTrigger` (ghost, `icon-sm`) e vira o botão redondo de 44px com ícone por viewport.

### AppHeader
- **Status:** ✅ pronto (2026-11-27)
- **Local:** `src/components/app-shell/AppHeader.tsx`
- **Propósito:** cabeçalho do app autenticado: botão de menu à esquerda e switch de tema à direita.
- **Como funciona:** `"use client"` (não usa hooks; só compõe `MenuToggle` e `ThemeSwitch`). `<header>` de
  76px (`h-[76px]`), `justify-between`, **sem borda**. O wordmark "Closery" (Satoshi 900, 24px) usa
  `hidden max-md:inline`: só aparece abaixo de 860px, onde a sidebar fixa não está na tela. Vive dentro
  do div centrado (1240px, 40px/16px de padding) que fica dentro do `@container/main` do `(app)/layout.tsx`.
- **Usa:** `MenuToggle`, `ThemeSwitch`.
- **Histórico:** 2026-11-27 — criado no visual novo (Task 9); substitui o `<header>` com `border-b` do layout.

### ThemeProvider
```

8. `.context/library-docs.md`: a seção 20 (container queries), logo depois da 19 (DiceBear, Task 8), antes de `## Como adicionar uma biblioteca nova`:

old_string:
```
## Como adicionar uma biblioteca nova
```
new_string:
```
## 20. Container queries do Tailwind 4 · visual novo

- **Nativas no Tailwind 4**, sem plugin: `@container/<nome>` marca o contêiner; `@min-[<largura>]/<nome>:` e
  `@max-[<largura>]/<nome>:` aplicam a classe pela largura **dele**, não da janela. Dá para empilhar
  (`@min-[1040px]/main:@max-[1239px]/main:`) e misturar com mídia (`md:@max-[899px]/main:`).
- **O contêiner do app é `@container/main`**, no `src/app/(app)/layout.tsx`, num `div` **sem padding e sem max-width** que
  ocupa a largura toda do `SidebarInset`. A medida é a "área útil" da spec §4.4: a tela menos a sidebar (280px aberta, 0
  recolhida), igual ao `mainW` do protótipo, que conta os 40px de padding. O `div` de dentro é que centra em
  `max-w-[1240px]` e leva `px-10 pb-12 max-md:px-4`.
- **Cortes do Início (spec §4.4):** `@min-[1040px]/main:` (grids em 2 colunas), `@min-[1040px]/main:@max-[1239px]/main:`
  (horário 52px e contador 60px em 2 colunas), `md:@max-[899px]/main:` (saudação 60px). O celular continua no `max-md:`
  (abaixo de 860px), que vence: os tamanhos do celular nunca dependem do contêiner.
- **Armadilha:** `container-type: inline-size` faz o elemento não medir pelo conteúdo; o contêiner precisa de largura dada
  pelo pai (`w-full` dentro do `SidebarInset`, que é `flex-col`). Classe de container query fora de um descendente do
  `@container/main` (um portal, um `Sheet`) não casa com nada: o slot `detalhe` fica fora dele de propósito.
- **Teste:** o jsdom não calcula layout; os testes conferem a string da classe. A medida real é conferida na verificação
  visual (spec §10).

## Como adicionar uma biblioteca nova
```

Em seguida, rode o guarda do catálogo:

Run: `bunx vitest run test/uiRegistryDoc.test.ts`
Expected: PASS. O guarda varre `admin`, `passagens`, `solicitacoes`, `kokonutui`, `dashboard`, `privacy` e alguns primitivos; `app-shell` não é varrido, mas `AppHeader` entra no catálogo assim mesmo (regra do projeto).

- [ ] **Step 28: Verificação da tarefa (somente arquivos tocados)**

Run (formata só os arquivos desta tarefa; o `bun run format` do repo inteiro não é usado para não tocar em arquivo alheio):
```
bunx biome check --write src/components/app-shell src/components/ui/sidebar.tsx src/components/ui/sheet.tsx src/components/ui/sidebar.test.tsx "src/app/(app)/layout.tsx" "src/app/(app)/layout.test.tsx" e2e/touch-targets.spec.ts
bun run check-types
bun run lint
bunx vitest run src/components/app-shell src/components/ui/sidebar.test.tsx src/components/ui/touchTargets.test.tsx "src/app/(app)/layout.test.tsx" test/uiRegistryDoc.test.ts src/app/appPagesAuth.test.ts src/app/rawColors.test.ts
grep -rl "AppSidebar\|AuthedSidebar\|MenuToggle\|SidebarSkeleton\|navItems\|NAV_ITEMS\|visibleNavItems\|SheetContent" src test e2e
```
Expected: `check-types` e `lint` sem erro; todos os testes listados PASS; o `grep` lista os arquivos tocados (nenhum outro teste existente cita esses componentes além dos já ajustados: `layout.test.tsx`, `AppSidebar.test.tsx`, `AuthedSidebar.test.tsx`, `MenuToggle.test.tsx`, `SidebarSkeleton.test.tsx`, `navItems.test.ts`; `SheetContent` também aparece nos consumidores do Sheet, que não mudam de comportamento porque `overlayClassName` é opcional). Se o `check-types` reclamar de `UserAvatar`/`avatarDataUri`/`ThemeSwitch`/`size="icon-pill"` inexistentes, é porque as Tasks 3, 4 ou 8 ainda não foram aplicadas na branch.

Testes existentes que mudaram nesta tarefa (e a mudança): `AppSidebar.test.tsx` (prop `avatarSrc`, mock de `useIsMobile`, rodapé virou card do usuário), `AuthedSidebar.test.tsx` (`avatarSrc` e mock de `@/lib/avatar`), `SidebarSkeleton.test.tsx` e `MenuToggle.test.tsx` (casos novos, os antigos intactos), `navItems.test.ts` (casos novos), `sidebar.test.tsx` (casos novos), `layout.test.tsx` (mock do `ThemeSwitch`, contêiner e cabeçalho), `e2e/touch-targets.spec.ts` (uma asserção).

- [ ] **Step 29: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/visual/msg-task-9.txt`:

```
feat(app-shell): sidebar de 280px, cabeçalho de 76px e drawer do celular

A sidebar ganha wordmark, grupo principal e grupo de administração em
pílulas, card do usuário com avatar e chip de papel, sem borda. O cabeçalho
perde a borda e ganha o botão redondo de menu (PanelLeft no desktop, Menu
e wordmark no celular) e o ThemeSwitch. Abaixo de 860px a sidebar vira
drawer com X, sombra e scrim. O conteúdo fica num contêiner
@container/main de até 1240px.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Run:
```
git add src/components/app-shell src/components/ui/sidebar.tsx src/components/ui/sheet.tsx src/components/ui/sidebar.test.tsx "src/app/(app)/layout.tsx" "src/app/(app)/layout.test.tsx" e2e/touch-targets.spec.ts .context/ui-registry.md .context/library-docs.md && git commit -F .git/sdd/visual/msg-task-9.txt
```
Expected: um commit novo na branch `feat/visual-inicio`; `git status` limpo para esses arquivos. (Se `UserAvatar.tsx` ou `ThemeSwitch.tsx` das Tasks 3 e 8 estiverem ainda sem commit, não os inclua aqui: o `git add src/components/app-shell` os pegaria; confira com `git status` antes e use caminhos explícitos se for o caso.)

---

### Task 10: Dados do Início (progresso do turno, data do eyebrow, ids para avatar, cor do setor, primeiro acesso)

**Files:**
- Create: `src/features/handovers/shiftProgress.ts`
- Create: `src/features/handovers/shiftProgress.test.ts`
- Create: `src/features/admin/firstAccess.ts`
- Create: `src/features/admin/firstAccess.test.ts`
- Create: `src/app/(app)/dismissInviteCard.test.ts`
- Modify: `src/features/handovers/saoPaulo.ts` (nova `formatEyebrowDateBR`)
- Modify: `src/features/handovers/saoPaulo.test.ts` (testes dela)
- Modify: `src/features/handovers/types.ts` (`SavedMark.byId`)
- Modify: `src/features/handovers/loaders.ts` (`SectorRow.color`, `loadSector` seleciona `color`)
- Modify: `src/features/handovers/home.ts` (`PendingHandover.deliveredById`, `progress` em `start`/`continue`, `saved.byId`, `sector.color`)
- Modify: `src/features/handovers/draft.ts` (`SavedField.savedById`, que alimenta o `SavedMark` do autosave)
- Modify: `src/features/handovers/formState.ts` (`saved.byId`)
- Modify: `src/components/passagens/useHandoverAutosave.ts` (`lastSaved.byId`)
- Modify: `src/app/(app)/actions.ts` (nova `dismissInviteCardAction`)
- Modify: `src/app/actionsGuards.test.ts` (guarda do arquivo real exige `requireAdmin` em tudo)
- Test (existentes que mudam por causa dos tipos novos): `src/features/handovers/home.test.ts`, `src/features/handovers/loaders.test.ts`, `src/features/handovers/draft.test.ts`, `src/components/passagens/useHandoverAutosave.test.tsx`, `src/components/passagens/AutosaveIndicator.test.tsx`, `src/components/passagens/HandoverForm.test.tsx`, `src/components/passagens/MyShiftCard.test.tsx` (só fixtures), `src/components/passagens/PendingHandoverCard.test.tsx` (só a fixture)

**Interfaces:**
- Consumes (Task 5): `SectorColor` de `@/features/sectors/colors`; coluna `sector.color` (`SECTOR_COLORS`); `insertSector(db, name, { color? })` com padrão `"lilac"`; `SectorChoice` já com `color`.
- Produces:
  - `export type ShiftProgress = { startLabel: string; endLabel: string; nowLabel: string; pct: number }` e `export function shiftProgress(shift: { startsAt: string; endsAt: string }, now: Date): ShiftProgress` (`@/features/handovers/shiftProgress`). `pct` em 0..100 com no máximo 2 casas.
  - `export function formatEyebrowDateBR(date: Date): string` (`@/features/handovers/saoPaulo`), ex.: `"SEXTA-FEIRA · 27 NOV 2026"`.
  - `SavedMark = { at: Date; byName: string; byId: string }`; `SavedField` ganha `savedById: string`.
  - `PendingHandover.deliveredById: string`.
  - `MyShiftState` `start`/`continue` ganham `progress: ShiftProgress`.
  - `HomeHandovers.sector: { id: string; name: string; color: SectorColor }`; `SectorRow` de `loaders.ts` ganha `color: SectorColor`.
  - `@/features/admin/firstAccess`: `INVITE_CARD_DISMISSED_COOKIE`, `INVITE_CARD_DISMISSED_MAX_AGE_SECONDS`, `shouldShowInviteCard(input)`, `readInviteCardDismissed(): Promise<boolean>` (lê `cookies()`, só dentro de `<Suspense>`), `rememberInviteCardDismissed(): Promise<void>` (só em Server Action).
  - `dismissInviteCardAction(): Promise<void>` em `@/app/(app)/actions` (só admin; a Task 14 a passa direto ao `<form action={dismissInviteCardAction}>` do "Agora não", e o tipo do `action` do React é `(formData: FormData) => void | Promise<void>`: um `Promise<AdminResult>` não compila ali). Não há falha a devolver: sem permissão o `requireAdmin` já interrompe (redirect/notFound).

**Decisões desta tarefa (leia antes):**
- `pct` quando "agora" está fora do turno: o horário fora do turno cai entre o fim e o próximo início. Se está mais perto do fim (tempo desde o fim ≤ tempo até o próximo início), `pct = 100`; senão `pct = 0`. Vale igual para turno do dia e para o que cruza a meia-noite. Empate vai para 100 (turno recém-encerrado).
- Horário com segundos só vale com `:00` (é o que o banco entrega; `parseTimeOfDay` do projeto já aceita `HH:mm` e `HH:mm:00`).
- O dia da data do eyebrow usa 2 dígitos (`05 MAR`), como o resto do app (`dd/mm/aaaa`).
- `loadSector` passa a devolver `color`, para o `getHomeHandovers` não fazer uma segunda consulta.

- [ ] **Step 1: Escrever o teste de `shiftProgress` (falha)**

Criar `src/features/handovers/shiftProgress.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { spDate } from "../../../test/clock";
import { shiftProgress } from "./shiftProgress";

const DAY = { startsAt: "06:00", endsAt: "14:00" };
const NIGHT = { startsAt: "22:00", endsAt: "06:00" };
const DATE = "2026-11-21";

function at(hhmm: string) {
  return spDate(DATE, hhmm);
}

describe("shiftProgress: turno do dia (06:00–14:00)", () => {
  it("no meio: rótulos e porcentagem", () => {
    expect(shiftProgress(DAY, at("08:42"))).toEqual({
      startLabel: "06:00",
      endLabel: "14:00",
      nowLabel: "08:42",
      pct: 33.75,
    });
  });

  it("exatamente no início: 0; exatamente no fim: 100", () => {
    expect(shiftProgress(DAY, at("06:00")).pct).toBe(0);
    expect(shiftProgress(DAY, at("14:00")).pct).toBe(100);
  });

  it("um minuto depois do início e um minuto antes do fim", () => {
    expect(shiftProgress(DAY, at("06:01")).pct).toBeCloseTo(0.21, 2);
    expect(shiftProgress(DAY, at("13:59")).pct).toBeCloseTo(99.79, 2);
  });

  it("antes do início: 0 (mais perto do início do que do fim)", () => {
    expect(shiftProgress(DAY, at("05:30")).pct).toBe(0);
    expect(shiftProgress(DAY, at("00:00")).pct).toBe(0);
    expect(shiftProgress(DAY, at("23:59")).pct).toBe(0);
  });

  it("depois do fim: 100 (mais perto do fim do que do próximo início)", () => {
    expect(shiftProgress(DAY, at("14:01")).pct).toBe(100);
    expect(shiftProgress(DAY, at("15:30")).pct).toBe(100);
  });

  it("empate entre o fim e o próximo início vai para 100", () => {
    // 22:00 está a 8 h do fim (14:00) e a 8 h do próximo início (06:00).
    expect(shiftProgress(DAY, at("22:00")).pct).toBe(100);
  });
});

describe("shiftProgress: turno que cruza a meia-noite (22:00–06:00)", () => {
  it("antes da meia-noite, no turno que começou hoje", () => {
    expect(shiftProgress(NIGHT, at("23:30"))).toEqual({
      startLabel: "22:00",
      endLabel: "06:00",
      nowLabel: "23:30",
      pct: 18.75,
    });
  });

  it("depois da meia-noite, no mesmo turno", () => {
    expect(shiftProgress(NIGHT, at("00:30"))).toMatchObject({
      nowLabel: "00:30",
      pct: 31.25,
    });
    expect(shiftProgress(NIGHT, at("02:00")).pct).toBe(50);
  });

  it("meia-noite em ponto: 25%", () => {
    expect(shiftProgress(NIGHT, at("00:00")).pct).toBe(25);
  });

  it("exatamente no início (22:00): 0; exatamente no fim (06:00): 100", () => {
    expect(shiftProgress(NIGHT, at("22:00")).pct).toBe(0);
    expect(shiftProgress(NIGHT, at("06:00")).pct).toBe(100);
  });

  it("um minuto antes do início: 0; um minuto depois do fim: 100", () => {
    expect(shiftProgress(NIGHT, at("21:59")).pct).toBe(0);
    expect(shiftProgress(NIGHT, at("06:01")).pct).toBe(100);
  });

  it("no meio do dia: antes das 14:00 conta como depois do fim; depois, como antes do início", () => {
    expect(shiftProgress(NIGHT, at("10:00")).pct).toBe(100);
    expect(shiftProgress(NIGHT, at("18:00")).pct).toBe(0);
  });
});

describe("shiftProgress: fuso e formato", () => {
  it("usa a hora de parede de São Paulo, não a UTC", () => {
    // 01:30Z = 22:30 em São Paulo (dia 20): 30 min dentro do turno 22:00–06:00.
    const now = new Date("2026-11-21T01:30:00Z");

    expect(shiftProgress(NIGHT, now)).toMatchObject({
      nowLabel: "22:30",
      pct: 6.25,
    });
  });

  it("virada UTC: 02:59Z ainda é 23:59 de São Paulo", () => {
    expect(
      shiftProgress(DAY, new Date("2026-11-21T02:59:00Z")).nowLabel,
    ).toBe("23:59");
  });

  it("aceita HH:mm:00 (como vem do banco) e devolve rótulos HH:mm", () => {
    expect(
      shiftProgress({ startsAt: "06:00:00", endsAt: "14:00:00" }, at("10:00")),
    ).toEqual({
      startLabel: "06:00",
      endLabel: "14:00",
      nowLabel: "10:00",
      pct: 50,
    });
  });

  it("horário inválido lança RangeError", () => {
    expect(() =>
      shiftProgress({ startsAt: "25:00", endsAt: "14:00" }, at("10:00")),
    ).toThrow(RangeError);
    expect(() =>
      shiftProgress({ startsAt: "06:00", endsAt: "xx" }, at("10:00")),
    ).toThrow(RangeError);
  });

  it("início igual ao fim vale 24 h e nunca divide por zero", () => {
    const full = { startsAt: "06:00", endsAt: "06:00" };

    expect(shiftProgress(full, at("06:00")).pct).toBe(0);
    expect(shiftProgress(full, at("18:00")).pct).toBe(50);
  });
});

describe("shiftProgress: o pct nunca sai de 0..100 e nunca anda para trás dentro do turno", () => {
  function allMinutes(): string[] {
    return Array.from({ length: 1440 }, (_, minute) => {
      const hh = String(Math.floor(minute / 60)).padStart(2, "0");
      const mm = String(minute % 60).padStart(2, "0");
      return `${hh}:${mm}`;
    });
  }

  it.each([
    ["dia", DAY],
    ["noite", NIGHT],
  ])("turno de %s, todos os minutos do dia", (_name, shift) => {
    for (const hhmm of allMinutes()) {
      const { pct } = shiftProgress(shift, at(hhmm));
      expect(pct, hhmm).toBeGreaterThanOrEqual(0);
      expect(pct, hhmm).toBeLessThanOrEqual(100);
    }
  });

  it("dentro do turno do dia o pct só cresce", () => {
    let previous = -1;
    for (const hhmm of allMinutes().filter((m) => m >= "06:00" && m <= "14:00")) {
      const { pct } = shiftProgress(DAY, at(hhmm));
      expect(pct, hhmm).toBeGreaterThanOrEqual(previous);
      previous = pct;
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bunx vitest run src/features/handovers/shiftProgress.test.ts`
Expected: FAIL com "Failed to resolve import \"./shiftProgress\"" (o arquivo não existe).

- [ ] **Step 3: Implementar `shiftProgress`**

Criar `src/features/handovers/shiftProgress.ts`:

```ts
import {
  formatTimeOfDay,
  MINUTES_PER_DAY,
  parseTimeOfDay,
} from "@/features/admin/timeOfDay";

import { formatTimeBR, saoPauloParts } from "./saoPaulo";

// Barra do turno do Início (estados `start` e `continue`). Pura: o servidor
// calcula a cada carga da página com o `now` do render; nada anima no cliente.
export type ShiftProgress = {
  startLabel: string; // "06:00"
  endLabel: string; // "14:00"
  nowLabel: string; // "08:42", hora de São Paulo
  pct: number; // 0..100, no máximo 2 casas
};

function minutesOf(value: string): number {
  const minutes = parseTimeOfDay(value);
  if (minutes === null) {
    throw new RangeError(`Horário inválido: "${value}"`);
  }
  return minutes;
}

/**
 * Quanto do turno já passou, em hora de parede de São Paulo. Trata o turno que
 * cruza a meia-noite. Fora do turno, o "agora" fica entre o fim e o próximo
 * início: mais perto do fim (empate incluso) = 100, mais perto do início = 0.
 */
export function shiftProgress(
  shift: { startsAt: string; endsAt: string },
  now: Date,
): ShiftProgress {
  const start = minutesOf(shift.startsAt);
  const end = minutesOf(shift.endsAt);
  const duration =
    end === start
      ? MINUTES_PER_DAY
      : (end - start + MINUTES_PER_DAY) % MINUTES_PER_DAY;

  const current = saoPauloParts(now).minutes;
  const elapsed = (current - start + MINUTES_PER_DAY) % MINUTES_PER_DAY;

  let pct: number;
  if (elapsed <= duration) {
    pct = (elapsed / duration) * 100;
  } else {
    const sinceEnd = elapsed - duration;
    const untilNextStart = MINUTES_PER_DAY - elapsed;
    pct = sinceEnd <= untilNextStart ? 100 : 0;
  }

  return {
    startLabel: formatTimeOfDay(start),
    endLabel: formatTimeOfDay(end),
    nowLabel: formatTimeBR(now),
    pct: Math.round(pct * 100) / 100,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bunx vitest run src/features/handovers/shiftProgress.test.ts`
Expected: PASS (todos os testes do arquivo, 0 falhas).

- [ ] **Step 5: Escrever os testes de `formatEyebrowDateBR` (falha)**

Em `src/features/handovers/saoPaulo.test.ts`, trocar o bloco de import (o `import { addDays, ... } from "./saoPaulo";`) por:

```ts
import {
  addDays,
  daysBetween,
  formatDateAtTimeBR,
  formatDateBR,
  formatEyebrowDateBR,
  formatTimeBR,
  isIsoDate,
  isOperationalDateAllowed,
  saoPauloParts,
} from "./saoPaulo";
```

E acrescentar no fim do arquivo:

```ts
describe("formatEyebrowDateBR", () => {
  it("dia da semana por extenso, dia, mês abreviado sem ponto e ano, em caixa alta", () => {
    expect(formatEyebrowDateBR(spDate("2026-11-27", "10:00"))).toBe(
      "SEXTA-FEIRA · 27 NOV 2026",
    );
  });

  it("dia de um dígito ganha zero à esquerda; dia da semana com cedilha e acento", () => {
    expect(formatEyebrowDateBR(spDate("2026-03-05", "12:00"))).toBe(
      "QUINTA-FEIRA · 05 MAR 2026",
    );
    expect(formatEyebrowDateBR(spDate("2026-02-03", "12:00"))).toBe(
      "TERÇA-FEIRA · 03 FEV 2026",
    );
    expect(formatEyebrowDateBR(spDate("2026-11-28", "12:00"))).toBe(
      "SÁBADO · 28 NOV 2026",
    );
  });

  it("virada da meia-noite: 02:59Z ainda é 23:59 do dia 27 em São Paulo; 03:00Z já é dia 28", () => {
    expect(formatEyebrowDateBR(new Date("2026-11-28T02:59:00Z"))).toBe(
      "SEXTA-FEIRA · 27 NOV 2026",
    );
    expect(formatEyebrowDateBR(new Date("2026-11-28T03:00:00Z"))).toBe(
      "SÁBADO · 28 NOV 2026",
    );
  });

  it("virada do ano: 02:00Z de 1º de janeiro ainda é 31 de dezembro em São Paulo", () => {
    expect(formatEyebrowDateBR(new Date("2027-01-01T02:00:00Z"))).toBe(
      "QUINTA-FEIRA · 31 DEZ 2026",
    );
  });

  it("os 12 meses saem com 3 letras maiúsculas e sem ponto", () => {
    for (let month = 1; month <= 12; month += 1) {
      const iso = `2026-${String(month).padStart(2, "0")}-10`;
      const text = formatEyebrowDateBR(spDate(iso, "12:00"));

      expect(text, iso).toMatch(/^[A-ZÇÁÉ-]+ · 10 [A-Z]{3} 2026$/);
      expect(text, iso).not.toContain(".");
    }
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `bunx vitest run src/features/handovers/saoPaulo.test.ts`
Expected: FAIL com "formatEyebrowDateBR is not a function" (ou erro de tipo/import equivalente).

- [ ] **Step 7: Implementar `formatEyebrowDateBR`**

Em `src/features/handovers/saoPaulo.ts`, logo depois da constante `TIME_FORMAT` (antes de `const ISO_DATE`), acrescentar:

```ts
const EYEBROW_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: SAO_PAULO_TIME_ZONE,
  weekday: "long",
  day: "2-digit",
  month: "short",
  year: "numeric",
});
```

E, no fim do arquivo (depois de `formatDateAtTimeBR`):

```ts
/**
 * Data do eyebrow do Início: "SEXTA-FEIRA · 27 NOV 2026". Dia da semana por
 * extenso, mês abreviado sem o ponto que o Intl põe ("nov." → "NOV"), caixa
 * alta, tudo na hora de parede de São Paulo (02:59Z ainda é o dia anterior).
 */
export function formatEyebrowDateBR(date: Date): string {
  const parts = new Map<string, string>();
  for (const part of EYEBROW_FORMAT.formatToParts(date)) {
    parts.set(part.type, part.value);
  }
  const month = (parts.get("month") ?? "").replace(/\.$/, "");
  return `${parts.get("weekday")} · ${parts.get("day")} ${month} ${parts.get("year")}`.toLocaleUpperCase(
    "pt-BR",
  );
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `bunx vitest run src/features/handovers/saoPaulo.test.ts`
Expected: PASS (testes antigos e os 5 novos).

- [ ] **Step 9: Atualizar os testes existentes para os tipos novos (falham antes do código)**

(a) `src/features/handovers/home.test.ts`:
- No teste `pending` completo (o `expect(pending).toEqual({ id: recent.id, ... })`), acrescentar `deliveredById: ana,` depois de `deliveredByName: "Ana Teste",`.
- No teste `start: turno sugerido pelo horário, sem passagem`, o `expect(mine).toEqual({...})` ganha `progress` entre `shift` e `saved`:

```ts
        progress: {
          startLabel: "06:00",
          endLabel: "14:00",
          nowLabel: "14:05",
          pct: 100,
        },
        saved: null,
```
  (o `NOW` do arquivo é 14:05, 5 min depois do fim da Manhã.)
- No teste `continue: rascunho existe e traz quem salvou por último`, depois de `expect(mine.saved?.byName).toBe("Bia Teste");` acrescentar:

```ts
      expect(mine.saved?.byId).toBe(bia);
      expect(mine.progress).toEqual({
        startLabel: "06:00",
        endLabel: "14:00",
        nowLabel: "14:05",
        pct: 100,
      });
```
- No teste `admin vê qualquer setor ativo`, trocar `expect(home.sector).toEqual({ id: uld.id, name: "ULD" });` por:

```ts
      expect(home.sector).toEqual({ id: uld.id, name: "ULD", color: "lilac" });
```
- Novo teste dentro de `describe("escopo e setor")`, depois do teste do admin:

```ts
    it("a cor do setor vai junto (a escolhida, não a padrão)", async () => {
      const verde = await insertSector(db, "Carga", { color: "green" });
      const { rootAuthz } = await seed();

      const home = await homeOf(rootAuthz, verde.id);

      expect(home.sector).toEqual({
        id: verde.id,
        name: "Carga",
        color: "green",
      });
    });
```

(b) `src/features/handovers/loaders.test.ts`, no teste `admin lê qualquer setor, ativo ou não`:

```ts
      expect(await loadSector(db, admin, active.id)).toEqual({
        id: active.id,
        name: "ULD",
        active: true,
        color: "lilac",
      });
```

(c) `src/features/handovers/draft.test.ts`: no `expect(first).toEqual({...})` acrescentar `savedById: operatorAna.userId,` depois de `savedByName: "Ana Teste",`; no teste do admin trocar a linha do `toMatchObject` por:

```ts
      expect(result).toMatchObject({
        ok: true,
        savedByName: "Admin",
        savedById: admin.userId,
      });
```

(d) `src/components/passagens/useHandoverAutosave.test.tsx`:
- `function setup(initial: { at: Date; byName: string } | null = null)` → `function setup(initial: SavedMark | null = null)` e acrescentar `import type { SavedMark } from "@/features/handovers/types";` junto dos imports de tipos.
- `const saved = ...` ganha `savedById: "u-ana",` depois de `savedByName: "Ana Teste",`.
- No teste "começa parado...": `const initial = { at: spDate("2026-11-20", "09:00"), byName: "Bia Teste", byId: "u-bia" };`.
- No `expect(result.current.lastSaved).toEqual({...})` acrescentar `byId: "u-ana",` depois de `byName: "Ana Teste",`.

(e) `src/components/passagens/AutosaveIndicator.test.tsx`: `const LAST = { at: spDate("2026-11-20", "09:10"), byName: "Bia Teste", byId: "u-bia" };`

(f) `src/components/passagens/HandoverForm.test.tsx`: `savedOk` ganha `savedById: "u-ana",` depois de `savedByName: "Ana Teste",`; no teste "mostra o último salvamento...", `saved: { at: spDate("2026-11-20", "09:10"), byName: "Bia Teste", byId: "u-bia" },`.

(g) `src/components/passagens/MyShiftCard.test.tsx` (só fixtures; a Task 12 reescreve o arquivo): depois de `const REF = {...};` acrescentar

```ts
const PROGRESS = {
  startLabel: "06:00",
  endLabel: "14:00",
  nowLabel: "10:00",
  pct: 50,
};
```
  e trocar TODAS as ocorrências de `shift: SHIFT, saved: null }` por `shift: SHIFT, progress: PROGRESS, saved: null }` (são as linhas dos estados `start` e `continue`; use `replace_all`). No teste `continue: mostra quando e por quem o rascunho foi salvo`, o objeto vira:

```ts
    renderCard({
      kind: "continue",
      ref: REF,
      shift: SHIFT,
      progress: PROGRESS,
      saved: {
        at: spDate("2026-11-20", "13:41"),
        byName: "Ana Teste",
        byId: "u-ana",
      },
    });
```

(h) `src/components/passagens/PendingHandoverCard.test.tsx` (só a fixture; a Task 11 reescreve): em `pending()` acrescentar `deliveredById: "u-ana",` depois de `deliveredByName: "Ana Teste",`.

(i) `src/features/handovers/formState.test.ts`: não muda (os `saved` dele são `null`). Se algum teste ali montar `saved` com valor, acrescente `byId`.

- [ ] **Step 10: Rodar e ver falhar**

Run: `bunx vitest run src/features/handovers/home.test.ts src/features/handovers/loaders.test.ts src/features/handovers/draft.test.ts`
Expected: FAIL (por exemplo "expected { id, name, active: true } to deeply equal { ..., color: 'lilac' }" e `deliveredById`/`progress` ausentes). Os `.tsx` ainda não são rodados aqui.

- [ ] **Step 11: Implementar os campos nos tipos e nos produtores**

`src/features/handovers/types.ts`: trocar a última linha por

```ts
export type SavedMark = { at: Date; byName: string; byId: string };
```

`src/features/handovers/loaders.ts`: acrescentar o import e trocar o tipo e o `select`:

```ts
import type { SectorColor } from "@/features/sectors/colors";
```
(junto dos outros imports de `@/features`, em ordem alfabética), e

```ts
export type SectorRow = {
  id: string;
  name: string;
  active: boolean;
  color: SectorColor;
};
```
e dentro de `loadSector`:

```ts
  const query = db
    .select({
      id: sector.id,
      name: sector.name,
      active: sector.active,
      color: sector.color,
    })
    .from(sector)
    .where(eq(sector.id, sectorId));
```

`src/features/handovers/home.ts` (cada trecho abaixo substitui o trecho equivalente do arquivo atual):

1. Imports: acrescentar

```ts
import type { SectorColor } from "@/features/sectors/colors";
```
junto dos imports de `@/features/...`, e, junto dos imports relativos, `import { type ShiftProgress, shiftProgress } from "./shiftProgress";`.

2. Tipos:

```ts
export type PendingHandover = {
  id: string;
  sectorName: string;
  shiftName: string;
  operationalDate: string;
  deliveredById: string;
  deliveredByName: string;
  deliveredAt: Date;
  nextShiftPreview: string | null;
};

export type MyShiftState =
  | { kind: "no-shifts" }
  | {
      kind: "start" | "continue";
      ref: HandoverRef;
      shift: ShiftChoice;
      progress: ShiftProgress;
      saved: SavedMark | null;
    }
  | {
      kind: "delivered" | "confirmed";
      handoverId: string;
      ref: HandoverRef;
      shift: ShiftChoice;
      deliveredByName: string;
      deliveredAt: Date;
      confirmedByName: string | null;
      confirmedAt: Date | null;
    };

export type HomeHandovers = {
  sector: { id: string; name: string; color: SectorColor };
  pending: PendingHandover | null;
  mine: MyShiftState;
};
```

3. Em `loadPending`, a condição do `if` e o objeto devolvido:

```ts
  if (
    !row ||
    row.status !== "delivered" ||
    row.deliveredAt === null ||
    row.deliveredBy === null ||
    row.deliveredBy === actor.userId
  ) {
    return null;
  }
  return {
    id: row.id,
    sectorName: row.sectorName,
    shiftName: row.shiftNameSnapshot ?? row.shiftName,
    operationalDate: row.operationalDate,
    deliveredById: row.deliveredBy,
    deliveredByName: row.deliveredByName,
    deliveredAt: row.deliveredAt,
    nextShiftPreview: previewOf(row.nextShiftText),
  };
```

4. Em `loadMine`, o retorno do `start` e o do `continue`:

```ts
  const progress = shiftProgress(chosen, now);
  const row = await findHandoverByRef(db, ref);
  if (!row) {
    return { kind: "start", ref, shift: chosen, progress, saved: null };
  }
```
(a linha `const row = await findHandoverByRef(db, ref);` e o `if (!row) return {...}` atuais são trocados por estas), e dentro de `if (row.status === "draft")`:

```ts
  if (row.status === "draft") {
    const byName =
      row.updatedBy === null ? undefined : people.get(row.updatedBy);
    return {
      kind: "continue",
      ref,
      shift: chosen,
      progress,
      saved:
        byName === undefined || row.updatedBy === null
          ? null
          : { at: row.updatedAt, byName, byId: row.updatedBy },
    };
  }
```

5. Em `getHomeHandovers`, o `ok(...)` final:

```ts
  return ok({
    home: {
      sector: { id: found.id, name: found.name, color: found.color },
      pending,
      mine,
    },
  });
```

`src/features/handovers/draft.ts`: no tipo e no retorno:

```ts
export type SavedField = {
  handoverId: string;
  savedAt: Date;
  savedByName: string;
  savedById: string;
};
```
```ts
    return ok({
      handoverId: row.id,
      savedAt: now,
      savedByName: actor.name,
      savedById: actor.userId,
    });
```

`src/features/handovers/formState.ts`: trocar o campo `saved` do objeto devolvido por

```ts
    saved:
      row && row.updatedBy && savedByName !== undefined
        ? { at: row.updatedAt, byName: savedByName, byId: row.updatedBy }
        : null,
```

`src/components/passagens/useHandoverAutosave.ts`: no `core.lastSaved = {...}`:

```ts
              core.lastSaved = {
                at: result.savedAt,
                byName: result.savedByName,
                byId: result.savedById,
              };
```

- [ ] **Step 12: Rodar e ver passar**

Run: `bunx vitest run src/features/handovers/home.test.ts src/features/handovers/loaders.test.ts src/features/handovers/draft.test.ts src/features/handovers/formState.test.ts src/features/handovers/awaiting.test.ts src/components/passagens/useHandoverAutosave.test.tsx src/components/passagens/AutosaveIndicator.test.tsx src/components/passagens/HandoverForm.test.tsx src/components/passagens/MyShiftCard.test.tsx src/components/passagens/PendingHandoverCard.test.tsx "src/app/(app)/passagens/actions.test.ts"`
Expected: PASS. Se algum outro teste ou arquivo ainda construir um `SectorRow` do `loaders.ts` na mão (`bun run check-types` aponta), acrescente `color: "lilac"`.

- [ ] **Step 13: Escrever os testes de `firstAccess` (falha)**

Criar `src/features/admin/firstAccess.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.get, set: mocks.set }),
}));

import {
  INVITE_CARD_DISMISSED_COOKIE,
  INVITE_CARD_DISMISSED_MAX_AGE_SECONDS,
  readInviteCardDismissed,
  rememberInviteCardDismissed,
  shouldShowInviteCard,
} from "./firstAccess";

describe("shouldShowInviteCard", () => {
  const FIRST = { people: 1, pendingInvites: 0 };

  it("admin sozinho, sem convites e sem dispensa: mostra", () => {
    expect(
      shouldShowInviteCard({ isAdmin: true, counts: FIRST, dismissed: false }),
    ).toBe(true);
  });

  it("operador nunca vê, mesmo com a equipe vazia", () => {
    expect(
      shouldShowInviteCard({ isAdmin: false, counts: FIRST, dismissed: false }),
    ).toBe(false);
  });

  it("2 pessoas: a equipe já existe", () => {
    expect(
      shouldShowInviteCard({
        isAdmin: true,
        counts: { people: 2, pendingInvites: 0 },
        dismissed: false,
      }),
    ).toBe(false);
  });

  it("1 pessoa e 1 convite pendente: já convidou, não mostra", () => {
    expect(
      shouldShowInviteCard({
        isAdmin: true,
        counts: { people: 1, pendingInvites: 1 },
        dismissed: false,
      }),
    ).toBe(false);
  });

  it("dispensado pelo cookie: não mostra", () => {
    expect(
      shouldShowInviteCard({ isAdmin: true, counts: FIRST, dismissed: true }),
    ).toBe(false);
  });

  it("0 pessoas (não acontece, mas não pode mostrar) e muitas pessoas", () => {
    expect(
      shouldShowInviteCard({
        isAdmin: true,
        counts: { people: 0, pendingInvites: 0 },
        dismissed: false,
      }),
    ).toBe(false);
    expect(
      shouldShowInviteCard({
        isAdmin: true,
        counts: { people: 40, pendingInvites: 3 },
        dismissed: false,
      }),
    ).toBe(false);
  });
});

describe("cookie de dispensa", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.set.mockReset();
    vi.unstubAllEnvs();
  });

  it("o nome do cookie e a validade são os da spec", () => {
    expect(INVITE_CARD_DISMISSED_COOKIE).toBe("closery-convite-dispensado");
    expect(INVITE_CARD_DISMISSED_MAX_AGE_SECONDS).toBe(31_536_000);
  });

  it("valor 1: dispensado", async () => {
    mocks.get.mockReturnValue({
      name: INVITE_CARD_DISMISSED_COOKIE,
      value: "1",
    });

    expect(await readInviteCardDismissed()).toBe(true);
    expect(mocks.get).toHaveBeenCalledWith(INVITE_CARD_DISMISSED_COOKIE);
  });

  it("sem cookie ou com outro valor: não dispensado (o cartão aparece)", async () => {
    mocks.get.mockReturnValue(undefined);
    expect(await readInviteCardDismissed()).toBe(false);

    mocks.get.mockReturnValue({
      name: INVITE_CARD_DISMISSED_COOKIE,
      value: "0",
    });
    expect(await readInviteCardDismissed()).toBe(false);

    mocks.get.mockReturnValue({ name: INVITE_CARD_DISMISSED_COOKIE, value: "" });
    expect(await readInviteCardDismissed()).toBe(false);
  });

  it("grava com os atributos da spec (fora de produção, sem secure)", async () => {
    vi.stubEnv("NODE_ENV", "test");

    await rememberInviteCardDismissed();

    expect(mocks.set).toHaveBeenCalledWith(
      "closery-convite-dispensado",
      "1",
      {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 31_536_000,
      },
    );
  });

  it("em produção o cookie é secure", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await rememberInviteCardDismissed();

    expect(mocks.set).toHaveBeenCalledWith(
      "closery-convite-dispensado",
      "1",
      expect.objectContaining({ secure: true }),
    );
  });
});
```

- [ ] **Step 14: Rodar e ver falhar**

Run: `bunx vitest run src/features/admin/firstAccess.test.ts`
Expected: FAIL com "Failed to resolve import \"./firstAccess\"".

- [ ] **Step 15: Implementar `firstAccess.ts`**

Criar `src/features/admin/firstAccess.ts`:

```ts
import "server-only";

import { cookies } from "next/headers";

import type { AdminOverviewCounts } from "./overview";

// Primeiro acesso do admin (spec §5.3): o cartão "Convide sua equipe" aparece
// enquanto a equipe tem só ele, nenhum convite foi gerado e ele não dispensou.
export const INVITE_CARD_DISMISSED_COOKIE = "closery-convite-dispensado";
export const INVITE_CARD_DISMISSED_MAX_AGE_SECONDS = 31_536_000; // 1 ano

export function shouldShowInviteCard(input: {
  isAdmin: boolean;
  counts: Pick<AdminOverviewCounts, "people" | "pendingInvites">;
  dismissed: boolean;
}): boolean {
  return (
    input.isAdmin &&
    !input.dismissed &&
    input.counts.people === 1 &&
    input.counts.pendingInvites === 0
  );
}

/** Só o valor "1" dispensa; ausente ou outro valor, o cartão aparece. Chame dentro de <Suspense> (lê `cookies()`). */
export async function readInviteCardDismissed(): Promise<boolean> {
  return (await cookies()).get(INVITE_CARD_DISMISSED_COOKIE)?.value === "1";
}

/** Só dentro de Server Action ou Route Handler: `.set` não vale em render. */
export async function rememberInviteCardDismissed(): Promise<void> {
  (await cookies()).set(INVITE_CARD_DISMISSED_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: INVITE_CARD_DISMISSED_MAX_AGE_SECONDS,
  });
}
```

- [ ] **Step 16: Rodar e ver passar**

Run: `bunx vitest run src/features/admin/firstAccess.test.ts`
Expected: PASS (11 testes).

- [ ] **Step 17: Escrever os testes da `dismissInviteCardAction` e o guarda (falham)**

Criar `src/app/(app)/dismissInviteCard.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authzOf } from "../../../test/authz";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  cookieSet: vi.fn(),
  revalidatePath: vi.fn(),
  touched: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.cookieSet }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db", () => ({
  get db() {
    mocks.touched();
    return {};
  },
}));

import { dismissInviteCardAction } from "./actions";

const NOT_FOUND = Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;404"), {
  digest: "NEXT_HTTP_ERROR_FALLBACK;404",
});
const REDIRECT = Object.assign(new Error("NEXT_REDIRECT"), {
  digest: "NEXT_REDIRECT;replace;/entrar;307;",
});

describe("dismissInviteCardAction", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mocks.requireAdmin.mockReset();
    mocks.cookieSet.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.touched.mockReset();
    mocks.requireAdmin.mockResolvedValue(authzOf({ role: "admin" }));
  });

  it("admin: grava o cookie com os atributos exatos, atualiza o Início e não devolve nada (vai direto no <form action>)", async () => {
    vi.stubEnv("NODE_ENV", "test");

    const result = await dismissInviteCardAction();

    expect(result).toBeUndefined();
    expect(mocks.cookieSet).toHaveBeenCalledTimes(1);
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      "closery-convite-dispensado",
      "1",
      {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 31_536_000,
      },
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  });

  it("em produção o cookie é secure", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await dismissInviteCardAction();

    expect(mocks.cookieSet).toHaveBeenCalledWith(
      "closery-convite-dispensado",
      "1",
      expect.objectContaining({ secure: true }),
    );
  });

  it("operador: recebe notFound; nada é gravado nem atualizado", async () => {
    mocks.requireAdmin.mockRejectedValue(NOT_FOUND);

    await expect(dismissInviteCardAction()).rejects.toBe(NOT_FOUND);

    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("sem sessão: recebe o redirect de entrada; nada é gravado nem atualizado", async () => {
    mocks.requireAdmin.mockRejectedValue(REDIRECT);

    await expect(dismissInviteCardAction()).rejects.toBe(REDIRECT);

    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("não toca o banco (a dispensa é só do navegador)", async () => {
    await dismissInviteCardAction();

    expect(mocks.touched).not.toHaveBeenCalled();
  });
});
```

Em `src/app/actionsGuards.test.ts`, inserir este bloco logo antes de `describe("hasUseServerDirective", () => {`:

```ts
describe("src/app/(app)/actions.ts (o arquivo real)", () => {
  const source = readFileSync(join(SRC, "app", "(app)", "actions.ts"), "utf8");

  it("exporta chooseSectorAction e dismissInviteCardAction", () => {
    expect(source).toContain("export async function chooseSectorAction");
    expect(source).toContain("export async function dismissInviteCardAction");
  });

  it("toda função exportada começa com requireAdmin() (nenhuma é de operador)", () => {
    expect(actionsMissingGuard(source, ["requireAdmin"])).toEqual([]);
  });

  it("a dispensa do convite sem requireAdmin reprovaria", () => {
    const sneaky = source.replace(
      /(export async function dismissInviteCardAction\(\)[^{]*\{\s*)await requireAdmin\(\);/,
      "$1await requireUser();",
    );

    expect(sneaky).not.toBe(source);
    expect(actionsMissingGuard(sneaky, ["requireAdmin"])).toEqual([
      "dismissInviteCardAction",
    ]);
  });
});
```

- [ ] **Step 18: Rodar e ver falhar**

Run: `bunx vitest run "src/app/(app)/dismissInviteCard.test.ts" src/app/actionsGuards.test.ts`
Expected: FAIL com "dismissInviteCardAction is not a function" e "expected ... toContain 'export async function dismissInviteCardAction'".

- [ ] **Step 19: Implementar `dismissInviteCardAction`**

Em `src/app/(app)/actions.ts`: trocar a linha `import { redirect } from "next/navigation";` por

```ts
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
```

acrescentar, junto dos imports de `@/features/...` (ordem alfabética do Biome: logo antes de `@/features/admin/messages`):

```ts
import { rememberInviteCardDismissed } from "@/features/admin/firstAccess";
```

(o import de `@/features/admin/result` não muda: a ação nova não devolve `AdminResult`).

No fim do arquivo, acrescentar:

```ts

// "Agora não" do cartão "Convide sua equipe" (spec §5.3): só o admin, só o
// cookie (nada no banco). `revalidatePath` faz o Início renderizar de novo já
// sem o cartão. Devolve `void` porque vai direto no `<form action>` do cartão
// (Task 14); não há falha a informar (sem permissão, o `requireAdmin` já
// interrompe com redirect ou notFound).
export async function dismissInviteCardAction(): Promise<void> {
  await requireAdmin();
  await rememberInviteCardDismissed();
  revalidatePath("/");
}
```

- [ ] **Step 20: Rodar e ver passar**

Run: `bunx vitest run "src/app/(app)/dismissInviteCard.test.ts" "src/app/(app)/actions.test.ts" src/app/actionsGuards.test.ts`
Expected: PASS (inclusive os testes antigos da `chooseSectorAction` e o guarda varrendo o `actions.ts`).

- [ ] **Step 21: Tipos, lint e os testes que mencionam o que foi tocado**

Run: `bun run check-types && bun run lint`
Expected: sem erros. Se o `check-types` apontar um `SectorRow`/`SavedMark`/`MyShiftState`/`PendingHandover` montado na mão em outro arquivo, acrescente o campo novo ali (`color: "lilac"`, `byId`, `progress`, `deliveredById`).

Run: `grep -rl "SavedMark\|PendingHandover\|MyShiftState\|getHomeHandovers\|loadSector\|saveHandoverField\|SavedField" src test e2e`
Run: `bunx vitest run src/features/handovers src/features/admin/firstAccess.test.ts "src/app/(app)/actions.test.ts" "src/app/(app)/dismissInviteCard.test.ts" src/app/actionsGuards.test.ts src/components/passagens/useHandoverAutosave.test.tsx src/components/passagens/AutosaveIndicator.test.tsx src/components/passagens/HandoverForm.test.tsx src/components/passagens/MyShiftCard.test.tsx src/components/passagens/PendingHandoverCard.test.tsx src/components/passagens/HomeHandovers.test.tsx src/components/passagens/HandoverDetail.edit.test.tsx`
Expected: PASS. (O `HomeHandovers.test.tsx` ainda usa o seletor antigo do `SectorPicker` se a Task 7 não o tiver trocado; isso é da Task 7.)

- [ ] **Step 22: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/visual/msg-task-10.txt`:

```
feat(inicio): dados do Início (progresso do turno, data, avatar, cor, primeiro acesso)

shiftProgress (turno do dia e que cruza a meia-noite, fuso de São Paulo),
formatEyebrowDateBR, byId em SavedMark e deliveredById em PendingHandover para
a semente do avatar, progress nos estados start/continue, cor do setor no
HomeHandovers, shouldShowInviteCard com o cookie de dispensa e a
dismissInviteCardAction (só admin).

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Run: `git add src/features/handovers src/features/admin/firstAccess.ts src/features/admin/firstAccess.test.ts "src/app/(app)/actions.ts" "src/app/(app)/dismissInviteCard.test.ts" src/app/actionsGuards.test.ts src/components/passagens/useHandoverAutosave.ts src/components/passagens/useHandoverAutosave.test.tsx src/components/passagens/AutosaveIndicator.test.tsx src/components/passagens/HandoverForm.test.tsx src/components/passagens/MyShiftCard.test.tsx src/components/passagens/PendingHandoverCard.test.tsx && git commit -F .git/sdd/visual/msg-task-10.txt`
Expected: commit criado; `git status` limpo.

---

### Task 11: Hero do Início (Greeting, linha do setor e do dashboard, esqueletos, PendingHandoverCard)

**Files:**
- Create: `src/components/passagens/SectorPill.tsx`
- Create: `src/components/passagens/SectorPill.test.tsx`
- Modify: `src/components/app-shell/Greeting.tsx` (eyebrow + h1; o link do dashboard sai daqui)
- Modify: `src/components/app-shell/Greeting.test.tsx`
- Modify: `src/components/passagens/HomeHandovers.tsx` (linha do hero, ponto de extensão dos cartões)
- Modify: `src/components/passagens/HomeHandovers.test.tsx`
- Modify: `src/components/passagens/PendingHandoverCard.tsx` (visual novo)
- Modify: `src/components/passagens/PendingHandoverCard.test.tsx`
- Modify: `src/app/(app)/page.tsx` (esqueletos, sem `gap-6`)
- Modify: `src/app/(app)/page.test.tsx`
- Modify: `.context/ui-registry.md` (Greeting, PendingHandoverCard, HomeHandovers, nova entrada SectorPill)

**Interfaces:**
- Consumes:
  - Task 4: `Card` com `variant="feature"`; `buttonVariants({ variant: "surface" | "on-pastel", size: "pill" })`.
  - Task 5: `SECTOR_COLOR_BG: Record<SectorColor, string>` e `SectorColor` de `@/features/sectors/colors`.
  - Task 7: `SectorPicker` com as mesmas props de hoje (`sectors`, `selectedId`, `path`), agora seletor deslizante com `radiogroup`/`radio`; `SectorChoice` com `color`.
  - Task 8: `avatarDataUri(seed: string): string` de `@/lib/avatar` (server-only) e `UserAvatar({ src, size, tilt?, frame?, className? })` de `@/components/app-shell/UserAvatar`.
  - Task 9: o contêiner `@container/main` no `(app)/layout.tsx` (as classes `@min-[1040px]/main:` só valem dentro dele).
  - Task 10: `formatEyebrowDateBR`, `PendingHandover.deliveredById`, `HomeHandovers.sector.color`.
- Produces:
  - `export function SectorPill({ name, color }: { name: string; color: SectorColor })` em `@/components/passagens/SectorPill` (usada pela Task 14 só se precisar; hoje só o `HomeHandovers`).
  - Estrutura do Início (a Task 14 estende; não mude os nomes):
    - `Greeting` = eyebrow + `h1`, com `pt-7` (`max-md:pt-3`) em cima e nada embaixo.
    - `HomeHandovers` devolve um fragmento: `<div data-slot="home-hero-row">` (a linha do hero: seletor ou pílula + "Ver o dashboard", com `pt-8 pb-10`, `max-md:pt-6 max-md:pb-7`) e depois `<div data-slot="home-cards" className="flex flex-col gap-4">`. É em `home-cards` que a Task 14 coloca o `InviteTeamCard` (antes do pendente) e troca os dois cartões finais pelo grid de 2 colunas.
    - Os ramos de erro (setor inativo, sem setor ativo) também levam a linha do hero, sem seletor nem pílula, para o "Ver o dashboard" continuar acessível.
    - O contêiner da página é `flex flex-col` **sem gap**: o espaçamento do hero vem só do `pt-7` do `Greeting` + `gap-3.5` interno + `pt-8` da linha.
  - `PendingHandoverCard({ pending, avatarSrc }: { pending: PendingHandover; avatarSrc: string })`; `data-slot="pending-handover"` no cartão. Como os outros cartões do Início (`MyShiftCard`, `RequestsHomeCard`, `InviteTeamCard`), ele só desenha: recebe o data URI pronto e não importa `@/lib/avatar`; quem chama (`HomeHandovers` aqui, `HomeCards` na Task 14) gera `avatarDataUri(pending.deliveredById)`.
  - `HomeHandovers` passa a importar `avatarDataUri` de `@/lib/avatar` (as Tasks 12 e 13 reusam o import).
  - O `@container/main` da Task 9 é um invólucro sem padding na largura toda do `SidebarInset` (tela menos sidebar, o `mainW` do protótipo): os cortes `@min-[1040px]/main:` e `md:@max-[899px]/main:` são os da spec, sem descontar o padding de 40px.

**Espaçamento do hero (prototipo `Inicio.dc.html`, `<section style="padding:28px 0 40px; gap:32px">`):**

| Pedaço do protótipo | Valor desktop / celular | Onde fica no código |
|---|---|---|
| padding de cima da `section` | 28 / 12 | `pt-7 max-md:pt-3` no topo do `Greeting` |
| gap entre eyebrow e `h1` | 14 | `gap-3.5` dentro do `Greeting` |
| gap entre o bloco do título e a linha de baixo | 32 / 24 | `pt-8 max-md:pt-6` no topo da linha (`home-hero-row`) |
| padding de baixo da `section` | 40 / 28 | `pb-10 max-md:pb-7` no fim da linha |
| gap entre a `section` e os cartões | 0 (o padding já separa) | nenhum gap no contêiner da página |
| gap entre cartões | 16 | `gap-4` em `home-cards` |
| gap entre seletor/pílula e o botão (`flex-wrap`) | 16 | `gap-4` na linha |

- [ ] **Step 1: Escrever o teste do `SectorPill` (falha)**

Criar `src/components/passagens/SectorPill.test.tsx`:

```tsx
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
      <SectorPill name="Carga" color={color as (typeof SECTOR_COLORS)[number]} />,
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bunx vitest run src/components/passagens/SectorPill.test.tsx`
Expected: FAIL com "Failed to resolve import \"./SectorPill\"".

- [ ] **Step 3: Implementar `SectorPill`**

Criar `src/components/passagens/SectorPill.tsx`:

```tsx
import { SECTOR_COLOR_BG, type SectorColor } from "@/features/sectors/colors";

// Pílula do operador no Início: o setor dele, só para leitura (spec §6.2). O
// admin troca de setor pelo `SectorPicker`; quem tem um setor só vê qual é.
export function SectorPill({
  name,
  color,
}: {
  name: string;
  color: SectorColor;
}) {
  return (
    <div
      data-slot="sector-pill"
      className="flex h-12 max-w-full items-center gap-2.5 rounded-full bg-card px-5"
    >
      <span
        aria-hidden="true"
        className={`size-2.5 shrink-0 rounded-full ${SECTOR_COLOR_BG[color]}`}
      />
      <span className="shrink-0 font-mono text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase">
        Setor
      </span>
      <span className="min-w-0 truncate font-heading text-base font-bold">
        {name}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bunx vitest run src/components/passagens/SectorPill.test.tsx`
Expected: PASS (9 testes).

- [ ] **Step 5: Reescrever o teste do `Greeting` (falha)**

Substituir o conteúdo de `src/components/app-shell/Greeting.test.tsx` por:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Greeting } from "@/components/app-shell/Greeting";
import type { Authz } from "@/features/authz/authz";
import { spDate } from "../../../test/clock";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));

function authz(overrides: Partial<Authz> = {}): Authz {
  return {
    userId: "u1",
    name: "Maria Souza",
    email: "maria@example.com",
    role: "operator",
    sectorId: "s1",
    ...overrides,
  };
}

describe("Greeting", () => {
  beforeEach(() => {
    mocks.requireUser.mockReset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(spDate("2026-11-27", "09:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mostra a data por extenso (eyebrow) e 'Olá, {primeiro nome}'", async () => {
    mocks.requireUser.mockResolvedValue(authz({ name: "Maria Souza" }));

    render(await Greeting());

    expect(screen.getByText("SEXTA-FEIRA · 27 NOV 2026")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Olá, Maria" }),
    ).toBeInTheDocument();
  });

  it("a data é a de São Paulo: 02:59Z ainda é dia 27; 03:00Z já é dia 28", async () => {
    mocks.requireUser.mockResolvedValue(authz());
    vi.setSystemTime(new Date("2026-11-28T02:59:00Z"));
    const first = render(await Greeting());
    expect(screen.getByText("SEXTA-FEIRA · 27 NOV 2026")).toBeInTheDocument();
    first.unmount();

    vi.setSystemTime(new Date("2026-11-28T03:00:00Z"));
    render(await Greeting());
    expect(screen.getByText("SÁBADO · 28 NOV 2026")).toBeInTheDocument();
  });

  it("o eyebrow é mono 13px em cinza e o título é Satoshi 900 (72px; 60px com área útil < 900px; 44px no celular)", async () => {
    mocks.requireUser.mockResolvedValue(authz());

    render(await Greeting());

    expect(screen.getByText("SEXTA-FEIRA · 27 NOV 2026")).toHaveClass(
      "font-mono",
      "text-[13px]",
      "font-medium",
      "text-muted-foreground",
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass(
      "font-heading",
      "font-black",
      "text-[72px]",
      "leading-[0.95]",
      "tracking-[-0.04em]",
      "md:@max-[899px]/main:text-[60px]",
      "max-md:text-[44px]",
    );
  });

  it("o topo do hero tem 28px no desktop e 12px no celular, com 14px entre eyebrow e título", async () => {
    mocks.requireUser.mockResolvedValue(authz());

    const { container } = render(await Greeting());

    expect(container.firstElementChild).toHaveClass(
      "flex",
      "flex-col",
      "gap-3.5",
      "pt-7",
      "max-md:pt-3",
    );
  });

  it("o link do dashboard não mora mais aqui (vai para a linha do hero)", async () => {
    mocks.requireUser.mockResolvedValue(authz());

    render(await Greeting());

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("nome vazio não deixa vírgula solta", async () => {
    mocks.requireUser.mockResolvedValue(authz({ name: "  " }));

    render(await Greeting());

    expect(
      screen.getByRole("heading", { level: 1, name: "Olá" }),
    ).toBeInTheDocument();
  });

  it("nome gigante de uma palavra só quebra em vez de estourar o cartão", async () => {
    mocks.requireUser.mockResolvedValue(authz({ name: "Anastaciosilvestre" }));

    render(await Greeting());

    expect(screen.getByRole("heading", { level: 1 })).toHaveClass(
      "break-words",
    );
  });

  it("sem sessão, propaga o redirect de requireUser (não renderiza)", async () => {
    mocks.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(Greeting()).rejects.toThrow("NEXT_REDIRECT");
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `bunx vitest run src/components/app-shell/Greeting.test.tsx`
Expected: FAIL (por exemplo "Unable to find an element with the text: SEXTA-FEIRA · 27 NOV 2026").

- [ ] **Step 7: Implementar o `Greeting`**

Substituir `src/components/app-shell/Greeting.tsx` por:

```tsx
import { formatEyebrowDateBR } from "@/features/handovers/saoPaulo";
import { requireUser } from "@/lib/auth/session";
import { greetingTitle } from "@/lib/names";

// Topo do hero do Início: eyebrow com a data e o título. O resto do hero (a
// linha do seletor/pílula e do dashboard) é do `HomeHandovers`, que é outra
// fronteira de <Suspense>. O espaçamento do protótipo (padding 28/40, gap 32)
// é repartido: o `pt-7` daqui, o `gap-3.5` entre eyebrow e título e o
// `pt-8`/`pb-10` da linha (ver `HomeHandovers`).
export async function Greeting() {
  const authz = await requireUser();
  // `new Date()` só depois do `requireUser` (dado de requisição), como pedem os
  // Cache Components; antes disso a rota não pré-renderiza.
  const eyebrow = formatEyebrowDateBR(new Date());

  return (
    <div className="flex flex-col gap-3.5 pt-7 max-md:pt-3">
      <p className="font-mono text-[13px] leading-none font-medium tracking-[0.06em] text-muted-foreground">
        {eyebrow}
      </p>
      <h1 className="font-heading text-[72px] leading-[0.95] font-black tracking-[-0.04em] break-words max-md:text-[44px] md:@max-[899px]/main:text-[60px]">
        {greetingTitle(authz.name)}
      </h1>
    </div>
  );
}
```

Observação: `md:@max-[899px]/main:` empilha o variante de mídia com o de container, para o 60px nunca vencer o 44px do celular, qualquer que seja a ordem em que o Tailwind gere as regras.

- [ ] **Step 8: Rodar e ver passar**

Run: `bunx vitest run src/components/app-shell/Greeting.test.tsx`
Expected: PASS (8 testes).

- [ ] **Step 9: Reescrever o teste do `PendingHandoverCard` (falha)**

Substituir o conteúdo de `src/components/passagens/PendingHandoverCard.test.tsx` por:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PendingHandover } from "@/features/handovers/home";
import { spDate } from "../../../test/clock";
import { PendingHandoverCard } from "./PendingHandoverCard";

// O cartão só desenha: o data URI do avatar vem pronto de quem chama (a semente
// = `deliveredById` é testada no HomeHandovers e no HomeCards).
const AVATAR = "data:image/svg+xml;seed,u-ana";

function renderCard(overrides: Partial<PendingHandover> = {}, avatarSrc = AVATAR) {
  return render(
    <PendingHandoverCard pending={pending(overrides)} avatarSrc={avatarSrc} />,
  );
}

function pending(overrides: Partial<PendingHandover> = {}): PendingHandover {
  return {
    id: "h1",
    sectorName: "ULD",
    shiftName: "Turno Manhã",
    operationalDate: "2026-11-20",
    deliveredById: "u-ana",
    deliveredByName: "Ana Teste",
    deliveredAt: spDate("2026-11-20", "14:05"),
    nextShiftPreview: "Rede de proteção no box 4.",
    ...overrides,
  };
}

describe("PendingHandoverCard", () => {
  it("mostra título, turno e data, quem entregou e o que fica para o próximo turno", () => {
    renderCard();

    expect(
      screen.getByRole("heading", { name: "Passagem para confirmar" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Turno Manhã · 20/11/2026")).toBeInTheDocument();
    expect(
      screen.getByText("Entregue às 14:05 por Ana Teste"),
    ).toBeInTheDocument();
    expect(screen.getByText("Fica para o próximo turno")).toBeInTheDocument();
    expect(screen.getByText("Rede de proteção no box 4.")).toBeInTheDocument();
  });

  it("é o cartão amarelo (feature) com tinta escura fixa, nos dois temas", () => {
    const { container } = renderCard();

    const card = container.firstElementChild;
    expect(card).toHaveAttribute("data-slot", "pending-handover");
    expect(card).toHaveClass("bg-highlight", "text-on-pastel");
  });

  it("duas colunas só com área útil de 1040px ou mais; abaixo disso, uma", () => {
    const { container } = renderCard();

    expect(container.firstElementChild).toHaveClass(
      "grid",
      "grid-cols-1",
      "gap-6",
      "@min-[1040px]/main:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]",
    );
  });

  it("o título é Satoshi 900 de 26px (22px no celular)", () => {
    renderCard();

    expect(
      screen.getByRole("heading", { name: "Passagem para confirmar" }),
    ).toHaveClass(
      "font-heading",
      "font-black",
      "text-[26px]",
      "max-md:text-[22px]",
    );
  });

  it("o avatar de quem entregou é o data URI recebido, decorativo, na moldura dos cards coloridos", () => {
    const { container } = renderCard({}, "data:image/svg+xml;seed,u-bruno");

    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "data:image/svg+xml;seed,u-bruno");
    expect(img).toHaveAttribute("alt", "");
    expect(img?.parentElement).toHaveClass("bg-on-pastel", "size-[36px]");
    expect(img?.parentElement?.style.transform).toBe("rotate(3deg)");
  });

  it("o texto de quem entregou usa o tom secundário do cartão amarelo", () => {
    renderCard();

    expect(screen.getByText("Entregue às 14:05 por Ana Teste")).toHaveClass(
      "text-on-highlight-muted",
    );
    expect(screen.getByText("Fica para o próximo turno")).toHaveClass(
      "text-on-highlight-soft",
    );
  });

  it("o texto do próximo turno preserva as quebras de linha", () => {
    renderCard({ nextShiftPreview: "Linha 1\nLinha 2" });

    expect(screen.getByText(/Linha 1/)).toHaveClass("whitespace-pre-line");
  });

  it("sem texto para o próximo turno, avisa que nada foi registrado", () => {
    renderCard({ nextShiftPreview: null });

    expect(
      screen.getByText("Nada registrado para o próximo turno."),
    ).toBeInTheDocument();
  });

  it("'Ver passagem' é o primário on-pastel (22px de padding), link para o resumo, com a seta decorativa", () => {
    renderCard({ id: "abc" });

    const link = screen.getByRole("link", { name: "Ver passagem" });
    expect(link).toHaveAttribute("href", "/passagens/abc");
    expect(link).toHaveClass("mt-auto", "bg-on-pastel", "px-[22px]");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("não tem botão de confirmar (a confirmação é no resumo)", () => {
    renderCard();

    expect(
      screen.queryByRole("button", { name: "Confirmar recebimento" }),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Rodar e ver falhar**

Run: `bunx vitest run src/components/passagens/PendingHandoverCard.test.tsx`
Expected: FAIL (por exemplo "expected element to have class: bg-highlight" e "Unable to find ... img").

- [ ] **Step 11: Implementar o `PendingHandoverCard`**

Substituir `src/components/passagens/PendingHandoverCard.tsx` por:

```tsx
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { UserAvatar } from "@/components/app-shell/UserAvatar";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PendingHandover } from "@/features/handovers/home";
import { formatDateBR, formatTimeBR } from "@/features/handovers/saoPaulo";
import { handoverHref } from "@/features/handovers/urls";

// Cartão do topo do Início: a passagem mais recente do setor (entre entregues
// e confirmadas), se ainda espera recebimento (F3-6). O servidor já escondeu
// de quem entregou. Amarelo = precisa de atenção (só este cartão usa o
// `--highlight`); a tinta é a fixa dos cartões coloridos, igual nos dois temas.
// Duas colunas só com área útil de 1040px ou mais (container `main`).
// `avatarSrc` é o data URI de quem entregou (`avatarDataUri(deliveredById)`,
// gerado por quem chama, no servidor): o cartão só desenha.
export function PendingHandoverCard({
  pending,
  avatarSrc,
}: {
  pending: PendingHandover;
  avatarSrc: string;
}) {
  return (
    <Card
      variant="feature"
      data-slot="pending-handover"
      className="grid grid-cols-1 gap-6 bg-highlight text-on-pastel @min-[1040px]/main:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
    >
      <div className="flex flex-col items-start gap-[18px]">
        <h2 className="font-heading text-[26px] leading-none font-black tracking-[-0.025em] max-md:text-[22px]">
          Passagem para confirmar
        </h2>
        <div className="flex flex-col gap-3">
          <p className="font-heading text-[19px] font-bold">
            {pending.shiftName} · {formatDateBR(pending.operationalDate)}
          </p>
          <div className="flex items-center gap-2.5">
            <UserAvatar src={avatarSrc} size={36} tilt={3} frame="on-pastel" />
            <p className="text-[15px] text-on-highlight-muted">
              Entregue às {formatTimeBR(pending.deliveredAt)} por{" "}
              {pending.deliveredByName}
            </p>
          </div>
        </div>
        <Link
          href={handoverHref(pending.id)}
          className={`${buttonVariants({ variant: "on-pastel", size: "pill" })} mt-auto`}
        >
          Ver passagem
          <ArrowRight aria-hidden="true" strokeWidth={2.2} />
        </Link>
      </div>
      <div className="flex flex-col gap-2 rounded-[22px] bg-on-pastel-soft px-[22px] py-5">
        <p className="font-mono text-xs leading-none font-medium tracking-[0.06em] text-on-highlight-soft uppercase">
          Fica para o próximo turno
        </p>
        <p className="text-base leading-[1.55] text-pretty whitespace-pre-line">
          {pending.nextShiftPreview ?? "Nada registrado para o próximo turno."}
        </p>
      </div>
    </Card>
  );
}
```

- [ ] **Step 12: Rodar e ver passar**

Run: `bunx vitest run src/components/passagens/PendingHandoverCard.test.tsx`
Expected: PASS (10 testes). Se a Task 4 tiver chamado a prop de outro jeito, o teste de tipo (`check-types`) acusa; corrija o nome aqui, não invente variante nova.

- [ ] **Step 13: Atualizar o teste do `HomeHandovers` (falha)**

Em `src/components/passagens/HomeHandovers.test.tsx`:

(a) Se, depois da Task 7, ainda existir `aria-pressed` ou `getByRole("group", { name: "Setor" })` neste arquivo (`grep -n 'aria-pressed\|"group"' src/components/passagens/HomeHandovers.test.tsx`), trocar assim; se a Task 7 já trocou, pular este item: `getByRole("group", { name: "Setor" })` → `getByRole("radiogroup", { name: "Setor" })`; `queryByRole("group", { name: "Setor" })` → `queryByRole("radiogroup", { name: "Setor" })`; `getByRole("button", { name: "Carga" })` e `getByRole("button", { name: "ULD" })` → `getByRole("radio", { name: "Carga" })` / `getByRole("radio", { name: "ULD" })`; `toHaveAttribute("aria-pressed", "true")` → `toHaveAttribute("aria-checked", "true")`.

(b) Inserir estes testes logo antes de `it("operador sem passagem: só o cartão do turno, 'Começar passagem', sem seletor", ...)`:

```tsx
  describe("hero (linha do seletor/pílula e do dashboard)", () => {
    it("operador: pílula do setor (só leitura) e o botão 'Ver o dashboard'", async () => {
      const { uld, ana } = await setup();
      mocks.requireUser.mockResolvedValue(
        authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
      );

      await renderHome();

      const row = document.querySelector('[data-slot="home-hero-row"]');
      const pill = row?.querySelector('[data-slot="sector-pill"]');
      expect(pill).toHaveTextContent("Setor");
      expect(pill).toHaveTextContent("ULD");
      expect(
        screen.queryByRole("radiogroup", { name: "Setor" }),
      ).not.toBeInTheDocument();
      expect(
        within(row as HTMLElement).getByRole("link", {
          name: "Ver o dashboard",
        }),
      ).toHaveAttribute("href", "/dashboard");
    });

    it("admin: o seletor de setor fica na linha, sem a pílula, e o botão do dashboard também", async () => {
      await insertSector(db, "Carga");
      await insertSector(db, "ULD");
      mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

      await renderHome();

      const row = document.querySelector(
        '[data-slot="home-hero-row"]',
      ) as HTMLElement;
      expect(
        within(row).getByRole("radiogroup", { name: "Setor" }),
      ).toBeInTheDocument();
      expect(row.querySelector('[data-slot="sector-pill"]')).toBeNull();
      expect(
        within(row).getByRole("link", { name: "Ver o dashboard" }),
      ).toHaveAttribute("href", "/dashboard");
    });

    it("a linha tem o espaçamento do protótipo: 32px em cima e 40px embaixo (24 e 28 no celular), quebrando linha no celular", async () => {
      const { uld, ana } = await setup();
      mocks.requireUser.mockResolvedValue(
        authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
      );

      await renderHome();

      expect(
        document.querySelector('[data-slot="home-hero-row"]'),
      ).toHaveClass(
        "flex",
        "flex-wrap",
        "items-center",
        "justify-between",
        "gap-4",
        "pt-8",
        "pb-10",
        "max-md:pt-6",
        "max-md:pb-7",
      );
    });

    it("a linha vem antes dos cartões, que ficam no ponto de extensão 'home-cards' com 16px de gap", async () => {
      const { uld, ana } = await setup();
      mocks.requireUser.mockResolvedValue(
        authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
      );

      await renderHome();

      const row = document.querySelector('[data-slot="home-hero-row"]');
      const cards = document.querySelector('[data-slot="home-cards"]');
      expect(cards).toHaveClass("flex", "flex-col", "gap-4");
      expect(
        row?.compareDocumentPosition(cards as Node) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        within(cards as HTMLElement).getByRole("heading", {
          name: "Passagem do meu turno",
        }),
      ).toBeInTheDocument();
    });

    it("o botão do dashboard é pílula 'surface' de 48px com o ícone decorativo", async () => {
      const { uld, ana } = await setup();
      mocks.requireUser.mockResolvedValue(
        authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
      );

      await renderHome();

      const link = screen.getByRole("link", { name: "Ver o dashboard" });
      expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
      expect(link).toHaveClass("bg-card", "rounded-full", "h-12", "px-5");
      // 20px de padding (protótipo), não os 22px do `pill`: o `cn` tira o outro.
      expect(link).not.toHaveClass("px-[22px]");
    });

    it("sem setor ativo (admin) e setor inativo (operador): sem seletor nem pílula, mas o dashboard continua à mão", async () => {
      await insertSector(db, "Parado", { active: false });
      mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));
      await renderHome();
      expect(
        screen.getByRole("link", { name: "Ver o dashboard" }),
      ).toHaveAttribute("href", "/dashboard");
      expect(
        document.querySelector('[data-slot="sector-pill"]'),
      ).toBeNull();
      cleanup();

      const parado = await insertSector(db, "Inativo operador", {
        active: false,
      });
      const ana = await insertUser(db, {
        role: "operator",
        sectorId: parado.id,
      });
      mocks.requireUser.mockResolvedValue(
        authzOf({ role: "operator", userId: ana.id, sectorId: parado.id }),
      );
      await renderHome();
      expect(
        screen.getByRole("link", { name: "Ver o dashboard" }),
      ).toHaveAttribute("href", "/dashboard");
      expect(screen.getByText("Seu setor está inativo.")).toBeInTheDocument();
    });

    it("a pílula usa a cor do setor escolhida na tela Setores", async () => {
      const verde = await insertSector(db, "Carga", { color: "green" });
      const ana = await insertUser(db, { role: "operator", sectorId: verde.id });
      mocks.requireUser.mockResolvedValue(
        authzOf({ role: "operator", userId: ana.id, sectorId: verde.id }),
      );

      await renderHome();

      expect(
        document.querySelector('[data-slot="sector-pill"] .bg-sector-green'),
      ).not.toBeNull();
    });
  });

```

(c) No teste `passagem entregue por outra pessoa aparece no topo para confirmar`, depois de `expect(screen.getByText("Conferir a rede do box 4.")).toBeInTheDocument();` acrescentar:

```tsx
    expect(
      document.querySelector('[data-slot="pending-handover"] img'),
    ).toHaveAttribute("src", expect.stringContaining("data:image/svg+xml"));
```

- [ ] **Step 14: Rodar e ver falhar**

Run: `bunx vitest run src/components/passagens/HomeHandovers.test.tsx`
Expected: FAIL (por exemplo "Unable to find ... [data-slot=home-hero-row]" / `home-hero-row` nulo).

- [ ] **Step 15: Implementar o `HomeHandovers`**

Substituir `src/components/passagens/HomeHandovers.tsx` por:

```tsx
import { cn } from "cn";
import { ChartColumn } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/admin/EmptyState";
import { RequestsHomeCard } from "@/components/solicitacoes/RequestsHomeCard";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/db";
import { getHomeHandovers } from "@/features/handovers/home";
import { resolveScreenSector } from "@/features/handovers/screenSector";
import { getHomeRequests } from "@/features/requests/home";
import { requestsHref } from "@/features/requests/urls";
import { requireUser } from "@/lib/auth/session";
import { avatarDataUri } from "@/lib/avatar";
import type { SearchParams } from "@/lib/searchParams";

import { MyShiftCard } from "./MyShiftCard";
import { PendingHandoverCard } from "./PendingHandoverCard";
import { SectorPicker } from "./SectorPicker";
import { SectorPill } from "./SectorPill";

type HomeHandoversProps = {
  searchParams: Promise<SearchParams>;
};

// Linha de baixo do hero (spec §6.2): o seletor do admin ou a pílula do
// operador à esquerda e "Ver o dashboard" à direita. O espaçamento do
// protótipo vem daqui: 32px de gap em cima (pt-8; 24px no celular) e 40px de
// padding embaixo (pb-10; 28px) — o resto do hero (28px de topo, eyebrow e
// título) é do `Greeting`. Sem `lead` (erros), só o botão do dashboard.
function HeroRow({ lead }: { lead: ReactNode }) {
  return (
    <div
      data-slot="home-hero-row"
      className="flex flex-wrap items-center justify-between gap-4 pt-8 pb-10 max-md:pt-6 max-md:pb-7"
    >
      {lead}
      {/* 20px de padding (protótipo): o `cn` troca o `px-[22px]` do `pill`. */}
      <Link
        href="/dashboard"
        className={cn(
          buttonVariants({ variant: "surface", size: "pill" }),
          "px-5",
        )}
      >
        <ChartColumn aria-hidden="true" strokeWidth={2.2} />
        Ver o dashboard
      </Link>
    </div>
  );
}

function HomeFrame({
  lead = null,
  children,
}: {
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <HeroRow lead={lead} />
      {children}
    </>
  );
}

// Cartões do Início. Lê sessão, cookie e URL: só dentro de <Suspense>.
export async function HomeHandovers({ searchParams }: HomeHandoversProps) {
  const actor = await requireUser();
  const params = await searchParams;

  // Operador sempre usa o próprio setor (toAuthz garante que existe).
  if (actor.role !== "admin" && actor.sectorId === null) notFound();

  const screen = await resolveScreenSector(db, actor, {
    url: params.setor,
    allowAll: false,
  });
  if (screen.kind === "missing") notFound();
  if (screen.kind === "inactive") {
    return (
      <HomeFrame>
        <EmptyState
          title="Seu setor está inativo."
          description="Peça a um administrador para reativá-lo."
        />
      </HomeFrame>
    );
  }
  if (screen.kind !== "sector") {
    return (
      <HomeFrame>
        <EmptyState
          title="Nenhum setor ativo."
          description="Cadastre ou reative um setor para usar a passagem de turno."
          action={{ label: "Ir para Setores", href: "/admin/setores" }}
        />
      </HomeFrame>
    );
  }

  const { sectorId, sectorParam } = screen;
  const picker =
    sectorParam === null ? null : (
      <SectorPicker
        sectors={screen.sectors}
        selectedId={sectorParam}
        path="/"
      />
    );

  const now = new Date();
  const result = await getHomeHandovers(db, actor, sectorId, now);
  if (!result.ok) {
    if (result.code !== "SECTOR_INACTIVE") notFound();
    return (
      <HomeFrame>
        <EmptyState
          title="Seu setor está inativo."
          description="Peça a um administrador para reativá-lo."
        />
      </HomeFrame>
    );
  }

  const { home } = result;
  // O setor já foi validado (existe, é do ator e está ativo) pelo getHomeHandovers.
  const requests = await getHomeRequests(db, actor, home.sector.id, now);
  return (
    <HomeFrame
      lead={
        picker ?? (
          <SectorPill name={home.sector.name} color={home.sector.color} />
        )
      }
    >
      {/* Ponto de extensão do Início: aqui entram o convite (antes do pendente) e o
          grid de 2 colunas (no lugar dos dois cartões finais). */}
      <div data-slot="home-cards" className="flex flex-col gap-4">
        {home.pending && (
          <PendingHandoverCard
            pending={home.pending}
            avatarSrc={avatarDataUri(home.pending.deliveredById)}
          />
        )}
        <MyShiftCard
          state={home.mine}
          sectorId={home.sector.id}
          canManageCatalog={actor.role === "admin"}
          sectorParam={sectorParam}
        />
        <RequestsHomeCard
          home={requests}
          allHref={requestsHref(sectorParam)}
        />
      </div>
    </HomeFrame>
  );
}
```

- [ ] **Step 16: Rodar e ver passar**

Run: `bunx vitest run src/components/passagens/HomeHandovers.test.tsx`
Expected: PASS (testes novos e os antigos; as ordens de `h2` continuam as mesmas).

- [ ] **Step 17: Atualizar o teste da página (falha)**

Substituir o primeiro `it` de `src/app/(app)/page.test.tsx` (o que conta os esqueletos) por:

```tsx
  it("enquanto carrega, o esqueleto tem o eyebrow, o título, a linha do hero e 2 cartões de 32px", () => {
    const { container } = render(
      <HomePage searchParams={Promise.resolve({})} />,
    );

    // eyebrow + título + linha do seletor + 2 cartões.
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(
      5,
    );
    expect(
      container.querySelectorAll('[data-slot="skeleton"].rounded-\\[32px\\]'),
    ).toHaveLength(2);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("os esqueletos reproduzem o espaçamento do hero (sem gap no contêiner da página)", () => {
    const { container } = render(
      <HomePage searchParams={Promise.resolve({})} />,
    );

    expect(container.firstElementChild).toHaveClass("flex", "flex-col");
    expect(container.firstElementChild).not.toHaveClass("gap-6");
    const [eyebrow, title] = container.querySelectorAll(
      '[data-slot="skeleton"]',
    );
    expect(eyebrow).toHaveClass("h-3.5");
    expect(title).toHaveClass("rounded-2xl");
    expect(title?.parentElement).toHaveClass("gap-3.5", "pt-7", "max-md:pt-3");
    expect(
      container.querySelector('[data-slot="skeleton-hero-row"]'),
    ).toHaveClass("pt-8", "pb-10", "max-md:pt-6", "max-md:pb-7");
  });
```

- [ ] **Step 18: Rodar e ver falhar**

Run: `bunx vitest run "src/app/(app)/page.test.tsx"`
Expected: FAIL (esqueleto antigo: 5 elementos mas nenhum `.rounded-[32px]`; contêiner com `gap-6`).

- [ ] **Step 19: Implementar a página e os esqueletos**

Em `src/app/(app)/page.tsx`, trocar o `return` e as duas funções de esqueleto por:

```tsx
export default function HomePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Sem gap: o espaçamento do hero é do próprio conteúdo (Greeting e a linha do
  // HomeHandovers), igual ao padding da `section` do protótipo.
  return (
    <div className="flex flex-col">
      <Suspense fallback={<GreetingSkeleton />}>
        <Greeting />
      </Suspense>
      <Suspense fallback={<HandoversSkeleton />}>
        <HomeHandovers searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

// Mesma geometria do Greeting: 28px de topo (12 no celular), eyebrow de 14px,
// 14px de gap e o título (72px × .95 ≈ 68px; 44px × .95 ≈ 42px no celular).
function GreetingSkeleton() {
  return (
    <div className="flex flex-col gap-3.5 pt-7 max-md:pt-3">
      <Skeleton className="h-3.5 w-56 max-w-full" />
      <Skeleton className="h-[68px] w-80 max-w-full rounded-2xl max-md:h-[42px]" />
    </div>
  );
}

// A linha do hero (seletor de 48px) e os cartões de raio 32 no grid do Início
// (1 coluna; 1.3fr/1fr com área útil de 1040px ou mais).
function HandoversSkeleton() {
  return (
    <>
      <div
        data-slot="skeleton-hero-row"
        className="pt-8 pb-10 max-md:pt-6 max-md:pb-7"
      >
        <Skeleton className="h-12 w-[480px] max-w-full rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 @min-[1040px]/main:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Skeleton className="h-72 rounded-[32px] bg-card" />
        <Skeleton className="h-72 rounded-[32px] bg-card" />
      </div>
    </>
  );
}
```

- [ ] **Step 20: Rodar e ver passar**

Run: `bunx vitest run "src/app/(app)/page.test.tsx"`
Expected: PASS (3 testes).

- [ ] **Step 21: Atualizar `.context/ui-registry.md`**

Use a ferramenta Edit em `.context/ui-registry.md`:

1. Greeting. Trocar a linha `- **Propósito:** título "Olá, {primeiro nome}" e o link para o dashboard.` por:

```
- **Propósito:** o topo do hero do Início: eyebrow com a data por extenso (São Paulo, caixa alta) e o título "Olá, {primeiro nome}".
```

   Trocar `- **Usa:** \`requireUser\`, \`greetingTitle\`.` por:

```
- **Usa:** `requireUser`, `greetingTitle`, `formatEyebrowDateBR`.
```

   E acrescentar ao fim da linha `- **Histórico:**` do Greeting (depois de `(alvo de toque de 44 px no celular; o desktop não muda).`):

```
 2026-11-27 — visual novo do Início (Tarefa 11): eyebrow mono 13px com a data e `h1` Satoshi 900 de 72px (60px com área útil abaixo de 900px, 44px no celular); o link "Ver o dashboard" saiu daqui e virou o botão `surface` da linha do hero no `HomeHandovers`; topo do hero `pt-7` (`max-md:pt-3`), gap de 14px entre eyebrow e título.
```

2. PendingHandoverCard. Trocar `- **Usa:** \`Card\`, \`buttonVariants\`, \`formatDateBR\`, \`formatTimeBR\`, \`handoverHref\`.` (a linha dentro da seção do PendingHandoverCard) e o `Histórico` da seção (`- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 7).` seguido de `### MyShiftCard`) por estas duas linhas, mais a seção nova do `SectorPill` logo depois (antes de `### MyShiftCard`):

```
- **Usa:** `Card` (`feature`), `buttonVariants` (`on-pastel`, `pill`), `UserAvatar`, `formatDateBR`, `formatTimeBR`, `handoverHref`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 7). 2026-11-27 — visual novo (Tarefa 11): prop nova `avatarSrc` (data URI de quem entregou, gerado por quem chama: o cartão só desenha); `Card feature` em `--highlight` com tinta `--on-pastel`, grid `minmax(0,1fr) minmax(0,1.2fr)` só com área útil ≥ 1040px, avatar de 36px (inclinado 3°) de quem entregou, bloco `--on-pastel-soft` "Fica para o próximo turno" e botão `on-pastel` "Ver passagem" com `ArrowRight` no fim da coluna; sem mudança de regra.

### SectorPill
- **Status:** ✅ pronto (2026-11-27)
- **Local:** `src/components/passagens/SectorPill.tsx`
- **Propósito:** o setor do operador no hero do Início, só para leitura (o admin troca pelo `SectorPicker`).
- **Como funciona:** Server-safe. Pílula de 48px em `bg-card`: bolinha de 10px na cor do setor (`SECTOR_COLOR_BG`, `aria-hidden`), "Setor" em mono 12px `text-muted-foreground` e o nome em Satoshi 700/16px com reticências. Não é botão nem link.
- **Usa:** `SECTOR_COLOR_BG`.
- **Histórico:** 2026-11-27 — criado no visual novo do Início (Tarefa 11).

```

3. HomeHandovers. Trocar `- **Usa:** \`getHomeHandovers\`, \`resolveScreenSector\`, \`EmptyState\`, \`SectorPicker\`. Também: ...` acrescentando ao fim `, \`SectorPill\`, \`buttonVariants\`, \`avatarDataUri\` (avatar de quem entregou o pendente).` e acrescentar ao fim do `Histórico` (depois de `(sem mudar o comportamento).`):

```
 2026-11-27 — visual novo (Tarefa 11): devolve a linha do hero (`data-slot="home-hero-row"`: o seletor do admin ou o `SectorPill` do operador, e o botão "Ver o dashboard") e, depois, os cartões em `data-slot="home-cards"` (`gap-4`, ponto de extensão do convite e do grid). Os ramos de erro (setor inativo, sem setor ativo) também levam a linha, só com o botão do dashboard. Espaçamento do hero: `pt-8 pb-10` (`max-md:pt-6 max-md:pb-7`).
```

   Atualizar também, no `Como funciona` do HomeHandovers, nada mais é preciso: a ordem dos cartões não mudou.

- [ ] **Step 22: Tipos, lint, guarda do registro e testes que mencionam o que foi tocado**

Run: `bun run check-types && bun run lint`
Expected: sem erros.

Run: `grep -rl "Greeting\|PendingHandoverCard\|HomeHandovers\|SectorPill\|GreetingSkeleton" src test e2e`
Run: `bunx vitest run src/components/app-shell/Greeting.test.tsx src/components/passagens/SectorPill.test.tsx src/components/passagens/PendingHandoverCard.test.tsx src/components/passagens/HomeHandovers.test.tsx "src/app/(app)/page.test.tsx" test/uiRegistryDoc.test.ts`
Expected: PASS (o `uiRegistryDoc.test.ts` exige a entrada do `SectorPill`).

E2E (não rodar aqui; o controlador roda no fim): `e2e/auth.spec.ts` continua valendo, porque "Olá, Ana" e o link "Ver o dashboard" seguem na página também para o admin sem setor ativo (o botão do dashboard está nos ramos de erro). `e2e/touch-targets.spec.ts` é da Task 14.

- [ ] **Step 23: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/visual/msg-task-11.txt`:

```
feat(inicio): hero novo (data, título, seletor ou pílula, dashboard) e cartão pendente

Greeting com eyebrow da data e título Satoshi; HomeHandovers com a linha do
hero (SectorPicker do admin ou SectorPill do operador, mais o botão "Ver o
dashboard") e os cartões em home-cards; PendingHandoverCard amarelo com avatar
de quem entregou; esqueletos com a mesma geometria. O espaçamento do protótipo
é repartido entre Greeting e HomeHandovers.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Run: `git add src/components/passagens/SectorPill.tsx src/components/passagens/SectorPill.test.tsx src/components/app-shell/Greeting.tsx src/components/app-shell/Greeting.test.tsx src/components/passagens/HomeHandovers.tsx src/components/passagens/HomeHandovers.test.tsx src/components/passagens/PendingHandoverCard.tsx src/components/passagens/PendingHandoverCard.test.tsx "src/app/(app)/page.tsx" "src/app/(app)/page.test.tsx" .context/ui-registry.md && git commit -F .git/sdd/visual/msg-task-11.txt`
Expected: commit criado; `git status` limpo.

---

### Task 12: `MyShiftCard` (5 estados) e `ShiftProgressBar`

**Files:**
- Create: `src/components/passagens/ShiftProgressBar.tsx`
- Create: `src/components/passagens/ShiftProgressBar.test.tsx`
- Modify: `src/components/passagens/MyShiftCard.tsx` (reescrito: cor do setor, chip, horário grande, barra, 5 estados, rodapé)
- Modify: `src/components/passagens/MyShiftCard.test.tsx` (reescrito)
- Modify: `src/components/passagens/HomeHandovers.tsx` (só as props novas do `MyShiftCard`; a Task 14 reorganiza o grid)
- Modify: `src/components/passagens/HomeHandovers.test.tsx` (mock do avatar + 2 testes)
- Modify: `.context/ui-registry.md` (`MyShiftCard` estendido, `ShiftProgressBar` novo, `HomeHandovers` histórico)

**Interfaces:**
- Consumes: `ShiftProgress` (`@/features/handovers/shiftProgress`), `MyShiftState` com `progress`/`saved.byId`, `SECTOR_COLOR_BG`/`SectorColor`, `UserAvatar`, `avatarDataUri`, `Card variant="feature"`, `Badge` (`pastel-pending`, `pastel-confirmed`, `size="md"`), `buttonVariants` (`on-pastel`, `on-pastel-secondary`, `size: "pill"`).
- Produces:
  - `export function ShiftProgressBar({ progress }: { progress: ShiftProgress })`
  - `export function MyShiftCard(props: { state: MyShiftState; sectorId: string; sectorName: string; sectorColor: SectorColor; canManageCatalog: boolean; sectorParam: string | null; avatarSrc?: string | null })`. `avatarSrc` é o avatar de quem salvou o rascunho (só o estado `continue` usa; `null`/ausente = sem avatar).

- [ ] **Step 1: Escrever o teste da barra (falha)**

Write `src/components/passagens/ShiftProgressBar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ShiftProgress } from "@/features/handovers/shiftProgress";
import { ShiftProgressBar } from "./ShiftProgressBar";

function progress(overrides: Partial<ShiftProgress> = {}): ShiftProgress {
  return {
    startLabel: "06:00",
    endLabel: "14:00",
    nowLabel: "08:42",
    pct: 34,
    ...overrides,
  };
}

function fillOf(bar: HTMLElement): HTMLElement {
  const fill = bar.firstElementChild;
  if (!(fill instanceof HTMLElement)) throw new Error("preenchimento ausente");
  return fill;
}

describe("ShiftProgressBar", () => {
  it("mostra início, 'agora HH:MM' e fim em mono, com tabular-nums", () => {
    render(<ShiftProgressBar progress={progress()} />);

    expect(screen.getByText("06:00")).toBeInTheDocument();
    expect(screen.getByText("agora 08:42")).toBeInTheDocument();
    expect(screen.getByText("14:00")).toBeInTheDocument();
    expect(screen.getByText("agora 08:42").parentElement).toHaveClass(
      "font-mono",
      "tabular-nums",
    );
  });

  it("é uma progressbar com nome, valor e texto falado", () => {
    render(<ShiftProgressBar progress={progress({ pct: 33.6 })} />);

    const bar = screen.getByRole("progressbar", {
      name: "Progresso do turno",
    });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-valuenow", "34");
    expect(bar).toHaveAttribute(
      "aria-valuetext",
      "Turno em 34%, agora 08:42",
    );
  });

  it("o preenchimento tem a largura do pct, no trilho e na tinta dos pastéis", () => {
    render(<ShiftProgressBar progress={progress({ pct: 34 })} />);

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveClass("h-2.5", "rounded-full", "bg-on-pastel-track");
    expect(fillOf(bar)).toHaveClass("bg-on-pastel");
    expect(fillOf(bar)).toHaveStyle({ width: "34%" });
  });

  it.each([
    [0, "0%"],
    [100, "100%"],
    [-5, "0%"],
    [150, "100%"],
    [Number.NaN, "0%"],
  ])("limite: pct %s vira largura %s (preso entre 0 e 100)", (pct, width) => {
    render(<ShiftProgressBar progress={progress({ pct })} />);

    expect(fillOf(screen.getByRole("progressbar"))).toHaveStyle({ width });
  });

  it("usa só tokens de cor (sem hex nem classe crua)", () => {
    const { container } = render(<ShiftProgressBar progress={progress()} />);

    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(container.innerHTML).not.toMatch(
      /\b(?:bg|text|border)-(?:red|green|blue|yellow|amber|orange|gray|slate|zinc)-\d+/,
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bunx vitest run src/components/passagens/ShiftProgressBar.test.tsx`
Expected: FAIL com "Failed to resolve import "./ShiftProgressBar""

- [ ] **Step 3: Implementar a barra**

Write `src/components/passagens/ShiftProgressBar.tsx`:

```tsx
import type { ShiftProgress } from "@/features/handovers/shiftProgress";

// Barra do turno do cartão "Passagem do meu turno" (estados start e continue).
// O servidor já calculou tudo (`shiftProgress`); aqui só se desenha. Trilho de
// 10px e preenchimento em tinta de pastel; a largura é presa entre 0 e 100.
export function ShiftProgressBar({ progress }: { progress: ShiftProgress }) {
  const pct = Number.isFinite(progress.pct)
    ? Math.min(100, Math.max(0, progress.pct))
    : 0;
  const rounded = Math.round(pct);
  return (
    <div className="flex flex-col gap-2">
      <div
        role="progressbar"
        aria-label="Progresso do turno"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rounded}
        aria-valuetext={`Turno em ${rounded}%, agora ${progress.nowLabel}`}
        className="h-2.5 overflow-hidden rounded-full bg-on-pastel-track"
      >
        <div
          className="h-full rounded-full bg-on-pastel"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between font-mono text-xs font-medium text-on-pastel-muted tabular-nums">
        <span>{progress.startLabel}</span>
        <span>agora {progress.nowLabel}</span>
        <span>{progress.endLabel}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bunx vitest run src/components/passagens/ShiftProgressBar.test.tsx`
Expected: PASS (`Tests  9 passed`: 4 testes avulsos + 5 casos do `it.each`)

- [ ] **Step 5: Reescrever o teste do `MyShiftCard` (falha)**

Substitua o arquivo inteiro `src/components/passagens/MyShiftCard.test.tsx` por:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MyShiftState } from "@/features/handovers/home";
import { SECTOR_COLOR_BG, SECTOR_COLORS } from "@/features/sectors/colors";
import { spDate } from "../../../test/clock";
import { MyShiftCard } from "./MyShiftCard";

const SECTOR_ID = "11111111-1111-4111-8111-111111111111";
const SHIFT = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Turno Manhã",
  startsAt: "06:00",
  endsAt: "14:00",
};
const REF = {
  sectorId: SECTOR_ID,
  shiftId: SHIFT.id,
  operationalDate: "2026-11-20",
};
const PROGRESS = {
  startLabel: "06:00",
  endLabel: "14:00",
  nowLabel: "08:42",
  pct: 34,
};
const AVATAR = "data:image/svg+xml,rascunho";

const START: MyShiftState = {
  kind: "start",
  ref: REF,
  shift: SHIFT,
  saved: null,
  progress: PROGRESS,
};
const CONTINUE: MyShiftState = {
  kind: "continue",
  ref: REF,
  shift: SHIFT,
  saved: {
    at: spDate("2026-11-20", "13:41"),
    byName: "Ana Teste",
    byId: "u-ana",
  },
  progress: PROGRESS,
};
const DELIVERED: MyShiftState = {
  kind: "delivered",
  handoverId: "h1",
  ref: REF,
  shift: SHIFT,
  deliveredByName: "Ana Teste",
  deliveredAt: spDate("2026-11-20", "14:05"),
  confirmedByName: null,
  confirmedAt: null,
};
const CONFIRMED: MyShiftState = {
  kind: "confirmed",
  handoverId: "h1",
  ref: REF,
  shift: SHIFT,
  deliveredByName: "Ana Teste",
  deliveredAt: spDate("2026-11-20", "14:05"),
  confirmedByName: "Bia Teste",
  confirmedAt: spDate("2026-11-20", "14:20"),
};
const NO_SHIFTS: MyShiftState = { kind: "no-shifts" };

type Props = Parameters<typeof MyShiftCard>[0];

function renderCard(
  state: MyShiftState,
  props: Partial<Omit<Props, "state">> = {},
) {
  return render(
    <MyShiftCard
      state={state}
      sectorId={SECTOR_ID}
      sectorName="ULD"
      sectorColor="lilac"
      canManageCatalog={false}
      sectorParam={null}
      avatarSrc={null}
      {...props}
    />,
  );
}

function cardOf(container: HTMLElement): HTMLElement {
  const card = container.querySelector('[data-slot="card"]');
  if (!(card instanceof HTMLElement)) throw new Error("cartão ausente");
  return card;
}

describe("MyShiftCard", () => {
  it("start: título, turno, horário, data, barra, nota de sugestão e 'Começar passagem'", () => {
    renderCard(START);

    expect(
      screen.getByRole("heading", { level: 2, name: "Passagem do meu turno" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Turno Manhã")).toBeInTheDocument();
    expect(screen.getByText("06:00–14:00")).toBeInTheDocument();
    expect(screen.getByText("20/11/2026")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Progresso do turno" }),
    ).toHaveAttribute("aria-valuenow", "34");
    expect(screen.getByText("agora 08:42")).toBeInTheDocument();
    expect(
      screen.getByText("Turno sugerido pelo horário de agora."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Começar passagem" }),
    ).toHaveAttribute(
      "href",
      `/passagens/nova?turno=${SHIFT.id}&data=2026-11-20`,
    );
    expect(screen.queryByText(/Rascunho salvo/)).not.toBeInTheDocument();
  });

  it("start de admin leva o setor na URL", () => {
    renderCard(START, { sectorParam: SECTOR_ID });

    expect(
      screen.getByRole("link", { name: "Começar passagem" }),
    ).toHaveAttribute(
      "href",
      `/passagens/nova?turno=${SHIFT.id}&data=2026-11-20&setor=${SECTOR_ID}`,
    );
  });

  it("o cartão leva a cor do setor, a tinta de pastel e o crossfade que respeita movimento reduzido", () => {
    const { container } = renderCard(START, { sectorColor: "peach" });

    const card = cardOf(container);
    expect(card).toHaveClass(
      SECTOR_COLOR_BG.peach,
      "text-on-pastel",
      "transition-colors",
      "duration-[450ms]",
      "motion-reduce:transition-none",
    );
  });

  it.each(SECTOR_COLORS)("a cor %s do setor vira o fundo do cartão", (color) => {
    const { container } = renderCard(START, { sectorColor: color });

    expect(cardOf(container)).toHaveClass(SECTOR_COLOR_BG[color]);
  });

  it("o chip mostra o nome do setor, sem quebrar linha (reticências se for longo)", () => {
    renderCard(START, { sectorName: "Operações de Pátio Internacional" });

    const chip = screen.getByText("Operações de Pátio Internacional");
    expect(chip).toHaveClass("truncate", "whitespace-nowrap", "bg-on-pastel");
    expect(chip).toHaveAttribute("title", "Operações de Pátio Internacional");
  });

  it("o horário usa tabular-nums e os tamanhos 64/52/44 por container query e celular", () => {
    renderCard(START);

    const time = screen.getByText("06:00–14:00");
    expect(time).toHaveClass(
      "tabular-nums",
      "font-black",
      "text-[64px]",
      "max-md:text-[44px]",
      "@min-[1040px]/main:@max-[1239px]/main:text-[52px]",
    );
  });

  it("continue: barra, quando e por quem o rascunho foi salvo (com avatar) e 'Continuar passagem'", () => {
    const { container } = renderCard(CONTINUE, { avatarSrc: AVATAR });

    expect(
      screen.getByText("Rascunho salvo às 13:41 por Ana Teste"),
    ).toBeInTheDocument();
    const avatar = container.querySelector("img");
    expect(avatar).toHaveAttribute("src", AVATAR);
    expect(avatar).toHaveAttribute("alt", "");
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continuar passagem" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Começar passagem" }),
    ).not.toBeInTheDocument();
  });

  it("continue sem marca de salvamento não inventa a frase nem o avatar", () => {
    const { container } = renderCard(
      { ...CONTINUE, saved: null },
      { avatarSrc: AVATAR },
    );

    expect(screen.queryByText(/Rascunho salvo/)).not.toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Continuar passagem" }),
    ).toBeInTheDocument();
  });

  it("continue com marca, mas sem avatar: a frase aparece e a imagem não", () => {
    const { container } = renderCard(CONTINUE, { avatarSrc: null });

    expect(
      screen.getByText("Rascunho salvo às 13:41 por Ana Teste"),
    ).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("delivered: selo 'Aguardando recebimento', quem entregou, link para a passagem e sem barra", () => {
    renderCard(DELIVERED);

    // Selo pastel no tamanho do protótipo (28px, 12px de padding, 13px).
    expect(screen.getByText("Aguardando recebimento")).toHaveClass(
      "bg-pastel-pending",
      "text-pastel-pending-foreground",
      "h-7",
      "px-3",
      "text-[13px]",
    );
    expect(screen.getByText("Aguardando recebimento")).not.toHaveClass("h-6");
    expect(
      screen.getByText(
        "Entregue às 14:05 por Ana Teste. Aguardando recebimento.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver passagem" })).toHaveAttribute(
      "href",
      "/passagens/h1",
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Turno sugerido pelo horário de agora."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Começar passagem" }),
    ).not.toBeInTheDocument();
  });

  it("confirmed: selo 'Confirmada', entrega e confirmação com nomes e horas", () => {
    renderCard(CONFIRMED);

    expect(screen.getByText("Confirmada")).toHaveClass(
      "bg-pastel-confirmed",
      "text-pastel-confirmed-foreground",
      "h-7",
    );
    expect(
      screen.getByText(
        "Entregue por Ana Teste às 14:05. Confirmada por Bia Teste às 14:20.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver passagem" })).toHaveAttribute(
      "href",
      "/passagens/h1",
    );
  });

  it("confirmed sem quem confirmou nem hora: 'outra pessoa', sem inventar a hora", () => {
    renderCard({ ...CONFIRMED, confirmedByName: null, confirmedAt: null });

    expect(
      screen.getByText(
        "Entregue por Ana Teste às 14:05. Confirmada por outra pessoa.",
      ),
    ).toBeInTheDocument();
  });

  it.each([
    ["start", START],
    ["continue", CONTINUE],
    ["delivered", DELIVERED],
    ["confirmed", CONFIRMED],
    ["no-shifts", NO_SHIFTS],
  ] as const)("estado %s tem o link secundário 'Ver todas as passagens'", (_name, state) => {
    renderCard(state);

    expect(
      screen.getByRole("link", { name: "Ver todas as passagens" }),
    ).toHaveAttribute("href", "/passagens");
  });

  it("primário on-pastel com 22px de padding; secundário com 20px (protótipo)", () => {
    renderCard(START);

    expect(screen.getByRole("link", { name: "Começar passagem" })).toHaveClass(
      "bg-on-pastel",
      "px-[22px]",
    );
    const secondary = screen.getByRole("link", {
      name: "Ver todas as passagens",
    });
    expect(secondary).toHaveClass("bg-on-pastel-secondary", "px-5");
    expect(secondary).not.toHaveClass("px-[22px]");
  });

  it("sem turnos, operador: pede ao administrador, sem horário, sem barra e sem 'Ir para Turnos'", () => {
    renderCard(NO_SHIFTS);

    expect(screen.getByText("Nenhum turno neste setor.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Peça a um administrador para cadastrar os turnos do setor.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ir para Turnos" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText(/\d\d:\d\d–\d\d:\d\d/)).not.toBeInTheDocument();
  });

  it("sem turnos, admin: texto próprio e 'Ir para Turnos' do setor", () => {
    renderCard(NO_SHIFTS, { canManageCatalog: true });

    expect(
      screen.getByText("Cadastre os turnos do setor para começar a passagem."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para Turnos" }),
    ).toHaveAttribute("href", `/admin/turnos?setor=${SECTOR_ID}`);
  });

  it("sem turnos mantém a cor do setor e o chip", () => {
    const { container } = renderCard(NO_SHIFTS, { sectorColor: "green" });

    expect(cardOf(container)).toHaveClass(SECTOR_COLOR_BG.green);
    expect(screen.getByText("ULD")).toBeInTheDocument();
  });

  it("usa só tokens de cor (sem hex nem classe crua do Tailwind)", () => {
    for (const state of [START, CONTINUE, DELIVERED, CONFIRMED, NO_SHIFTS]) {
      const { container, unmount } = renderCard(state, { avatarSrc: AVATAR });

      expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(container.innerHTML).not.toMatch(
        /\b(?:bg|text|border)-(?:red|green|blue|yellow|amber|orange|gray|slate|zinc)-\d+/,
      );
      unmount();
    }
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `bunx vitest run src/components/passagens/MyShiftCard.test.tsx`
Expected: FAIL (por exemplo "Unable to find an accessible element with the role "progressbar"" e `expected ... to have class "bg-sector-peach"`)

- [ ] **Step 7: Implementar o `MyShiftCard`**

Substitua o arquivo inteiro `src/components/passagens/MyShiftCard.tsx` por:

```tsx
import { cn } from "cn";
import { ArrowRight, CircleCheck, Clock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { UserAvatar } from "@/components/app-shell/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MyShiftState } from "@/features/handovers/home";
import { formatDateBR, formatTimeBR } from "@/features/handovers/saoPaulo";
import { handoverHref, newHandoverHref } from "@/features/handovers/urls";
import { SECTOR_COLOR_BG, type SectorColor } from "@/features/sectors/colors";

import { ShiftProgressBar } from "./ShiftProgressBar";

// Protótipo: o primário dentro do card colorido tem 22px de padding (o do
// `pill`); o secundário, 20px (o `cn` troca o `px-[22px]` pelo `px-5`).
const PRIMARY = buttonVariants({ variant: "on-pastel", size: "pill" });
const SECONDARY = cn(
  buttonVariants({ variant: "on-pastel-secondary", size: "pill" }),
  "px-5",
);

// Os selos do cartão de turno são maiores que o `md` do Badge (protótipo):
// 28px de altura, 12px de padding, 13px/600, ícone de 14px e gap de 6px.
const STATE_BADGE = "h-7 gap-1.5 px-3 text-[13px] [&>svg]:size-3.5!";

// 64px; 52px quando o cartão divide a linha com Solicitações e a área útil é
// menor que 1240px (container query do contêiner principal); 44px no celular.
const TIME_CLASS =
  "font-heading text-[64px] leading-none font-black tracking-[-0.035em] tabular-nums max-md:text-[44px] @min-[1040px]/main:@max-[1239px]/main:text-[52px]";

function Shell({
  color,
  sectorName,
  children,
}: {
  color: SectorColor;
  sectorName: string;
  children: ReactNode;
}) {
  return (
    <Card
      variant="feature"
      className={cn(
        "gap-[22px] text-on-pastel transition-colors duration-[450ms] motion-reduce:transition-none",
        SECTOR_COLOR_BG[color],
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 font-heading text-lg font-bold">
          Passagem do meu turno
        </h2>
        <span
          title={sectorName}
          className="h-7 max-w-[55%] min-w-0 truncate rounded-full bg-on-pastel px-3 font-mono text-xs leading-7 font-medium tracking-[.04em] whitespace-nowrap text-on-pastel-ink"
        >
          {sectorName}
        </span>
      </div>
      {children}
    </Card>
  );
}

function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={PRIMARY}>
      {children}
      <ArrowRight aria-hidden="true" strokeWidth={2.2} />
    </Link>
  );
}

function Actions({ primary }: { primary: ReactNode }) {
  return (
    <div className="mt-auto flex flex-wrap gap-2.5">
      {primary}
      <Link href="/passagens" className={SECONDARY}>
        Ver todas as passagens
      </Link>
    </div>
  );
}

export function MyShiftCard({
  state,
  sectorId,
  sectorName,
  sectorColor,
  canManageCatalog,
  sectorParam,
  avatarSrc = null,
}: {
  state: MyShiftState;
  sectorId: string;
  sectorName: string;
  sectorColor: SectorColor;
  canManageCatalog: boolean;
  sectorParam: string | null;
  // Avatar de quem salvou o rascunho (estado `continue`).
  avatarSrc?: string | null;
}) {
  if (state.kind === "no-shifts") {
    return (
      <Shell color={sectorColor} sectorName={sectorName}>
        <div className="flex flex-col gap-1.5">
          <p className="font-heading text-[32px] leading-[1.05] font-black tracking-[-0.02em]">
            Nenhum turno neste setor.
          </p>
          <p className="text-[15px] text-on-pastel-muted">
            {canManageCatalog
              ? "Cadastre os turnos do setor para começar a passagem."
              : "Peça a um administrador para cadastrar os turnos do setor."}
          </p>
        </div>
        <Actions
          primary={
            canManageCatalog ? (
              <PrimaryLink href={`/admin/turnos?setor=${sectorId}`}>
                Ir para Turnos
              </PrimaryLink>
            ) : null
          }
        />
      </Shell>
    );
  }

  const { shift, ref } = state;
  const newHref = newHandoverHref(ref, sectorParam ?? undefined);

  return (
    <Shell color={sectorColor} sectorName={sectorName}>
      <div className="flex flex-col gap-1.5">
        <span className="font-heading text-xl font-bold break-words">
          {shift.name}
        </span>
        <span className={TIME_CLASS}>
          {shift.startsAt}–{shift.endsAt}
        </span>
        <span className="mt-1 font-mono text-sm font-medium text-on-pastel-muted">
          {formatDateBR(ref.operationalDate)}
        </span>
      </div>

      {(state.kind === "start" || state.kind === "continue") && (
        <div className="flex flex-col gap-2">
          <ShiftProgressBar progress={state.progress} />
          <p className="mt-0.5 text-[15px] text-on-pastel-muted">
            Turno sugerido pelo horário de agora.
          </p>
        </div>
      )}

      {state.kind === "continue" && state.saved && (
        <div className="flex w-fit max-w-full items-center gap-2.5 rounded-[18px] bg-on-pastel-soft py-2.5 pr-3.5 pl-2.5">
          {avatarSrc !== null && (
            <UserAvatar src={avatarSrc} size={34} tilt={-3} frame="on-pastel" />
          )}
          <span className="text-[15px]">
            Rascunho salvo às {formatTimeBR(state.saved.at)} por{" "}
            {state.saved.byName}
          </span>
        </div>
      )}

      {state.kind === "delivered" && (
        <div className="flex flex-col items-start gap-3">
          <Badge variant="pastel-pending" size="md" className={STATE_BADGE}>
            <Clock aria-hidden="true" strokeWidth={2.2} />
            Aguardando recebimento
          </Badge>
          <p className="text-[15px] leading-normal">
            Entregue às {formatTimeBR(state.deliveredAt)} por{" "}
            {state.deliveredByName}. Aguardando recebimento.
          </p>
        </div>
      )}

      {state.kind === "confirmed" && (
        <div className="flex flex-col items-start gap-3">
          <Badge variant="pastel-confirmed" size="md" className={STATE_BADGE}>
            <CircleCheck aria-hidden="true" strokeWidth={2.2} />
            Confirmada
          </Badge>
          <p className="text-[15px] leading-normal">
            Entregue por {state.deliveredByName} às{" "}
            {formatTimeBR(state.deliveredAt)}. Confirmada por{" "}
            {state.confirmedByName ?? "outra pessoa"}
            {state.confirmedAt ? ` às ${formatTimeBR(state.confirmedAt)}` : ""}.
          </p>
        </div>
      )}

      <Actions
        primary={
          state.kind === "start" ? (
            <PrimaryLink href={newHref}>Começar passagem</PrimaryLink>
          ) : state.kind === "continue" ? (
            <PrimaryLink href={newHref}>Continuar passagem</PrimaryLink>
          ) : (
            <PrimaryLink href={handoverHref(state.handoverId)}>
              Ver passagem
            </PrimaryLink>
          )
        }
      />
    </Shell>
  );
}
```

- [ ] **Step 8: Passar as props novas no `HomeHandovers`**

Em `src/components/passagens/HomeHandovers.tsx` (versão da Task 11, que já importa `avatarDataUri` de `@/lib/avatar` para o pendente: nenhum import novo), troque o JSX do cartão de turno, dentro do `<div data-slot="home-cards" ...>`. Edit com o texto exato da Task 11:

Antes:

```tsx
        <MyShiftCard
          state={home.mine}
          sectorId={home.sector.id}
          canManageCatalog={actor.role === "admin"}
          sectorParam={sectorParam}
        />
```

Depois:

```tsx
        <MyShiftCard
          state={home.mine}
          sectorId={home.sector.id}
          sectorName={home.sector.name}
          sectorColor={home.sector.color}
          canManageCatalog={actor.role === "admin"}
          sectorParam={sectorParam}
          avatarSrc={
            home.mine.kind === "continue" && home.mine.saved
              ? avatarDataUri(home.mine.saved.byId)
              : null
          }
        />
```

- [ ] **Step 9: Testes do `HomeHandovers` (mock do avatar e 2 testes)**

Em `src/components/passagens/HomeHandovers.test.tsx`:

1. Logo depois de `vi.mock("@/app/(app)/actions", () => ({ chooseSectorAction: vi.fn() }));` acrescente:

```tsx
vi.mock("@/lib/avatar", () => ({
  avatarDataUri: (seed: string) => `data:image/svg+xml,${seed}`,
}));
```

2. Antes do teste `it("rascunho existente vira 'Continuar passagem'", ...)` acrescente:

```tsx
  it("o cartão do turno leva o nome e a cor do setor", async () => {
    const carga = await insertSector(db, "Carga", { color: "peach" });
    await insertShift(db, { sectorId: carga.id });
    const ana = await insertUser(db, { role: "operator", sectorId: carga.id });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: carga.id }),
    );

    await renderHome();

    const card = screen
      .getByRole("heading", { name: "Passagem do meu turno" })
      .closest('[data-slot="card"]');
    expect(card).toHaveClass("bg-sector-peach");
    expect(
      within(card as HTMLElement).getByText("Carga"),
    ).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("rascunho: o avatar de quem salvou usa o id dessa pessoa como semente", async () => {
    const { uld, shiftRow, ana } = await setup();
    await insertHandover(db, {
      sectorId: uld.id,
      shiftId: shiftRow.id,
      operationalDate: TODAY,
      updatedBy: ana.id,
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
    );

    await renderHome();

    const card = screen
      .getByRole("heading", { name: "Passagem do meu turno" })
      .closest('[data-slot="card"]');
    expect(card?.querySelector("img")).toHaveAttribute(
      "src",
      `data:image/svg+xml,${ana.id}`,
    );
  });
```

- [ ] **Step 10: Rodar e ver passar**

Run: `bunx vitest run src/components/passagens/ShiftProgressBar.test.tsx src/components/passagens/MyShiftCard.test.tsx src/components/passagens/HomeHandovers.test.tsx`
Expected: PASS (todos os arquivos; o `HomeHandovers.test.tsx` ainda tem os textos "N abertas · M paradas" do cartão de solicitações antigo, que a Task 13 troca, então nesta task eles continuam verdes porque o `RequestsHomeCard` só muda na Task 13)

Testes existentes que mencionam os componentes tocados (`grep -rl "MyShiftCard\|ShiftProgressBar" src test e2e`): só `MyShiftCard.test.tsx` (reescrito no Step 5), `HomeHandovers.test.tsx` (Step 9) e o `uiRegistryDoc.test.ts` (Step 11).

- [ ] **Step 11: Atualizar `.context/ui-registry.md`**

a) Entrada nova `ShiftProgressBar`, logo antes de `### HomeHandovers`. Edit em `.context/ui-registry.md`:

old_string:
```
### HomeHandovers
- **Status:** ✅ pronto (2026-11-21)
```
new_string:
```
### ShiftProgressBar
- **Status:** ✅ pronto (2026-11-27)
- **Local:** `src/components/passagens/ShiftProgressBar.tsx` (server-safe)
- **Propósito:** barra de quanto do turno já passou, nos estados `start` e `continue` do `MyShiftCard`.
- **Como funciona:** recebe o `ShiftProgress` já calculado no servidor (`shiftProgress`). Trilho de 10 px (`bg-on-pastel-track`) com o preenchimento `bg-on-pastel` na largura `pct` (presa entre 0 e 100; `NaN` vira 0); abaixo, em Geist Mono 12 px com `tabular-nums`: início · "agora HH:MM" · fim. O trilho é uma `progressbar` (`aria-label` "Progresso do turno", `aria-valuenow` arredondado e `aria-valuetext`).
- **Usa:** tokens `on-pastel`, `on-pastel-track`, `on-pastel-muted`; tipo `ShiftProgress`.
- **Histórico:** 2026-11-27 — criado no visual novo do Início (Task 12).

### HomeHandovers
- **Status:** ✅ pronto (2026-11-21)
```

b) `MyShiftCard`: substitua o bloco "Como funciona … Histórico" por (Edit com `old_string` = as três linhas atuais, que começam em `- **Como funciona:** Server-safe. Mostra \`{turno} · {início}–{fim} · {data}\``):

new_string:
```
- **Como funciona:** Server-safe. `Card variant="feature"` na cor do setor (`SECTOR_COLOR_BG[sectorColor]`; crossfade de .45 s, desligado com `prefers-reduced-motion`) e tinta `text-on-pastel`. Topo: `<h2>` "Passagem do meu turno" e o chip do setor (`sectorName`, Geist Mono 12 px, reticências se longo). Corpo: nome do turno (Satoshi 700, 20 px), horário `{início}–{fim}` (Satoshi 900, `tabular-nums`, 64 px; 52 px em 2 colunas com área útil < 1240 px e 44 px no celular, por container query de `@container/main`) e a data em mono. `start`/`continue`: `ShiftProgressBar` e "Turno sugerido pelo horário de agora.". `start` → "Começar passagem"; `continue` → pílula `bg-on-pastel-soft` com `UserAvatar` de 34 px (`avatarSrc`, de quem salvou) e "Rascunho salvo às … por …" + "Continuar passagem"; os selos pastel ficam no tamanho do protótipo (`h-7 px-3 text-[13px]`, ícone de 14px, por `className` sobre o `size="md"`); `delivered` → `Badge pastel-pending` (`Clock`) "Aguardando recebimento" e "Entregue às … Aguardando recebimento." + "Ver passagem"; `confirmed` → `Badge pastel-confirmed` (`CircleCheck`) "Confirmada" e "Entregue por … Confirmada por …" + "Ver passagem"; `no-shifts` → "Nenhum turno neste setor." (Satoshi 900, 32 px) e, só para o admin, "Ir para Turnos". Rodapé (`mt-auto`): o primário (`on-pastel`, `pill`, 22px de padding, com `ArrowRight`) e o secundário "Ver todas as passagens" (`on-pastel-secondary`, `pill` com `px-5` pelo `cn`: 20px, como no protótipo), em todos os estados. Admin leva `&setor=` no link de começar.
- **Usa:** `Card`, `Badge`, `buttonVariants`, `UserAvatar`, `ShiftProgressBar`, `SECTOR_COLOR_BG`, `newHandoverHref`, `handoverHref`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 7). 2026-11-27 — visual novo do Início (Task 12): cor do setor, chip, horário grande, barra do turno, avatar do rascunho, selos pastel e rodapé com secundário; props novas `sectorName`, `sectorColor` e `avatarSrc`; o `no-shifts` passou a ter o link "Ver todas as passagens".
```

c) `HomeHandovers`, Histórico: Edit com `old_string` `2026-11-25 — Fase 5 (Tarefa 1, P48): a resolução do setor vem de \`resolveScreenSector\` (sem mudar o comportamento).` e `new_string` o mesmo texto seguido de ` 2026-11-27 — visual novo do Início (Task 12): passa \`sectorName\`, \`sectorColor\` e o avatar do rascunho ao \`MyShiftCard\`.`

- [ ] **Step 12: Conferir tipos, lint e o guarda do registro**

Run: `bun run check-types && bun run lint && bunx vitest run test/uiRegistryDoc.test.ts`
Expected: tipos e Biome sem erros (se o Biome reclamar da ordem dos imports, rode `bun run format` e confira o `git diff`); `uiRegistryDoc` PASS (menciona `ShiftProgressBar`).

- [ ] **Step 13: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/visual/msg-task-12.txt`:

```
feat(inicio): cartão do meu turno nos 5 estados com barra de progresso

O MyShiftCard ganha a cor do setor com crossfade, o chip do setor, o
horário grande com container queries, a ShiftProgressBar (start e
continue), o avatar do rascunho, os selos pastel e o rodapé com o
secundário "Ver todas as passagens" em todos os estados.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Run: `git add src/components/passagens/ShiftProgressBar.tsx src/components/passagens/ShiftProgressBar.test.tsx src/components/passagens/MyShiftCard.tsx src/components/passagens/MyShiftCard.test.tsx src/components/passagens/HomeHandovers.tsx src/components/passagens/HomeHandovers.test.tsx .context/ui-registry.md && git commit -F .git/sdd/visual/msg-task-12.txt`

---

### Task 13: Cartão "Solicitações" (`RequestsHomeCard`, `OpenRequestItem`, selos)

**Outros usos que mudam junto (leia antes de editar).** O visual dos selos é compartilhado:

| Arquivo | Usa | Efeito da mudança |
|---|---|---|
| `statusStyle.ts` | define `badgeClass`/`buttonClass` | Solicitada passa a neutro (`bg-accent text-foreground`), Em separação / Trânsito a `info`, Cancelada a `bg-accent text-muted-foreground` |
| `MoveStatusButton.tsx` | `buttonClass` do status de destino | botão "Mover para Solicitada" fica neutro; "Mover para Em separação / Trânsito" fica azul |
| `RequestGroupSection.tsx`, `RequestTimeline.tsx` | `badgeClass` cru | mesmas cores novas |
| `RequestCard.tsx`, `RequestListRow.tsx`, `RequestTable.tsx`, `RequestDetail.tsx` | `RequestStatusBadge`, `StaleBadge` | forma (pílula, h-6, nowrap) e as cores novas |
| `OpenRequestsNowSection.tsx`, `OpenRequestsAtDeliverySection.tsx` | `OpenRequestItem` | a linha vira clicável inteira, com chevron; o `divide-y` da `<ul>` sai (a `<li>` carrega a divisória) |

Todo status continua legível: ícone + texto sempre; Solicitada (neutro) e Cancelada (neutro, texto atenuado) se distinguem pelo ícone e pelo rótulo. O `bg-muted` antigo da Cancelada sumiria no card (no tema novo `--muted` = `--card`), por isso ela passa a `bg-accent`.

**Files:**
- Modify: `src/components/solicitacoes/statusStyle.ts`
- Modify: `src/components/solicitacoes/RequestStatusBadge.tsx`
- Modify: `src/components/solicitacoes/StaleBadge.tsx`
- Modify: `src/components/solicitacoes/OpenRequestItem.tsx`
- Modify: `src/components/solicitacoes/RequestsHomeCard.tsx`
- Modify: `src/components/solicitacoes/OpenRequestsNowSection.tsx` e `src/components/solicitacoes/OpenRequestsAtDeliverySection.tsx` (sem `divide-y`)
- Modify: `src/components/passagens/HomeHandovers.tsx` (passa `avatarSrc` ao `RequestsHomeCard`)
- Test: `RequestStatusBadge.test.tsx`, `StaleBadge.test.tsx`, `OpenRequestItem.test.tsx`, `RequestsHomeCard.test.tsx` (reescritos); `MoveStatusButton.test.tsx` e `RequestStatusActions.test.tsx` (1 linha cada); `src/components/passagens/HomeHandovers.test.tsx` (assertivas do contador)
- Modify: `.context/ui-registry.md`

**Interfaces:**
- Consumes: `Card variant="feature"`, `Badge` (`variant: "secondary" | "warning"`, `size: "md"`), `buttonVariants({ variant: "default", size: "pill" })`, `UserAvatar`, `avatarDataUri`, `staleCountLabel`.
- Produces:
  - `RequestsHomeCard({ home, allHref, avatarSrc, firstAccess = false }: { home: HomeRequests; allHref: string; avatarSrc: string; firstAccess?: boolean })`
  - `OpenRequestItem` com a mesma assinatura (`{ request, statusNow? }`); a linha tem `data-slot="open-request-row"` (o guarda de toque mede por ele na Task 14).
  - `REQUEST_STATUS_STYLE` com a mesma forma `{ icon, badgeClass, buttonClass }`.

- [ ] **Step 1: Reescrever os testes dos selos (falham)**

Substitua `src/components/solicitacoes/RequestStatusBadge.test.tsx` por:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { REQUEST_STATUSES } from "@/lib/requestStatuses";
import { RequestStatusBadge } from "./RequestStatusBadge";
import { REQUEST_STATUS_STYLE } from "./statusStyle";

describe("RequestStatusBadge", () => {
  it.each([
    ["requested", "Solicitada", "bg-accent", "text-foreground"],
    [
      "in_transit",
      "Em separação / Trânsito",
      "bg-info",
      "text-info-foreground",
    ],
    ["delivered", "Entregue", "bg-success", "text-success-foreground"],
    ["cancelled", "Cancelada", "bg-accent", "text-muted-foreground"],
  ] as const)("%s mostra ícone e texto e a classe do token certo", (status, text, background, foreground) => {
    const { container } = render(<RequestStatusBadge status={status} />);

    const badge = screen.getByText(text);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass(background, foreground);
    // Nunca só cor: o ícone vem junto e é decorativo.
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("é pílula de 24px e nunca quebra linha, mesmo com o rótulo mais longo", () => {
    render(<RequestStatusBadge status="in_transit" />);

    expect(screen.getByText("Em separação / Trânsito")).toHaveClass(
      "h-6",
      "rounded-full",
      "whitespace-nowrap",
    );
  });

  it("cada status tem um ícone diferente", () => {
    const icons = REQUEST_STATUSES.map(
      (status) => REQUEST_STATUS_STYLE[status].icon,
    );

    expect(new Set(icons).size).toBe(REQUEST_STATUSES.length);
  });

  it("o botão do status de destino usa a mesma cor do selo, com o hover do token", () => {
    expect(REQUEST_STATUS_STYLE.requested.buttonClass).toBe(
      "bg-accent text-foreground border-transparent hover:bg-accent/80",
    );
    expect(REQUEST_STATUS_STYLE.in_transit.buttonClass).toBe(
      "bg-info text-info-foreground border-transparent hover:bg-info/80",
    );
    expect(REQUEST_STATUS_STYLE.delivered.buttonClass).toBe(
      "bg-success text-success-foreground border-transparent hover:bg-success/80",
    );
    for (const status of REQUEST_STATUSES) {
      expect(
        REQUEST_STATUS_STYLE[status].buttonClass.startsWith(
          REQUEST_STATUS_STYLE[status].badgeClass,
        ),
      ).toBe(true);
    }
  });

  it("nenhum status usa o fundo do próprio card (bg-muted some no tema novo, onde muted = card)", () => {
    for (const status of REQUEST_STATUSES) {
      expect(REQUEST_STATUS_STYLE[status].badgeClass).not.toMatch(
        /\bbg-(?:muted|card|background)\b/,
      );
    }
  });

  it("usa só tokens de cor (sem classe crua do Tailwind nem hex)", () => {
    for (const status of REQUEST_STATUSES) {
      const { container, unmount } = render(
        <RequestStatusBadge status={status} />,
      );
      const style = REQUEST_STATUS_STYLE[status];

      for (const text of [
        container.innerHTML,
        style.badgeClass,
        style.buttonClass,
      ]) {
        expect(text).not.toMatch(
          /\b(?:bg|text|border)-(?:red|green|blue|yellow|amber|orange|gray|slate|zinc)-\d+/,
        );
        expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      }
      unmount();
    }
  });
});
```

Substitua `src/components/solicitacoes/StaleBadge.test.tsx` por:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StaleBadge } from "./StaleBadge";

describe("StaleBadge", () => {
  it("plural: 'Parada há 5 dias', com ícone e a cor do token warning", () => {
    const { container } = render(<StaleBadge days={5} />);

    const badge = screen.getByText("Parada há 5 dias");
    expect(badge).toHaveClass("bg-warning", "text-warning-foreground");
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("é pílula de 24px e nunca quebra linha", () => {
    render(<StaleBadge days={12} />);

    expect(screen.getByText("Parada há 12 dias")).toHaveClass(
      "h-6",
      "rounded-full",
      "whitespace-nowrap",
    );
  });

  it("singular: 'Parada há 1 dia'", () => {
    render(<StaleBadge days={1} />);

    expect(screen.getByText("Parada há 1 dia")).toBeInTheDocument();
  });

  it("zero dias (parada por horas, ainda no 1º dia completo): 'Parada há 0 dias'", () => {
    render(<StaleBadge days={0} />);

    expect(screen.getByText("Parada há 0 dias")).toBeInTheDocument();
  });

  it("usa só tokens de cor", () => {
    const { container } = render(<StaleBadge days={3} />);

    expect(container.innerHTML).not.toMatch(
      /\b(?:bg|text|border)-(?:red|green|blue|yellow|amber|orange|gray|slate|zinc)-\d+/,
    );
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
```

- [ ] **Step 2: Testes de `OpenRequestItem` e do cartão (falham)**

Em `src/components/solicitacoes/OpenRequestItem.test.tsx`, mantenha os 7 testes existentes e acrescente, antes do `});` final do `describe`:

```tsx
  it("a linha inteira é clicável: o link é esticado (after:inset-0) e a linha mede 18px de raio", () => {
    const { container } = render(
      <ul>
        <OpenRequestItem request={openRequest()} />
      </ul>,
    );

    const row = container.querySelector('[data-slot="open-request-row"]');
    expect(row).toHaveClass("relative", "rounded-[18px]", "hover:bg-accent");
    expect(screen.getByRole("link")).toHaveClass(
      "after:absolute",
      "after:inset-0",
    );
    expect(container.querySelector("li")).toHaveClass("border-t");
  });

  it("o link mantém scroll={false} para abrir o detalhe rápido (href do detalhe, sem ?comentarios)", () => {
    renderItem({
      request: openRequest({ id: "22222222-2222-4222-8222-222222222222" }),
    });

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/solicitacoes/22222222-2222-4222-8222-222222222222",
    );
  });

  it("fecha com o chevron decorativo", () => {
    const { container } = render(
      <ul>
        <OpenRequestItem request={openRequest()} />
      </ul>,
    );

    const chevron = container.querySelector("svg.lucide-chevron-right");
    expect(chevron).not.toBeNull();
    expect(chevron).toHaveAttribute("aria-hidden", "true");
  });

  it("Solicitada usa o selo neutro e Em separação / Trânsito o azul, ambos com ícone", () => {
    const { container, rerender } = render(
      <ul>
        <OpenRequestItem request={openRequest({ status: "requested" })} />
      </ul>,
    );
    expect(screen.getByText("Solicitada")).toHaveClass("bg-accent");

    rerender(
      <ul>
        <OpenRequestItem request={openRequest({ status: "in_transit" })} />
      </ul>,
    );
    expect(screen.getByText("Em separação / Trânsito")).toHaveClass("bg-info");
    expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);
  });

  it("nome de destino longo não estoura a linha (min-w-0 e quebra)", () => {
    const { container } = render(
      <ul>
        <OpenRequestItem
          request={openRequest({
            description: "x".repeat(60),
            destinationName: "Terminal ".repeat(20).trim(),
          })}
        />
      </ul>,
    );

    expect(
      container.querySelector('[data-slot="open-request-row"] > div'),
    ).toHaveClass("min-w-0", "flex-1");
  });
```

Substitua `src/components/solicitacoes/RequestsHomeCard.test.tsx` por:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { HomeRequests } from "@/features/requests/types";
import { openRequest } from "../../../test/openRequests";
import { RequestsHomeCard } from "./RequestsHomeCard";

const AVATAR = "data:image/svg+xml,logado";
const FIRST_ACCESS_LINE =
  "Os pedidos da equipe aparecem aqui assim que alguém registrar o primeiro.";

function home(overrides: Partial<HomeRequests> = {}): HomeRequests {
  return { openCount: 0, staleCount: 0, stale: [], ...overrides };
}

function renderCard(
  props: Partial<Parameters<typeof RequestsHomeCard>[0]> = {},
) {
  return render(
    <RequestsHomeCard
      home={home()}
      allHref="/solicitacoes"
      avatarSrc={AVATAR}
      {...props}
    />,
  );
}

describe("RequestsHomeCard", () => {
  it("o título é um h2 'Solicitações' num card feature", () => {
    const { container } = renderCard();

    expect(
      screen.getByRole("heading", { level: 2, name: "Solicitações" }),
    ).toBeInTheDocument();
    expect(container.querySelector('[data-slot="card"]')).toHaveClass(
      "bg-card",
    );
  });

  it("sem abertas: avatar de quem está logado, 'Nenhuma solicitação aberta.' e o link", () => {
    const { container } = renderCard();

    expect(screen.getByText("Nenhuma solicitação aberta.")).toBeInTheDocument();
    const avatar = container.querySelector("img");
    expect(avatar).toHaveAttribute("src", AVATAR);
    expect(avatar).toHaveAttribute("alt", "");
    expect(screen.queryByText("abertas")).not.toBeInTheDocument();
    expect(screen.queryByText("Paradas há mais tempo")).not.toBeInTheDocument();
    expect(screen.queryByText(FIRST_ACCESS_LINE)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver solicitações" }),
    ).toHaveAttribute("href", "/solicitacoes");
  });

  it("sem abertas no primeiro acesso do admin: acrescenta a linha de apoio", () => {
    renderCard({ firstAccess: true });

    expect(screen.getByText(FIRST_ACCESS_LINE)).toBeInTheDocument();
  });

  it("com abertas, a linha de apoio do primeiro acesso nunca aparece", () => {
    renderCard({ firstAccess: true, home: home({ openCount: 2 }) });

    expect(screen.queryByText(FIRST_ACCESS_LINE)).not.toBeInTheDocument();
  });

  it("singular: '1' e 'aberta', sem selo de paradas e sem a lista", () => {
    renderCard({ home: home({ openCount: 1, staleCount: 0 }) });

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("aberta")).toBeInTheDocument();
    expect(screen.queryByText(/\bparadas?\b/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("plural: '7', 'abertas', selo '2 paradas' e as paradas listadas com link", () => {
    renderCard({
      home: home({
        openCount: 7,
        staleCount: 2,
        stale: [
          openRequest({
            description: "Mais antiga",
            stale: true,
            daysInStatus: 6,
          }),
          openRequest({ description: "Parada", stale: true, daysInStatus: 4 }),
        ],
      }),
    });

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("abertas")).toBeInTheDocument();
    expect(screen.getByText("2 paradas")).toHaveClass(
      "bg-warning",
      "text-warning-foreground",
      "whitespace-nowrap",
      "h-6",
      "text-[12.5px]",
    );
    expect(screen.getByText("Paradas há mais tempo")).toBeInTheDocument();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Mais antiga");
    expect(items[0]).toHaveTextContent("Parada há 6 dias");
    expect(
      within(items[1] as HTMLElement).getByRole("link", { name: "Parada" }),
    ).toHaveAttribute("href", expect.stringMatching(/^\/solicitacoes\/.+/));
  });

  it("uma parada: '3' 'abertas' e selo '1 parada'", () => {
    renderCard({
      home: home({
        openCount: 3,
        staleCount: 1,
        stale: [openRequest({ stale: true, daysInStatus: 3 })],
      }),
    });

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("abertas")).toBeInTheDocument();
    expect(screen.getByText("1 parada")).toBeInTheDocument();
  });

  it("contagem alta (1234) aparece inteira, com tabular-nums e os tamanhos 76/60/52", () => {
    renderCard({ home: home({ openCount: 1234, staleCount: 0 }) });

    expect(screen.getByText("1234")).toHaveClass(
      "tabular-nums",
      "font-black",
      "text-[76px]",
      "max-md:text-[52px]",
      "@min-[1040px]/main:@max-[1239px]/main:text-[60px]",
    );
  });

  it("zero abertas mas com lista vazia não mostra contador", () => {
    renderCard({ home: home({ openCount: 0 }) });

    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("o link usa o allHref (admin leva ?setor=) e é um botão pill primário", () => {
    renderCard({ allHref: "/solicitacoes?setor=abc" });

    const link = screen.getByRole("link", { name: "Ver solicitações" });
    expect(link).toHaveAttribute("href", "/solicitacoes?setor=abc");
    expect(within(link).queryByText("Ver solicitações")).toBeNull();
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    // `default` + `pill` com os 20px do protótipo (não os 22px dos primários on-pastel).
    expect(link).toHaveClass("bg-primary", "h-12", "px-5", "mt-auto", "w-fit");
    expect(link).not.toHaveClass("px-[22px]");
  });
});
```

- [ ] **Step 3: Ajustar as duas linhas dos outros testes de cor**

`src/components/solicitacoes/MoveStatusButton.test.tsx`, no `it.each`:

old:
```
    ["in_transit", "Mover para Em separação / Trânsito", "bg-warning"],
    ["delivered", "Mover para Entregue", "bg-success"],
    ["requested", "Mover para Solicitada", "bg-info"],
```
new:
```
    ["in_transit", "Mover para Em separação / Trânsito", "bg-info"],
    ["delivered", "Mover para Entregue", "bg-success"],
    ["requested", "Mover para Solicitada", "bg-accent"],
```

`src/components/solicitacoes/RequestStatusActions.test.tsx`, no teste "cada botão tem a cor do status de destino": troque `).toContain("bg-warning");` por `).toContain("bg-info");` (é o botão "Mover para Em separação / Trânsito").

- [ ] **Step 4: Rodar e ver falhar**

Run: `bunx vitest run src/components/solicitacoes/RequestStatusBadge.test.tsx src/components/solicitacoes/StaleBadge.test.tsx src/components/solicitacoes/OpenRequestItem.test.tsx src/components/solicitacoes/RequestsHomeCard.test.tsx src/components/solicitacoes/MoveStatusButton.test.tsx src/components/solicitacoes/RequestStatusActions.test.tsx`
Expected: FAIL (por exemplo `expected ... to have class "bg-accent"`, `Unable to find an element with the text: 7` e `avatarSrc`/`firstAccess` desconhecidos)

- [ ] **Step 5: Implementar os selos e o `statusStyle`**

Em `src/components/solicitacoes/statusStyle.ts` troque só o objeto `REQUEST_STATUS_STYLE` (os imports e o comentário ficam) por:

```ts
export const REQUEST_STATUS_STYLE: Readonly<
  Record<
    RequestStatus,
    { icon: LucideIcon; badgeClass: string; buttonClass: string }
  >
> = {
  requested: {
    icon: CircleDot,
    badgeClass: "bg-accent text-foreground",
    buttonClass:
      "bg-accent text-foreground border-transparent hover:bg-accent/80",
  },
  in_transit: {
    icon: Truck,
    badgeClass: "bg-info text-info-foreground",
    buttonClass:
      "bg-info text-info-foreground border-transparent hover:bg-info/80",
  },
  delivered: {
    icon: CircleCheck,
    badgeClass: "bg-success text-success-foreground",
    buttonClass:
      "bg-success text-success-foreground border-transparent hover:bg-success/80",
  },
  cancelled: {
    icon: CircleX,
    badgeClass: "bg-accent text-muted-foreground",
    buttonClass:
      "bg-accent text-muted-foreground border-transparent hover:bg-accent/80",
  },
};
```

E acrescente, no comentário acima do objeto, a frase: `// Visual novo (2026-11-27): Solicitada é neutra e Em separação / Trânsito é azul; a parada continua em warning (StaleBadge). Cancelada usa bg-accent porque no tema novo --muted é igual a --card.`

`src/components/solicitacoes/RequestStatusBadge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { REQUEST_STATUS_LABEL } from "@/features/requests/status";
import type { RequestStatus } from "@/lib/requestStatuses";

import { REQUEST_STATUS_STYLE } from "./statusStyle";

// Status sempre com ícone e texto, nunca só cor. Pílula de 24px (size md) que
// nunca quebra linha; a cor vem do `statusStyle`.
export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const { icon: Icon, badgeClass } = REQUEST_STATUS_STYLE[status];
  return (
    <Badge variant="secondary" size="md" className={badgeClass}>
      <Icon aria-hidden="true" />
      {REQUEST_STATUS_LABEL[status]}
    </Badge>
  );
}
```

`src/components/solicitacoes/StaleBadge.tsx`:

```tsx
import { ClockAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { staleLabel } from "@/features/requests/stale";

// "Parada há N dias": ícone e texto, nunca só cor.
export function StaleBadge({ days }: { days: number }) {
  return (
    <Badge variant="warning" size="md">
      <ClockAlert aria-hidden="true" />
      {staleLabel(days)}
    </Badge>
  );
}
```

- [ ] **Step 6: Implementar `OpenRequestItem`**

`src/components/solicitacoes/OpenRequestItem.tsx`:

```tsx
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { REQUEST_STATUS_LABEL } from "@/features/requests/status";
import { requestPreview } from "@/features/requests/text";
import type { OpenRequestSummary } from "@/features/requests/types";
import { requestHref } from "@/features/requests/urls";
import type { RequestStatus } from "@/lib/requestStatuses";

import { RequestStatusBadge } from "./RequestStatusBadge";
import { StaleBadge } from "./StaleBadge";

// Uma solicitação aberta nas seções da passagem e no cartão do Início. A linha
// inteira é clicável (link esticado: o `after:inset-0` do link cobre a linha,
// então o nome acessível continua sendo só a prévia). O link abre o detalhe
// rápido (Sheet interceptado, scroll={false}); `statusNow` só vem no resumo da
// entrega e diz onde a solicitação está hoje.
export function OpenRequestItem({
  request,
  statusNow,
}: {
  request: OpenRequestSummary;
  statusNow?: RequestStatus;
}) {
  return (
    <li className="border-t border-border">
      <div
        data-slot="open-request-row"
        className="relative -mx-2.5 flex items-center gap-3 rounded-[18px] px-2.5 py-3.5 transition-colors duration-150 hover:bg-accent motion-reduce:transition-none"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Link
            href={requestHref(request.id)}
            scroll={false}
            className="text-[15px] leading-[1.3] font-semibold break-words outline-none after:absolute after:inset-0 after:rounded-[18px] focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
          >
            {requestPreview(request.description)}
          </Link>
          <p className="text-[13px] break-words text-muted-foreground">
            Para {request.destinationName}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <RequestStatusBadge status={request.status} />
            {request.stale && <StaleBadge days={request.daysInStatus} />}
            {statusNow !== undefined && statusNow !== request.status && (
              <span className="text-[13px] text-muted-foreground">
                Agora: {REQUEST_STATUS_LABEL[statusNow]}
              </span>
            )}
          </div>
        </div>
        <ChevronRight
          aria-hidden="true"
          strokeWidth={2.2}
          className="size-[18px] shrink-0 text-muted-foreground"
        />
      </div>
    </li>
  );
}
```

Nas duas seções, troque `<ul className="flex flex-col divide-y">` por `<ul className="flex flex-col">` (uma vez em `OpenRequestsNowSection.tsx` e uma em `OpenRequestsAtDeliverySection.tsx`): a divisória agora é o `border-t` de cada `<li>`.

- [ ] **Step 7: Implementar `RequestsHomeCard`**

`src/components/solicitacoes/RequestsHomeCard.tsx`:

```tsx
import { cn } from "cn";
import { ArrowRight, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { UserAvatar } from "@/components/app-shell/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { staleCountLabel } from "@/features/requests/text";
import type { HomeRequests } from "@/features/requests/types";

import { OpenRequestItem } from "./OpenRequestItem";

// Cartão "Solicitações" do Início: o contador grande de abertas, o selo de
// paradas e as paradas há mais tempo (até 5) para quem quer agir já. Vazio:
// o avatar de quem está logado e a frase; no primeiro acesso do admin, mais
// uma linha de apoio. O contador cai de 76 para 60px quando o cartão divide a
// linha com o de turno e a área útil é menor que 1240px, e para 52px no celular.
export function RequestsHomeCard({
  home,
  allHref,
  avatarSrc,
  firstAccess = false,
}: {
  home: HomeRequests;
  allHref: string;
  avatarSrc: string;
  firstAccess?: boolean;
}) {
  return (
    <Card variant="feature" className="gap-5">
      <h2 className="font-heading text-lg font-bold">Solicitações</h2>

      {home.openCount === 0 ? (
        <div className="flex flex-1 flex-col items-start justify-center gap-4 py-3">
          <UserAvatar src={avatarSrc} size={84} tilt={-5} />
          <p className="font-heading text-[28px] leading-[1.1] font-black tracking-[-0.02em]">
            Nenhuma solicitação aberta.
          </p>
          {firstAccess && (
            <p className="-mt-1.5 text-[15px] leading-normal text-pretty text-muted-foreground">
              Os pedidos da equipe aparecem aqui assim que alguém registrar o
              primeiro.
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-end gap-3.5">
          <span className="font-heading text-[76px] leading-[.85] font-black tracking-[-0.04em] tabular-nums max-md:text-[52px] @min-[1040px]/main:@max-[1239px]/main:text-[60px]">
            {home.openCount}
          </span>
          <div className="flex flex-col items-start gap-1.5 pb-0.5">
            <span className="font-heading text-lg leading-none font-bold">
              {home.openCount === 1 ? "aberta" : "abertas"}
            </span>
            {home.staleCount > 0 && (
              // Protótipo: 12.5px e gap de 5px; ícone de 12px com traço 2.4.
              <Badge
                variant="warning"
                size="md"
                className="gap-[5px] text-[12.5px]"
              >
                <TriangleAlert aria-hidden="true" strokeWidth={2.4} />
                {staleCountLabel(home.staleCount)}
              </Badge>
            )}
          </div>
        </div>
      )}

      {home.stale.length > 0 && (
        <div className="flex flex-col">
          <h3 className="mb-1 font-mono text-xs leading-none font-medium tracking-[.06em] text-muted-foreground uppercase">
            Paradas há mais tempo
          </h3>
          <ul className="flex flex-col">
            {home.stale.map((request) => (
              <OpenRequestItem key={request.id} request={request} />
            ))}
          </ul>
        </div>
      )}

      {/* 20px de padding (protótipo): o `cn` troca o `px-[22px]` do `pill`. */}
      <Link
        href={allHref}
        className={cn(
          buttonVariants({ variant: "default", size: "pill" }),
          "mt-auto w-fit px-5",
        )}
      >
        Ver solicitações
        <ArrowRight aria-hidden="true" strokeWidth={2.2} />
      </Link>
    </Card>
  );
}
```

- [ ] **Step 8: `HomeHandovers` e os testes do contador**

Em `src/components/passagens/HomeHandovers.tsx` (versão das Tasks 11 e 12; o import de `avatarDataUri` já existe) troque, dentro do `<div data-slot="home-cards" ...>`,

```tsx
        <RequestsHomeCard
          home={requests}
          allHref={requestsHref(sectorParam)}
        />
```

por

```tsx
        <RequestsHomeCard
          home={requests}
          allHref={requestsHref(sectorParam)}
          avatarSrc={avatarDataUri(actor.userId)}
        />
```

Em `src/components/passagens/HomeHandovers.test.tsx`:

1. Antes de `async function setup() {` acrescente os auxiliares:

```tsx
function requestsCard(): HTMLElement {
  const card = screen
    .getByRole("heading", { name: "Solicitações" })
    .closest('[data-slot="card"]');
  if (!(card instanceof HTMLElement)) {
    throw new Error("cartão Solicitações não encontrado");
  }
  return card;
}

// O contador e a palavra são dois elementos (o número é grande).
function expectOpenCount(count: string, word: "aberta" | "abertas") {
  const card = within(requestsCard());
  expect(card.getByText(count)).toBeInTheDocument();
  expect(card.getByText(word)).toBeInTheDocument();
}
```

2. Troque as assertivas de texto antigo (cada par abaixo é `old` → `new`):

- `      expect(screen.getByText("3 abertas · 1 parada")).toBeInTheDocument();`
  → 
```tsx
      expectOpenCount("3", "abertas");
      expect(
        within(requestsCard()).getByText("1 parada"),
      ).toBeInTheDocument();
```
- Na linha seguida de `cleanup();`: `      expect(screen.getByText("1 aberta · 0 paradas")).toBeInTheDocument();\n      cleanup();`
  →
```tsx
      expectOpenCount("1", "aberta");
      expect(
        within(requestsCard()).queryByText(/\d+ paradas?$/),
      ).not.toBeInTheDocument();
      cleanup();
```
- `      expect(screen.getByText("2 abertas · 1 parada")).toBeInTheDocument();`
  →
```tsx
      expectOpenCount("2", "abertas");
      expect(
        within(requestsCard()).getByText("1 parada"),
      ).toBeInTheDocument();
```
- `      expect(screen.getByText("7 abertas · 7 paradas")).toBeInTheDocument();`
  →
```tsx
      expectOpenCount("7", "abertas");
      expect(
        within(requestsCard()).getByText("7 paradas"),
      ).toBeInTheDocument();
```
- No teste do admin, `      await renderHome({ setor: world.uld.id });\n\n      expect(screen.getByText("1 aberta · 0 paradas")).toBeInTheDocument();`
  →
```tsx
      await renderHome({ setor: world.uld.id });

      expectOpenCount("1", "aberta");
```

3. Acrescente ao teste "sem abertas: o cartão vem depois de 'Passagem do meu turno' com o estado vazio" (depois do `expect(...getByText("Nenhuma solicitação aberta."))`):

(`<img alt="">` tem papel `presentation`, então a busca é por `querySelector`.)

```tsx
      expect(requestsCard().querySelector("img")).toHaveAttribute(
        "src",
        `data:image/svg+xml,${world.ana.id}`,
      );
```

- [ ] **Step 9: Rodar e ver passar**

Run: `bunx vitest run src/components/solicitacoes/RequestStatusBadge.test.tsx src/components/solicitacoes/StaleBadge.test.tsx src/components/solicitacoes/OpenRequestItem.test.tsx src/components/solicitacoes/RequestsHomeCard.test.tsx src/components/solicitacoes/MoveStatusButton.test.tsx src/components/solicitacoes/RequestStatusActions.test.tsx src/components/solicitacoes/OpenRequestsNowSection.test.tsx src/components/solicitacoes/OpenRequestsAtDeliverySection.test.tsx src/components/solicitacoes/RequestCard.test.tsx src/components/solicitacoes/RequestDetail.test.tsx src/components/solicitacoes/RequestTable.test.tsx src/components/solicitacoes/RequestTimeline.test.tsx src/components/solicitacoes/RequestGroupSection.test.tsx src/components/solicitacoes/RequestList.test.tsx src/components/passagens/HomeHandovers.test.tsx`
Expected: PASS em todos. Se algum teste das telas de Solicitações (Card, Table, Timeline, Detail) falhar por assertiva de classe do selo, o ajuste é só o token novo da tabela acima (mesma regra: `bg-info`↔`bg-accent` para Solicitada/Em separação).

- [ ] **Step 10: Atualizar `.context/ui-registry.md`**

Cinco Edits (cada `old_string` é a linha "Como funciona" atual, única no arquivo; inclua as linhas `Usa`/`Histórico` seguintes quando o texto abaixo disser):

a) `statusStyle`: troque a frase `Solicitada \`CircleDot\` + \`bg-info text-info-foreground\`; Em separação / Trânsito \`Truck\` + \`bg-warning text-warning-foreground\`; Entregue \`CircleCheck\` + \`bg-success text-success-foreground\`; Cancelada \`CircleX\` + \`bg-muted text-muted-foreground\`.` por `Solicitada \`CircleDot\` + \`bg-accent text-foreground\` (neutro); Em separação / Trânsito \`Truck\` + \`bg-info text-info-foreground\`; Entregue \`CircleCheck\` + \`bg-success text-success-foreground\`; Cancelada \`CircleX\` + \`bg-accent text-muted-foreground\` (\`bg-muted\` some no tema novo, onde \`--muted\` = \`--card\`).` O `Usa:` passa a `tokens \`accent\`, \`info\`, \`success\`; ícones do lucide.` O Histórico ganha ` 2026-11-27 — visual novo do Início (Task 13): Solicitada passa a neutra, Em separação / Trânsito a azul (\`info\`) e Cancelada a \`bg-accent\`; a parada continua em \`warning\`, só no \`StaleBadge\`. Vale para o botão "Mover para …", a Timeline e os grupos da Lista.`

b) `RequestStatusBadge`, "Como funciona": `<Badge variant="secondary" size="md" className="…">` (pílula de 24 px, \`whitespace-nowrap\`, vindo do \`Badge\`) com o ícone (\`aria-hidden\`) e o rótulo do \`REQUEST_STATUS_STYLE\`. Nunca só cor. Histórico ganha ` 2026-11-27 — visual novo (Task 13): pílula \`size="md"\`; as cores de Solicitada, Em separação / Trânsito e Cancelada mudam (ver \`statusStyle\`).`

c) `StaleBadge`, "Como funciona": `<Badge variant="warning" size="md">` com \`ClockAlert\` (\`aria-hidden\`) e \`staleLabel(days)\`. Quem decide se está parada é o SQL (\`stale\`). Histórico ganha ` 2026-11-27 — visual novo (Task 13): usa a variante \`warning\` e \`size="md"\` do \`Badge\` (mesma cor de antes, agora em pílula).`

d) `OpenRequestItem`, "Como funciona": `<li class="border-t">` com uma linha (\`data-slot="open-request-row"\`, raio 18, margem lateral −10 px, \`hover:bg-accent\` em 150 ms) inteira clicável: o \`<Link href={requestHref(id)} scroll={false}>\` com a prévia (\`requestPreview\`, Geist 600/15 px) é esticado por \`after:inset-0\` (o nome acessível continua sendo a prévia; o foco desenha o anel no \`::after\`). Abaixo, "Para {destino}" (13 px), \`RequestStatusBadge\`, \`StaleBadge\` e, com \`statusNow\` diferente, "Agora: {status}". Fecha com o \`ChevronRight\` de 18 px. A divisória é o \`border-t\` da \`<li>\` (as seções não usam mais \`divide-y\`). Histórico ganha ` 2026-11-27 — visual novo do Início (Task 13): linha inteira clicável com chevron; vale também para as seções da passagem.`

e) `RequestsHomeCard`: "Como funciona": `Card variant="feature"` com \`<h2>\` "Solicitações" (Satoshi 700/18 px). Com abertas: o contador \`{openCount}\` (Satoshi 900, \`tabular-nums\`, 76 px; 60 px em 2 colunas com área útil < 1240 px; 52 px no celular), ao lado "aberta"/"abertas" e o \`Badge warning\` com \`TriangleAlert\` "{n} paradas" (some sem paradas); com paradas, o \`<h3>\` "Paradas há mais tempo" (mono, caixa alta) e até 5 \`OpenRequestItem\`. Vazio: \`UserAvatar\` de 84 px (\`avatarSrc\`, quem está logado) e "Nenhuma solicitação aberta."; com \`firstAccess\`, a linha "Os pedidos da equipe aparecem aqui assim que alguém registrar o primeiro.". Rodapé: link \`default\` \`pill\` "Ver solicitações" com \`ArrowRight\` e 20px de padding (\`cn(..., "px-5")\`, como no protótipo) (\`allHref\`; o admin leva \`?setor=\`). \`Usa:\` `Card`, `Badge`, `UserAvatar`, `OpenRequestItem`, `staleCountLabel`, `buttonVariants`. Histórico ganha ` 2026-11-27 — visual novo do Início (Task 13): contador grande + selo de paradas no lugar da linha "{n abertas} · {m paradas}"; props novas \`avatarSrc\` e \`firstAccess\`.`

- [ ] **Step 11: Conferir tipos, lint e o guarda do registro**

Run: `bun run check-types && bun run lint && bunx vitest run test/uiRegistryDoc.test.ts`
Expected: tudo verde (se o Biome reclamar da ordem de imports, `bun run format`).

- [ ] **Step 12: Commit**

Write `.git/sdd/visual/msg-task-13.txt`:

```
feat(solicitacoes): cartão de solicitações e selos no visual novo

Contador grande com selo de paradas, linha de solicitação clicável
inteira com chevron, estado vazio com avatar e linha de apoio no primeiro
acesso. Solicitada passa a neutra, Em separação / Trânsito a azul e
Cancelada a bg-accent (o bg-muted some no tema novo); os selos viram
pílulas de 24px sem quebra de linha em todas as telas de Solicitações.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Run: `git add src/components/solicitacoes src/components/passagens/HomeHandovers.tsx src/components/passagens/HomeHandovers.test.tsx .context/ui-registry.md && git commit -F .git/sdd/visual/msg-task-13.txt`

---

### Task 14: `InviteTeamCard`, grid do Início (`HomeCards`) e E2E (primeiro acesso, tema, toque)

**Files:**
- Create: `src/components/app-shell/InviteTeamCard.tsx`
- Create: `src/components/app-shell/InviteTeamCard.test.tsx`
- Create: `src/components/passagens/HomeCards.tsx` (o grid dos cartões, extraído do `HomeHandovers`)
- Create: `src/components/passagens/HomeCards.test.tsx`
- Modify: `src/components/passagens/HomeHandovers.tsx` (lê contagens e cookie, delega o JSX a `HomeCards`)
- Modify: `src/components/passagens/HomeHandovers.test.tsx` (cookie de dispensa + 5 testes de primeiro acesso)
- Modify: `e2e/db.ts` (helper `isolateFirstAccess`, que devolve o `restore`)
- Create: `e2e/inicio.spec.ts`
- Modify: `e2e/touch-targets.spec.ts` (solicitação parada no Início, linha medida, teste do admin, `restore` no `afterAll`)
- Modify: `.context/ui-registry.md`

**Interfaces:**
- Consumes: `shouldShowInviteCard`, `readInviteCardDismissed` e `dismissInviteCardAction(): Promise<void>` (Task 10; a ação vai direto no `<form action>`), `getAdminOverviewCounts`/`AdminOverviewCounts`, `pluralize`, `UserAvatar`, `avatarDataUri`, `Card variant="feature"`, `Button`/`buttonVariants` (`on-pastel`, `on-pastel-secondary`, `pill`), `MyShiftCard` (Task 12), `RequestsHomeCard` (Task 13), `PendingHandoverCard({ pending, avatarSrc })` (Task 11), o `HomeHandovers` deixado pelas Tasks 11–13 (com `data-slot="home-hero-row"` e `data-slot="home-cards"`), o tipo `HomeHandovers` de `@/features/handovers/home`, tokens `bg-invite`, `text-on-invite-muted`, `text-on-invite-soft`, `border-on-pastel-line` e `border-on-pastel` com opacidade (`/40`, `/30`, `/20`, `/45`) nos tracejados.
- Produces:
  - `export type InviteCounts = Pick<AdminOverviewCounts, "sectors" | "shifts" | "items" | "destinations" | "people">`
  - `export function InviteTeamCard({ counts, avatarSrc }: { counts: InviteCounts; avatarSrc: string })`
  - `export function HomeCards(props: { home: HomeHandoversData; requests: HomeRequests; sectorParam: string | null; canManageCatalog: boolean; actorId: string; inviteCounts: InviteCounts | null; firstAccess: boolean })`. `inviteCounts` não nulo = mostrar o cartão de convite. A raiz é `<div data-slot="home-cards" className="flex flex-col gap-4">` (o ponto de extensão da Task 11).
  - `export async function isolateFirstAccess(db: Db, now?: Date): Promise<() => Promise<void>>` em `e2e/db.ts`: devolve o `restore`, que desfaz exatamente o que a chamada mudou; os specs o chamam no `test.afterAll`.

- [ ] **Step 1: Teste do `InviteTeamCard` (falha)**

Write `src/components/app-shell/InviteTeamCard.test.tsx`:

```tsx
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InviteTeamCard, type InviteCounts } from "./InviteTeamCard";

const mocks = vi.hoisted(() => ({ dismiss: vi.fn() }));

vi.mock("@/app/(app)/actions", () => ({
  dismissInviteCardAction: mocks.dismiss,
}));

const AVATAR = "data:image/svg+xml,admin";

function counts(overrides: Partial<InviteCounts> = {}): InviteCounts {
  return { sectors: 4, shifts: 12, items: 9, destinations: 5, people: 1, ...overrides };
}

function renderCard(overrides: Partial<InviteCounts> = {}) {
  return render(<InviteTeamCard counts={counts(overrides)} avatarSrc={AVATAR} />);
}

describe("InviteTeamCard", () => {
  beforeEach(() => {
    mocks.dismiss.mockReset();
    // A ação da Task 10 devolve `void` (vai direto no `<form action>`).
    mocks.dismiss.mockResolvedValue(undefined);
  });

  it("mostra o eyebrow, o título, o texto e o avatar do admin", () => {
    const { container } = renderCard();

    expect(screen.getByText("Último passo")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Convide sua equipe" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Gere um link de convite para cada pessoa. Operadores entram no setor que você escolher; administradores veem todos os setores.",
      ),
    ).toBeInTheDocument();
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("src", AVATAR);
    expect(images[0]).toHaveAttribute("alt", "");
  });

  it("'Gerar convites' leva à tela de Equipe", () => {
    renderCard();

    expect(
      screen.getByRole("link", { name: "Gerar convites" }),
    ).toHaveAttribute("href", "/admin/equipe");
  });

  it("'Agora não' é um botão que chama a ação de dispensa", async () => {
    renderCard();

    await userEvent.click(screen.getByRole("button", { name: "Agora não" }));

    await waitFor(() => expect(mocks.dismiss).toHaveBeenCalledTimes(1));
  });

  it("lista os cinco cadastros com a contagem e o plural certo", () => {
    renderCard();

    const list = within(screen.getByRole("list"));
    const rows = list.getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Feito" + "Setores" + "4 ativos",
      "Feito" + "Turnos" + "12 ativos",
      "Feito" + "Itens" + "9 ativos",
      "Feito" + "Destinos" + "5 ativos",
      "Falta fazer" + "Equipe" + "1 pessoa ativa",
    ]);
  });

  it("singular: '1 ativo'; e a Equipe nunca vem marcada como feita", () => {
    renderCard({ sectors: 1, shifts: 1, items: 1, destinations: 1, people: 1 });

    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("1 ativo");
    expect(rows[4]).toHaveAttribute("data-done", "false");
  });

  it("zero cadastros: sem 'ativos' mentirosos, o indicador fica vazio (limite)", () => {
    renderCard({ sectors: 0, shifts: 0, items: 0, destinations: 0 });

    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("0 ativos");
    expect(rows.map((row) => row.getAttribute("data-done"))).toEqual([
      "false",
      "false",
      "false",
      "false",
      "false",
    ]);
  });

  it("os quatro cadastros com dados vêm marcados; a Equipe não", () => {
    renderCard();

    expect(
      screen.getAllByRole("listitem").map((row) => row.getAttribute("data-done")),
    ).toEqual(["true", "true", "true", "true", "false"]);
  });

  it("cada linha tem pelo menos 44px (min-h-11) e as divisórias usam o token da tinta", () => {
    renderCard();

    const rows = screen.getAllByRole("listitem");
    for (const row of rows) expect(row).toHaveClass("min-h-11");
    expect(rows[0]).not.toHaveClass("border-t");
    expect(rows[1]).toHaveClass("border-t", "border-on-pastel-line");
  });

  it("é um card feature rosa com tinta de pastel e grid de 2 colunas só a partir de 1040px", () => {
    const { container } = renderCard();

    const card = container.querySelector('[data-slot="card"]');
    expect(card).toHaveClass(
      "bg-invite",
      "text-on-pastel",
      "grid",
      "@min-[1040px]/main:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]",
    );
  });

  it("os botões nunca quebram linha e o título cai para 22px no celular", () => {
    renderCard();

    expect(screen.getByRole("heading", { level: 2 })).toHaveClass(
      "text-[26px]",
      "max-md:text-[22px]",
    );
    expect(screen.getByRole("link", { name: "Gerar convites" })).toHaveClass(
      "whitespace-nowrap",
    );
    expect(screen.getByRole("button", { name: "Agora não" })).toHaveClass(
      "whitespace-nowrap",
    );
  });

  it("primário com 22px de padding e 'Agora não' com 20px (protótipo)", () => {
    renderCard();

    expect(screen.getByRole("link", { name: "Gerar convites" })).toHaveClass(
      "bg-on-pastel",
      "px-[22px]",
    );
    const dismiss = screen.getByRole("button", { name: "Agora não" });
    expect(dismiss).toHaveClass("bg-on-pastel-secondary", "px-5");
    expect(dismiss).not.toHaveClass("px-[22px]");
    expect(dismiss).toHaveAttribute("type", "submit");
  });

  it("os tiles tracejados usam a tinta do pastel com opacidade (sem rgba no .tsx)", () => {
    const { container } = renderCard();

    for (const opacity of ["40", "30", "20"]) {
      expect(
        container.querySelector(`.border-on-pastel\\/${opacity}`),
      ).not.toBeNull();
    }
    expect(
      screen.getAllByRole("listitem")[4]?.querySelector(".border-on-pastel\\/45"),
    ).not.toBeNull();
  });

  it("usa só tokens de cor (sem hex nem classe crua)", () => {
    const { container } = renderCard();

    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(container.innerHTML).not.toMatch(
      /\b(?:bg|text|border)-(?:red|green|blue|yellow|amber|orange|gray|slate|zinc|pink)-\d+/,
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bunx vitest run src/components/app-shell/InviteTeamCard.test.tsx`
Expected: FAIL com "Failed to resolve import "./InviteTeamCard""

- [ ] **Step 3: Implementar o `InviteTeamCard`**

Write `src/components/app-shell/InviteTeamCard.tsx`:

```tsx
import { cn } from "cn";
import { ArrowRight, Check, Plus } from "lucide-react";
import Link from "next/link";

import { dismissInviteCardAction } from "@/app/(app)/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AdminOverviewCounts } from "@/features/admin/overview";
import { pluralize } from "@/lib/plural";

import { UserAvatar } from "./UserAvatar";

export type InviteCounts = Pick<
  AdminOverviewCounts,
  "sectors" | "shifts" | "items" | "destinations" | "people"
>;

function setupSteps(counts: InviteCounts) {
  const active = (count: number) => pluralize(count, "ativo", "ativos");
  return [
    { name: "Setores", count: active(counts.sectors), done: counts.sectors > 0 },
    { name: "Turnos", count: active(counts.shifts), done: counts.shifts > 0 },
    { name: "Itens", count: active(counts.items), done: counts.items > 0 },
    {
      name: "Destinos",
      count: active(counts.destinations),
      done: counts.destinations > 0,
    },
    {
      // O passo que falta: convidar. Nunca vem marcado.
      name: "Equipe",
      count: pluralize(counts.people, "pessoa ativa", "pessoas ativas"),
      done: false,
    },
  ];
}

// Primeiro acesso do admin: o último passo é convidar a equipe. Aparece no topo
// dos cartões (HomeCards decide quando). Rosa (--invite), tinta --on-pastel.
export function InviteTeamCard({
  counts,
  avatarSrc,
}: {
  counts: InviteCounts;
  avatarSrc: string;
}) {
  return (
    <Card
      variant="feature"
      className="grid grid-cols-1 gap-6 bg-invite text-on-pastel @min-[1040px]/main:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
    >
      <div className="flex flex-col items-start gap-[18px]">
        <div aria-hidden="true" className="flex items-center gap-2.5 py-1">
          <UserAvatar src={avatarSrc} size={52} tilt={-5} frame="on-pastel" />
          <span className="grid size-[52px] shrink-0 rotate-[4deg] place-items-center rounded-[17px] border-2 border-dashed border-on-pastel/40">
            <Plus className="size-[18px]" strokeWidth={2.2} />
          </span>
          <span className="size-[52px] shrink-0 -rotate-3 rounded-[17px] border-2 border-dashed border-on-pastel/30" />
          <span className="size-[52px] shrink-0 rotate-5 rounded-[17px] border-2 border-dashed border-on-pastel/20" />
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="font-mono text-xs leading-none font-medium tracking-[.06em] text-on-invite-soft uppercase">
            Último passo
          </span>
          <h2 className="font-heading text-[26px] leading-none font-black tracking-[-0.025em] max-md:text-[22px]">
            Convide sua equipe
          </h2>
          <p className="max-w-[440px] text-[15px] leading-[1.55] text-pretty text-on-invite-muted">
            Gere um link de convite para cada pessoa. Operadores entram no setor
            que você escolher; administradores veem todos os setores.
          </p>
        </div>

        <div className="mt-auto flex flex-wrap gap-2.5">
          <Link
            href="/admin/equipe"
            className={buttonVariants({ variant: "on-pastel", size: "pill" })}
          >
            Gerar convites
            <ArrowRight aria-hidden="true" strokeWidth={2.2} />
          </Link>
          {/* "Agora não": formulário com a Server Action da Task 10 (funciona sem
              JS e sem estado de cliente; ela devolve `void`, o tipo que o
              `action` do React aceita). Nada de `"use server"` inline aqui: o
              guarda `actionsGuards.test.ts` só aceita a diretiva num
              `actions.ts` de `src/app/(app)/`. A ação grava o cookie e o
              `revalidatePath("/")` dela redesenha o Início sem o cartão. */}
          <form action={dismissInviteCardAction}>
            <Button
              type="submit"
              variant="on-pastel-secondary"
              size="pill"
              className="px-5"
            >
              Agora não
            </Button>
          </form>
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-[22px] bg-on-pastel-soft px-[22px] py-[18px]">
        <p className="mb-2 font-mono text-xs leading-none font-medium tracking-[.06em] text-on-invite-soft uppercase">
          Cadastros
        </p>
        {/* Protótipo: 4px entre as linhas (o `gap` do bloco), mais a divisória. */}
        <ul className="flex flex-col gap-1">
          {setupSteps(counts).map((step, index) => (
            <li
              key={step.name}
              data-done={step.done}
              className={cn(
                "flex min-h-11 items-center gap-3",
                index > 0 && "border-t border-on-pastel-line",
              )}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full",
                  step.done
                    ? "bg-on-pastel text-invite"
                    : "border-2 border-dashed border-on-pastel/45",
                )}
              >
                {step.done && (
                  <Check aria-hidden="true" className="size-[13px]" strokeWidth={3} />
                )}
                <span className="sr-only">{step.done ? "Feito" : "Falta fazer"}</span>
              </span>
              <span className="flex-1 font-heading text-base font-bold">
                {step.name}
              </span>
              <span className="font-mono text-[13px] font-medium whitespace-nowrap text-on-invite-muted tabular-nums">
                {step.count}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bunx vitest run src/components/app-shell/InviteTeamCard.test.tsx`
Expected: PASS (13 testes)

- [ ] **Step 5: Teste do `HomeCards` (falha)**

Write `src/components/passagens/HomeCards.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  MyShiftState,
  PendingHandover,
  HomeHandovers as HomeHandoversData,
} from "@/features/handovers/home";
import type { HomeRequests } from "@/features/requests/types";
import { spDate } from "../../../test/clock";
import { HomeCards } from "./HomeCards";

vi.mock("@/app/(app)/actions", () => ({
  dismissInviteCardAction: vi.fn(),
  chooseSectorAction: vi.fn(),
}));
vi.mock("@/lib/avatar", () => ({
  avatarDataUri: (seed: string) => `data:image/svg+xml,${seed}`,
}));

const SECTOR_ID = "11111111-1111-4111-8111-111111111111";
const SHIFT = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Turno Manhã",
  startsAt: "06:00",
  endsAt: "14:00",
};
const REF = {
  sectorId: SECTOR_ID,
  shiftId: SHIFT.id,
  operationalDate: "2026-11-20",
};
const START: MyShiftState = {
  kind: "start",
  ref: REF,
  shift: SHIFT,
  saved: null,
  progress: {
    startLabel: "06:00",
    endLabel: "14:00",
    nowLabel: "08:42",
    pct: 34,
  },
};
const PENDING: PendingHandover = {
  id: "h1",
  sectorName: "ULD",
  shiftName: "Turno Noite",
  operationalDate: "2026-11-19",
  deliveredByName: "Bruno Teste",
  deliveredById: "u-bruno",
  deliveredAt: spDate("2026-11-19", "05:58"),
  nextShiftPreview: "Conferir a rede do box 4.",
};
const NO_REQUESTS: HomeRequests = { openCount: 0, staleCount: 0, stale: [] };
const INVITE = { sectors: 4, shifts: 12, items: 9, destinations: 5, people: 1 };

function home(overrides: Partial<HomeHandoversData> = {}): HomeHandoversData {
  return {
    sector: { id: SECTOR_ID, name: "ULD", color: "lilac" },
    pending: null,
    mine: START,
    ...overrides,
  };
}

type Props = Parameters<typeof HomeCards>[0];

function renderCards(overrides: Partial<Props> = {}) {
  return render(
    <HomeCards
      home={home()}
      requests={NO_REQUESTS}
      sectorParam={null}
      canManageCatalog={false}
      actorId="u-ana"
      inviteCounts={null}
      firstAccess={false}
      {...overrides}
    />,
  );
}

function titles(): (string | null)[] {
  return screen
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent);
}

describe("HomeCards", () => {
  it("só turno e solicitações: nada de pendente nem convite", () => {
    const { container } = renderCards();

    expect(titles()).toEqual(["Passagem do meu turno", "Solicitações"]);
    // O ponto de extensão da Task 11 continua com o mesmo nome e o gap de 16px.
    expect(container.firstElementChild).toHaveAttribute(
      "data-slot",
      "home-cards",
    );
    expect(container.firstElementChild).toHaveClass("flex", "flex-col", "gap-4");
  });

  it("turno e solicitações lado a lado em 1.3fr/1fr só a partir de 1040px de área útil", () => {
    renderCards();

    const grid = screen
      .getByRole("heading", { name: "Passagem do meu turno" })
      .closest(".grid");
    expect(grid).toHaveClass(
      "grid-cols-[minmax(0,1fr)]",
      "items-stretch",
      "gap-4",
      "@min-[1040px]/main:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]",
    );
    expect(grid).toContainElement(
      screen.getByRole("heading", { name: "Solicitações" }),
    );
  });

  it("com pendente, ele vem antes do turno e usa o avatar de quem entregou", () => {
    const { container } = renderCards({ home: home({ pending: PENDING }) });

    expect(titles()).toEqual([
      "Passagem para confirmar",
      "Passagem do meu turno",
      "Solicitações",
    ]);
    expect(
      container.querySelector('img[src="data:image/svg+xml,u-bruno"]'),
    ).not.toBeNull();
  });

  it("com convite, ele vem no topo, antes do pendente, com o avatar do admin", () => {
    const { container } = renderCards({
      home: home({ pending: PENDING }),
      inviteCounts: INVITE,
      actorId: "u-admin",
    });

    expect(titles()).toEqual([
      "Convide sua equipe",
      "Passagem para confirmar",
      "Passagem do meu turno",
      "Solicitações",
    ]);
    expect(
      container.querySelector('img[src="data:image/svg+xml,u-admin"]'),
    ).not.toBeNull();
    expect(screen.getByRole("button", { name: "Agora não" })).toBeInTheDocument();
  });

  it("sem convite (operador, dispensado ou equipe maior), nenhum 'Agora não' na tela", () => {
    renderCards({ inviteCounts: null });

    expect(
      screen.queryByRole("heading", { name: "Convide sua equipe" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Agora não" }),
    ).not.toBeInTheDocument();
  });

  it("no primeiro acesso o cartão de solicitações vazio ganha a linha de apoio, com o avatar de quem está logado", () => {
    const { container } = renderCards({
      firstAccess: true,
      inviteCounts: INVITE,
      actorId: "u-admin",
    });

    const requests = screen
      .getByRole("heading", { name: "Solicitações" })
      .closest('[data-slot="card"]') as HTMLElement;
    expect(
      within(requests).getByText(
        "Os pedidos da equipe aparecem aqui assim que alguém registrar o primeiro.",
      ),
    ).toBeInTheDocument();
    expect(requests.querySelector("img")).toHaveAttribute(
      "src",
      "data:image/svg+xml,u-admin",
    );
    expect(container.querySelectorAll("img").length).toBeGreaterThanOrEqual(2);
  });

  it("dispensado (inviteCounts nulo) mas ainda no primeiro acesso: a linha de apoio continua", () => {
    renderCards({ firstAccess: true, inviteCounts: null });

    expect(
      screen.getByText(
        "Os pedidos da equipe aparecem aqui assim que alguém registrar o primeiro.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Convide sua equipe" }),
    ).not.toBeInTheDocument();
  });

  it("rascunho: o avatar de quem salvou usa o id dessa pessoa", () => {
    const { container } = renderCards({
      home: home({
        mine: {
          ...START,
          kind: "continue",
          saved: {
            at: spDate("2026-11-20", "07:58"),
            byName: "Carla Teste",
            byId: "u-carla",
          },
        },
      }),
    });

    expect(
      container.querySelector('img[src="data:image/svg+xml,u-carla"]'),
    ).not.toBeNull();
  });

  it("admin leva o setor nos links (começar passagem e ver solicitações)", () => {
    renderCards({ sectorParam: SECTOR_ID, canManageCatalog: true });

    expect(
      screen.getByRole("link", { name: "Começar passagem" }),
    ).toHaveAttribute(
      "href",
      `/passagens/nova?turno=${SHIFT.id}&data=2026-11-20&setor=${SECTOR_ID}`,
    );
    expect(
      screen.getByRole("link", { name: "Ver solicitações" }),
    ).toHaveAttribute("href", `/solicitacoes?setor=${SECTOR_ID}`);
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `bunx vitest run src/components/passagens/HomeCards.test.tsx`
Expected: FAIL com "Failed to resolve import "./HomeCards""

- [ ] **Step 7: Implementar o `HomeCards`**

Write `src/components/passagens/HomeCards.tsx`:

```tsx
import {
  InviteTeamCard,
  type InviteCounts,
} from "@/components/app-shell/InviteTeamCard";
import { RequestsHomeCard } from "@/components/solicitacoes/RequestsHomeCard";
import type { HomeHandovers as HomeHandoversData } from "@/features/handovers/home";
import type { HomeRequests } from "@/features/requests/types";
import { requestsHref } from "@/features/requests/urls";
import { avatarDataUri } from "@/lib/avatar";

import { MyShiftCard } from "./MyShiftCard";
import { PendingHandoverCard } from "./PendingHandoverCard";

// Os cartões do Início, depois do hero. Em coluna, na ordem: convite (primeiro
// acesso do admin), pendente (se houver) e, na linha de baixo, turno e
// solicitações. Esta linha é 1 coluna e vira `minmax(0,1.3fr) minmax(0,1fr)` a
// partir de 1040px de ÁREA ÚTIL (container query do `@container/main`, não a
// largura da janela). Os avatares nascem aqui, no servidor, com o id da pessoa;
// os cartões só desenham o data URI que recebem. O `data-slot="home-cards"` é o
// ponto de extensão que a Task 11 criou (e testa) no `HomeHandovers`.
export function HomeCards({
  home,
  requests,
  sectorParam,
  canManageCatalog,
  actorId,
  inviteCounts,
  firstAccess,
}: {
  home: HomeHandoversData;
  requests: HomeRequests;
  sectorParam: string | null;
  canManageCatalog: boolean;
  actorId: string;
  // Não nulo = mostrar "Convide sua equipe" (admin, sozinho, não dispensado).
  inviteCounts: InviteCounts | null;
  // Primeiro acesso do admin (mesmo depois de dispensar o convite).
  firstAccess: boolean;
}) {
  const savedAvatar =
    home.mine.kind === "continue" && home.mine.saved
      ? avatarDataUri(home.mine.saved.byId)
      : null;

  return (
    <div data-slot="home-cards" className="flex flex-col gap-4">
      {inviteCounts && (
        <InviteTeamCard
          counts={inviteCounts}
          avatarSrc={avatarDataUri(actorId)}
        />
      )}
      {home.pending && (
        <PendingHandoverCard
          pending={home.pending}
          avatarSrc={avatarDataUri(home.pending.deliveredById)}
        />
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-4 @min-[1040px]/main:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <MyShiftCard
          state={home.mine}
          sectorId={home.sector.id}
          sectorName={home.sector.name}
          sectorColor={home.sector.color}
          canManageCatalog={canManageCatalog}
          sectorParam={sectorParam}
          avatarSrc={savedAvatar}
        />
        <RequestsHomeCard
          home={requests}
          allHref={requestsHref(sectorParam)}
          avatarSrc={avatarDataUri(actorId)}
          firstAccess={firstAccess}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `bunx vitest run src/components/passagens/HomeCards.test.tsx`
Expected: PASS (9 testes)

- [ ] **Step 9: `HomeHandovers` lê as contagens e a dispensa e entrega os cartões ao `HomeCards`**

Em `src/components/passagens/HomeHandovers.tsx`, na versão deixada pelas Tasks 11, 12 e 13. O hero (`HeroRow`, `HomeFrame`, `SectorPicker`/`SectorPill`, "Ver o dashboard") e os ramos de erro **não mudam**. Três edições com o texto exato (se o Biome tiver só reordenado algum import, aplique a mesma troca na ordem dele):

1. Imports. Troque

```tsx
import { RequestsHomeCard } from "@/components/solicitacoes/RequestsHomeCard";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/db";
import { getHomeHandovers } from "@/features/handovers/home";
import { resolveScreenSector } from "@/features/handovers/screenSector";
import { getHomeRequests } from "@/features/requests/home";
import { requestsHref } from "@/features/requests/urls";
import { requireUser } from "@/lib/auth/session";
import { avatarDataUri } from "@/lib/avatar";
import type { SearchParams } from "@/lib/searchParams";

import { MyShiftCard } from "./MyShiftCard";
import { PendingHandoverCard } from "./PendingHandoverCard";
import { SectorPicker } from "./SectorPicker";
import { SectorPill } from "./SectorPill";
```

por

```tsx
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/db";
import {
  readInviteCardDismissed,
  shouldShowInviteCard,
} from "@/features/admin/firstAccess";
import { getAdminOverviewCounts } from "@/features/admin/overview";
import { getHomeHandovers } from "@/features/handovers/home";
import { resolveScreenSector } from "@/features/handovers/screenSector";
import { getHomeRequests } from "@/features/requests/home";
import { requireUser } from "@/lib/auth/session";
import type { SearchParams } from "@/lib/searchParams";

import { HomeCards } from "./HomeCards";
import { SectorPicker } from "./SectorPicker";
import { SectorPill } from "./SectorPill";
```

(`RequestsHomeCard`, `requestsHref`, `avatarDataUri`, `MyShiftCard` e `PendingHandoverCard` passam a ser usados só no `HomeCards`. `cn`, `ChartColumn`, `Link`, `notFound`, `ReactNode`, `EmptyState` e `buttonVariants` continuam, para o hero e os ramos de erro.)

2. A leitura das solicitações. Troque

```tsx
  const requests = await getHomeRequests(db, actor, home.sector.id, now);
```

por

```tsx
  const isAdmin = actor.role === "admin";
  // Primeiro acesso (spec §5.3): só o admin paga as contagens e lê o cookie
  // de dispensa (`readInviteCardDismissed`, Task 10: só o valor "1" dispensa).
  const [requests, counts, dismissed] = await Promise.all([
    getHomeRequests(db, actor, home.sector.id, now),
    isAdmin ? getAdminOverviewCounts(db, now) : Promise.resolve(null),
    isAdmin ? readInviteCardDismissed() : Promise.resolve(false),
  ]);
  // "Agora não" some só com o cartão; a linha de apoio das solicitações vazias
  // continua enquanto for o primeiro acesso (é o que o protótipo faz).
  const firstAccess =
    counts !== null &&
    shouldShowInviteCard({ isAdmin, counts, dismissed: false });
  const inviteCounts =
    counts !== null && shouldShowInviteCard({ isAdmin, counts, dismissed })
      ? counts
      : null;
```

3. No `return`, troque o comentário e o `div` `home-cards` inteiro, como as Tasks 11–13 o deixaram:

```tsx
      {/* Ponto de extensão do Início: aqui entram o convite (antes do pendente) e o
          grid de 2 colunas (no lugar dos dois cartões finais). */}
      <div data-slot="home-cards" className="flex flex-col gap-4">
        {home.pending && (
          <PendingHandoverCard
            pending={home.pending}
            avatarSrc={avatarDataUri(home.pending.deliveredById)}
          />
        )}
        <MyShiftCard
          state={home.mine}
          sectorId={home.sector.id}
          sectorName={home.sector.name}
          sectorColor={home.sector.color}
          canManageCatalog={actor.role === "admin"}
          sectorParam={sectorParam}
          avatarSrc={
            home.mine.kind === "continue" && home.mine.saved
              ? avatarDataUri(home.mine.saved.byId)
              : null
          }
        />
        <RequestsHomeCard
          home={requests}
          allHref={requestsHref(sectorParam)}
          avatarSrc={avatarDataUri(actor.userId)}
        />
      </div>
```

por

```tsx
      {/* Os cartões (convite, pendente e o grid turno + solicitações) são do
          HomeCards, que mantém o `data-slot="home-cards"`. */}
      <HomeCards
        home={home}
        requests={requests}
        sectorParam={sectorParam}
        canManageCatalog={isAdmin}
        actorId={actor.userId}
        inviteCounts={inviteCounts}
        firstAccess={firstAccess}
      />
```

O `HomeCards` devolve o `<div data-slot="home-cards" className="flex flex-col gap-4">` (o teste da Task 11 "a linha vem antes dos cartões, que ficam no ponto de extensão 'home-cards'" continua verde). `counts` tem os seis campos de `AdminOverviewCounts`, um superconjunto do `InviteCounts` (TypeScript aceita). O mock de `next/headers` do `HomeHandovers.test.tsx` vale para o `readInviteCardDismissed`, que lê o mesmo `cookies()`.

- [ ] **Step 10: Testes de primeiro acesso no `HomeHandovers.test.tsx`**

1. No bloco `vi.hoisted`, acrescente `dismissed: { value: boolean }` ao tipo e `dismissed: { value: false }` ao objeto; no mock de `next/headers` troque a função `get` por:

```tsx
    get: (name: string) => {
      if (name === "closery_setor" && mocks.cookie.value !== undefined) {
        return { name, value: mocks.cookie.value };
      }
      if (name === "closery-convite-dispensado" && mocks.dismissed.value) {
        return { name, value: "1" };
      }
      return undefined;
    },
```

2. No `vi.mock("@/app/(app)/actions", ...)` do arquivo troque por `vi.mock("@/app/(app)/actions", () => ({ chooseSectorAction: vi.fn(), dismissInviteCardAction: vi.fn() }));`.

3. No `beforeEach` acrescente `mocks.dismissed.value = false;` e importe `insertInvite` de `../../../test/fixtures` (junto dos outros `insert*`).

4. Acrescente, antes do teste "rascunho existente vira 'Continuar passagem'":

```tsx
  describe("primeiro acesso do admin", () => {
    async function soloAdmin() {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, { sectorId: uld.id });
      const admin = await insertUser(db, { role: "admin", name: "Ana Teste" });
      mocks.requireUser.mockResolvedValue(
        authzOf({ role: "admin", userId: admin.id }),
      );
      return { uld, admin };
    }

    it("admin sozinho e sem convites: mostra 'Convide sua equipe' no topo, com a linha de apoio nas solicitações", async () => {
      const { uld } = await soloAdmin();

      await renderHome({ setor: uld.id });

      const headings = screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent);
      expect(headings).toEqual([
        "Convide sua equipe",
        "Passagem do meu turno",
        "Solicitações",
      ]);
      expect(screen.getByText("1 pessoa ativa")).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Gerar convites" }),
      ).toHaveAttribute("href", "/admin/equipe");
      expect(
        screen.getByText(
          "Os pedidos da equipe aparecem aqui assim que alguém registrar o primeiro.",
        ),
      ).toBeInTheDocument();
    });

    it("cookie de dispensa: o cartão some, a linha de apoio das solicitações fica", async () => {
      const { uld } = await soloAdmin();
      mocks.dismissed.value = true;

      await renderHome({ setor: uld.id });

      expect(
        screen.queryByRole("heading", { name: "Convide sua equipe" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText(
          "Os pedidos da equipe aparecem aqui assim que alguém registrar o primeiro.",
        ),
      ).toBeInTheDocument();
    });

    it("com mais uma pessoa ativa, não é primeiro acesso: sem cartão e sem linha de apoio", async () => {
      const { uld } = await soloAdmin();
      await insertUser(db, { role: "operator", sectorId: uld.id });

      await renderHome({ setor: uld.id });

      expect(
        screen.queryByRole("heading", { name: "Convide sua equipe" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Os pedidos da equipe aparecem aqui/),
      ).not.toBeInTheDocument();
    });

    it("com um convite pendente, não é primeiro acesso", async () => {
      const { uld } = await soloAdmin();
      await insertInvite(db, { role: "operator", sectorId: uld.id });

      await renderHome({ setor: uld.id });

      expect(
        screen.queryByRole("heading", { name: "Convide sua equipe" }),
      ).not.toBeInTheDocument();
    });

    it("operador sozinho no banco nunca vê o cartão (só admin)", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, { sectorId: uld.id });
      const ana = await insertUser(db, { role: "operator", sectorId: uld.id });
      mocks.requireUser.mockResolvedValue(
        authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
      );

      await renderHome();

      expect(
        screen.queryByRole("heading", { name: "Convide sua equipe" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Os pedidos da equipe aparecem aqui/),
      ).not.toBeInTheDocument();
    });
  });
```

- [ ] **Step 11: Rodar e ver passar**

Run: `bunx vitest run src/components/app-shell/InviteTeamCard.test.tsx src/components/passagens/HomeCards.test.tsx src/components/passagens/HomeHandovers.test.tsx src/components/passagens/MyShiftCard.test.tsx src/components/solicitacoes/RequestsHomeCard.test.tsx src/app/actionsGuards.test.ts src/app/rawColors.test.ts`
Expected: PASS em todos.

- [ ] **Step 12: Helper do E2E para o primeiro acesso (com `restore`)**

O banco do E2E é um só e compartilhado entre os specs (`playwright.config.ts`: `workers: 1`, `fullyParallel: false`, os arquivos rodam um depois do outro): para a condição "uma pessoa ativa e zero convites" valer, o teste precisa isolar o estado e, no fim do arquivo, **devolvê-lo exatamente como estava**, para os specs seguintes (`passagem`, `publico`, `redefinir-senha`, `solicitacoes`, `touch-targets`...) não sentirem nada. Em `e2e/db.ts`:

1. Troque `import { and, asc, count, desc, eq } from "drizzle-orm";` por `import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";`.
2. Em `import { ... } from "@/db/schema";` acrescente `invite,` (ordem alfabética, depois de `handoverCorrection`).
3. Depois de `deactivateUserByEmail`, acrescente:

```ts
// Deixa o banco como o primeiro acesso do admin exige (`people === 1` e
// `pendingInvites === 0`): desativa as pessoas ativas e cancela os convites
// pendentes, sem apagar nada. Chame ANTES de cadastrar o admin do teste.
// Devolve `restore`, que reativa EXATAMENTE as pessoas que esta chamada
// desativou e descancela EXATAMENTE os convites que ela cancelou (pelos ids
// guardados; o que outra parte do teste mudou depois fica como está). Guarde o
// `restore` e chame no `test.afterAll` do arquivo (em ordem inversa, se houver
// mais de um), para os specs seguintes acharem o banco como antes.
export async function isolateFirstAccess(
  db: Db,
  now: Date = new Date(),
): Promise<() => Promise<void>> {
  const changed = await db.transaction(async (tx) => {
    const people = await tx
      .update(user)
      .set({ deactivatedAt: now })
      .where(isNull(user.deactivatedAt))
      .returning({ id: user.id });
    const invites = await tx
      .update(invite)
      .set({ cancelledAt: now })
      .where(and(isNull(invite.usedAt), isNull(invite.cancelledAt)))
      .returning({ id: invite.id });
    return {
      userIds: people.map((row) => row.id),
      inviteIds: invites.map((row) => row.id),
    };
  });

  return async () => {
    await db.transaction(async (tx) => {
      if (changed.userIds.length > 0) {
        await tx
          .update(user)
          .set({ deactivatedAt: null })
          .where(inArray(user.id, changed.userIds));
      }
      if (changed.inviteIds.length > 0) {
        await tx
          .update(invite)
          .set({ cancelledAt: null })
          .where(inArray(invite.id, changed.inviteIds));
      }
    });
  };
}
```

(Duas escritas em cada lado, por isso `db.transaction()`, como pede o `AGENTS.md`. Não há teste de unidade: `e2e/db.ts` só roda contra o banco do E2E; o `restore` é exercitado pelos specs seguintes, que voltam a enxergar as pessoas e os convites.)

- [ ] **Step 13: Criar `e2e/inicio.spec.ts`**

Write `e2e/inicio.spec.ts`:

```ts
import { expect } from "@playwright/test";
import type { Pool } from "pg";

import type { Db } from "@/db/types";

import { isolateFirstAccess, openE2eDb } from "./db";
import { seedSector, signUpAdmin, signUpOperator, test } from "./helpers";

// Início novo: primeiro acesso do admin (cartão "Convide sua equipe", dispensa
// por cookie) e o tema (escuro por padrão, switch, persistência). Os dois
// primeiros testes isolam o banco compartilhado com `isolateFirstAccess`; o
// `afterAll` devolve o banco como estava (os specs seguintes rodam depois deste,
// no mesmo banco: `workers: 1`, `fullyParallel: false`).

const INVITE_COOKIE = "closery-convite-dispensado";
const FIRST_ACCESS_LINE =
  "Os pedidos da equipe aparecem aqui assim que alguém registrar o primeiro.";

let pool: Pool;
let db: Db;
// Um `restore` por chamada de `isolateFirstAccess`, desfeitos em ordem inversa.
const restores: (() => Promise<void>)[] = [];

test.beforeAll(() => {
  ({ pool, db } = openE2eDb());
});

test.afterAll(async () => {
  for (const restore of restores.reverse()) await restore();
  await pool.end();
});

test("primeiro acesso: o cartão aparece, 'Agora não' o esconde e a dispensa sobrevive ao recarregar", async ({
  page,
  context,
}) => {
  const world = await seedSector(db);
  restores.push(await isolateFirstAccess(db));
  await signUpAdmin(page, db, "Ana Teste");
  // O setor do teste na URL: as solicitações abertas dos outros specs ficam em
  // outros setores, então o cartão de solicitações aparece vazio.
  await page.goto(`/?setor=${world.sector.id}`);

  const invite = page.getByRole("heading", {
    level: 2,
    name: "Convide sua equipe",
  });
  await expect(invite).toBeVisible();
  await expect(page.getByText("Último passo")).toBeVisible();
  await expect(page.getByText("1 pessoa ativa")).toBeVisible();
  await expect(page.getByRole("link", { name: "Gerar convites" })).toHaveAttribute(
    "href",
    "/admin/equipe",
  );
  await expect(page.getByText(FIRST_ACCESS_LINE)).toBeVisible();
  // O cartão de turno e o de solicitações continuam na tela.
  await expect(
    page.getByRole("heading", { name: "Passagem do meu turno" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Agora não" }).click();
  await expect(invite).toHaveCount(0);

  // O cookie é HttpOnly (o servidor lê; o JS da página não), vale 1 ano e é Lax.
  const cookie = (await context.cookies()).find(
    (candidate) => candidate.name === INVITE_COOKIE,
  );
  expect(cookie).toMatchObject({
    value: "1",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  });
  expect(cookie?.expires ?? 0).toBeGreaterThan(
    Date.now() / 1000 + 300 * 24 * 3600,
  );

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Passagem do meu turno" }),
  ).toBeVisible();
  await expect(invite).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agora não" })).toHaveCount(0);
  // Dispensar esconde o cartão, não muda o primeiro acesso.
  await expect(page.getByText(FIRST_ACCESS_LINE)).toBeVisible();
});

test("operador sozinho no banco nunca vê o cartão 'Convide sua equipe'", async ({
  page,
}) => {
  const world = await seedSector(db);
  restores.push(await isolateFirstAccess(db));
  await signUpOperator(page, db, world.sector.id, "Bruno Teste");

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Passagem do meu turno" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Convide sua equipe" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agora não" })).toHaveCount(0);
  await expect(page.getByText(FIRST_ACCESS_LINE)).toHaveCount(0);
});

test("tema: escuro por padrão, o switch troca e a escolha sobrevive ao recarregar", async ({
  page,
}) => {
  const html = page.locator("html");
  // Até na tela pública o padrão é o escuro (o tema não segue o sistema).
  await page.goto("/entrar");
  await expect(html).toHaveClass(/\bdark\b/);

  const world = await seedSector(db);
  await signUpOperator(page, db, world.sector.id, "Carla Teste");
  await page.goto("/");

  const toggle = page.getByRole("switch", { name: "Tema escuro" });
  await expect(html).toHaveClass(/\bdark\b/);
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  await toggle.click();
  await expect(html).not.toHaveClass(/\bdark\b/);
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  expect(
    await page.evaluate(() => localStorage.getItem("closery-tema")),
  ).toBe("light");

  await page.reload();
  await expect(html).not.toHaveClass(/\bdark\b/);
  await expect(
    page.getByRole("switch", { name: "Tema escuro" }),
  ).toHaveAttribute("aria-checked", "false");

  // E de volta ao escuro, também persistido.
  await page.getByRole("switch", { name: "Tema escuro" }).click();
  await expect(html).toHaveClass(/\bdark\b/);
  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);
  await expect(
    page.getByRole("switch", { name: "Tema escuro" }),
  ).toHaveAttribute("aria-checked", "true");
});
```

- [ ] **Step 14: Guarda de toque: Início novo**

Em `e2e/touch-targets.spec.ts`:

1. Import: troque `import { buildInviteUrl, E2E_BASE_URL, insertHandover, ...` acrescentando `isolateFirstAccess,` (ordem alfabética, depois de `insertUser`... o Biome ordena; rode `bun run format` se reclamar).

2. No teste do operador, depois do `insertRequestItem(...)` existente (e antes do comentário "Uma passagem entregue ontem"), acrescente uma solicitação parada, para o Início listar uma linha inteira clicável:

```ts
  // Parada há 5 dias: entra em "Paradas há mais tempo" no Início (a linha
  // inteira é um link esticado, que este guarda não mede pelo próprio link).
  await insertRequest(db, {
    sectorId: world.sector.id,
    createdBy: caio.id,
    destinationId: world.destination.id,
    description: "Repor fita de amarração",
    createdAt: ago(5 * 24 * 3_600_000),
  });
```

3. Depois do laço `for (const path of [...]) { await expectTouchSized(page, path); }` do teste do operador, acrescente:

```ts
  // A linha da solicitação parada do Início é um link esticado (after:inset-0):
  // o guarda ignora o link, então mede a linha.
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const rowHeights = await page
    .locator('[data-slot="open-request-row"]')
    .evaluateAll((rows) =>
      rows.map((row) => Math.round(row.getBoundingClientRect().height)),
    );
  expect(rowHeights.length, "o Início lista a solicitação parada").toBeGreaterThan(0);
  expect
    .soft(
      rowHeights.filter((height) => height < MIN),
      "linhas de solicitação do Início",
    )
    .toEqual([]);
```

4. O `afterAll` do arquivo passa a devolver o banco como estava antes do teste novo (o `restore` do `isolateFirstAccess`, Step 12). Troque

```ts
let pool: Pool;
let db: Db;
test.beforeAll(() => {
  ({ pool, db } = openE2eDb());
});
test.afterAll(async () => {
  await pool.end();
});
```

por

```ts
let pool: Pool;
let db: Db;
// Os `restore` do `isolateFirstAccess` (teste do Início do admin), desfeitos em
// ordem inversa antes de fechar o pool: os specs seguintes acham o banco como antes.
const restores: (() => Promise<void>)[] = [];
test.beforeAll(() => {
  ({ pool, db } = openE2eDb());
});
test.afterAll(async () => {
  for (const restore of restores.reverse()) await restore();
  await pool.end();
});
```

5. Antes do teste `"admin: telas de cadastro ..."`, acrescente um teste novo:

```ts
test("admin: o Início com seletor de setor, convite, cartões e tema têm alvos de toque de 44px", async ({
  page,
}) => {
  test.slow();
  const world = await seedSector(db);
  // Um segundo setor ativo: o seletor aparece com mais de uma opção.
  await seedSector(db);
  restores.push(await isolateFirstAccess(db));
  await signUpAdmin(page, db, "Carla Teste");

  // Primeiro acesso: o cartão "Convide sua equipe" (Gerar convites e Agora não)
  // está na tela medida, junto do seletor e do switch de tema do cabeçalho.
  await expectTouchSized(page, `/?setor=${world.sector.id}`);
  await expect(
    page.getByRole("heading", { name: "Convide sua equipe" }),
  ).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Setor" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Tema escuro" })).toBeVisible();
});
```

- [ ] **Step 15: Conferir tipos, lint, o guarda do registro e os testes de unidade tocados**

Run: `bun run check-types && bun run lint && bunx vitest run test/uiRegistryDoc.test.ts src/components/app-shell/InviteTeamCard.test.tsx src/components/passagens/HomeCards.test.tsx src/components/passagens/HomeHandovers.test.tsx`
Expected: tudo verde. `check-types` também compila `e2e/inicio.spec.ts`, `e2e/db.ts` e `e2e/touch-targets.spec.ts` (o tsconfig inclui `e2e`; se não incluir, rode `bunx tsc --noEmit -p e2e` quando existir um tsconfig próprio).

Os E2E novos e o guarda de toque **não rodam nesta tarefa** (a máquina tem pouca memória): o controlador roda no fim `bun run test:e2e -- e2e/inicio.spec.ts e2e/touch-targets.spec.ts` (cerca de 1 min com o build). Esperado: `inicio.spec.ts` 3 passed; `touch-targets.spec.ts` 3 passed.

- [ ] **Step 16: Atualizar `.context/ui-registry.md`**

a) `InviteTeamCard` e `HomeCards` (entradas novas). Edit com `old_string` `### AppError e AppNotFound` e `new_string`:

```
### InviteTeamCard
- **Status:** ✅ pronto (2026-11-27)
- **Local:** `src/components/app-shell/InviteTeamCard.tsx` (server-safe)
- **Propósito:** cartão "Convide sua equipe" do primeiro acesso do admin: o último passo é gerar os convites.
- **Como funciona:** `Card variant="feature"` rosa (`bg-invite`, tinta `text-on-pastel`), grid `minmax(0,1fr) minmax(0,1.2fr)` só a partir de 1040 px de área útil (container query). Coluna 1: quatro tiles de 52 px (o `UserAvatar` do admin a −5° e três tracejados, o primeiro com `Plus`; decorativos, `aria-hidden`), eyebrow "Último passo", `<h2>` "Convide sua equipe" (26 px; 22 px no celular), o texto (máx. 440 px), o link `on-pastel` "Gerar convites" (`/admin/equipe`) e o botão `on-pastel-secondary` "Agora não" (20px de padding; um `<form action={dismissInviteCardAction}>`: a ação da Task 10 devolve `void`, grava o cookie `closery-convite-dispensado` e atualiza a tela; nada de `"use server"` inline no componente, que o `actionsGuards.test.ts` recusaria). Coluna 2: bloco `bg-on-pastel-soft` "Cadastros" com 5 linhas de no mínimo 44 px (Setores, Turnos, Itens, Destinos com "{n} ativo(s)"; Equipe "{n} pessoa(s) ativa(s)", via `pluralize`). O indicador de 24 px vem preenchido com `Check` quando o cadastro tem ao menos um ativo (`data-done`) e tracejado vazio quando não (a Equipe nunca vem marcada); o texto "Feito"/"Falta fazer" é só para leitor de tela.
- **Usa:** `Card`, `Button`, `buttonVariants`, `UserAvatar`, `pluralize`, tokens `invite`, `on-pastel*`, `on-invite-*`.
- **Histórico:** 2026-11-27 — criado no visual novo do Início (Task 14).

### AppError e AppNotFound
```

b) `HomeCards` (entrada nova, junto do `ShiftProgressBar` da Task 12, antes de `### HomeHandovers`). Edit com `old_string` `### HomeHandovers\n- **Status:** ✅ pronto (2026-11-21)` e `new_string`:

```
### HomeCards
- **Status:** ✅ pronto (2026-11-27)
- **Local:** `src/components/passagens/HomeCards.tsx` (server-safe)
- **Propósito:** os cartões do Início depois do hero, numa peça só (o `HomeHandovers` lê os dados; este desenha).
- **Como funciona:** coluna com gap 16: `InviteTeamCard` (se `inviteCounts` não for nulo), `PendingHandoverCard` (se houver) e uma linha em grid com `MyShiftCard` e `RequestsHomeCard`. A linha é `grid-cols-[minmax(0,1fr)]` e vira `minmax(0,1.3fr) minmax(0,1fr)` com `@min-[1040px]/main:` (área útil do `@container/main`, não a janela). Gera no servidor os avatares (`avatarDataUri`): quem entregou (`deliveredById`), quem salvou o rascunho (`saved.byId`) e quem está logado (`actorId`: convite e solicitações vazias). Admin leva `?setor=` nos links.
- **Usa:** `InviteTeamCard`, `PendingHandoverCard`, `MyShiftCard`, `RequestsHomeCard`, `avatarDataUri`, `requestsHref`.
- **Histórico:** 2026-11-27 — criado no visual novo do Início (Task 14).

### HomeHandovers
- **Status:** ✅ pronto (2026-11-21)
```

c) `HomeHandovers`: o Histórico (já ampliado na Task 12) ganha, ao fim da linha: ` 2026-11-27 — visual novo do Início (Task 14): lê \`getAdminOverviewCounts\` (só admin) e o cookie de dispensa, calcula o primeiro acesso com \`shouldShowInviteCard\` e entrega o JSX dos cartões ao \`HomeCards\`; o cartão "Convide sua equipe" abre a lista.` Ajuste também o "Como funciona" da entrada: a frase "Ordem: \`PendingHandoverCard\` (se houver) e \`MyShiftCard\`. Depois deles vem o \`RequestsHomeCard\`" passa a "Ordem (no \`HomeCards\`): \`InviteTeamCard\` (admin sozinho, sem convites e sem o cookie de dispensa), \`PendingHandoverCard\` (se houver) e, lado a lado, \`MyShiftCard\` e \`RequestsHomeCard\`".

d) Outros componentes tocados: `E2E` não tem entrada no registro.

- [ ] **Step 17: Commit**

Write `.git/sdd/visual/msg-task-14.txt`:

```
feat(inicio): cartão Convide sua equipe, grid dos cartões e E2E do Início

InviteTeamCard com a checklist de cadastros e "Agora não" por Server
Action (cookie de dispensa). HomeCards concentra o grid: convite, pendente
e turno + solicitações lado a lado a partir de 1040px de área útil. O
HomeHandovers calcula o primeiro acesso. E2E novo (primeiro acesso, dispensa
que sobrevive ao recarregar, tema escuro padrão com switch persistente) e o
guarda de toque passa a medir o Início novo e a linha de solicitação.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Run: `git add src/components/app-shell/InviteTeamCard.tsx src/components/app-shell/InviteTeamCard.test.tsx src/components/passagens/HomeCards.tsx src/components/passagens/HomeCards.test.tsx src/components/passagens/HomeHandovers.tsx src/components/passagens/HomeHandovers.test.tsx e2e/db.ts e2e/inicio.spec.ts e2e/touch-targets.spec.ts .context/ui-registry.md && git commit -F .git/sdd/visual/msg-task-14.txt`

---

### Task 15: Passe de legibilidade nas outras telas (controlador)

Esta tarefa é conduzida pelo controlador (ou por um subagente com o Playwright MCP), depois das Tasks 1–14. Ela **não** redesenha nenhuma tela: corrige só o que ficou ilegível ou quebrado nas telas que ainda não têm handoff, agora na paleta nova, com o tema escuro padrão, botões em pílula e "celular" abaixo de 860px.

**Files:**
- Modify: só os componentes em que o passe achar defeito (lista registrada no relatório)
- Create: `.git/sdd/visual/legibilidade.md` (relatório, fora do git)

**Interfaces:**
- Consumes: tudo das Tasks 1–14.
- Produces: nada novo; correções pontuais e as pendências para os próximos handoffs.

- [ ] **Step 1: Subir o banco de teste e o app em modo dev, nunca na 3000**

O banco de teste local é o de `.git/sdd/manual/` (PGlite em disco, porta 54331). Se o `next start` da 3201 estiver no ar, derrube-o antes pelo PID de quem escuta a 3201 (nunca a 3000):

```bash
netstat -ano | grep -E ':(3201|54331)\s' | grep LISTEN
```

Num shell só, a partir da raiz do repositório:

```bash
. .git/sdd/manual/env.sh && bun .git/sdd/manual/start-db.ts > .git/sdd/manual/db.log 2>&1 &
```

Espere `banco do teste manual pronto` em `.git/sdd/manual/db.log`. Depois, em segundo plano:

```bash
. .git/sdd/manual/env.sh && bun run dev -- -p 3201 > .git/sdd/visual/dev.log 2>&1
```

Expected: `predev` roda `bun run fonts` ("Satoshi já está em src/fonts/satoshi" ou o download conferido) e o log mostra `Ready`. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3201/api/health` → `200`.

- [ ] **Step 2: Capturar as telas sem handoff nos dois temas e nos dois tamanhos**

Com o Playwright MCP (ou um script), entre como administrador e como operador e capture, em 1440×900 e 390×844, no tema escuro e no claro, estas telas: `/entrar`, `/convite/<token inválido>`, `/redefinir-senha`, `/privacidade`, `/bem-vindo`, `/passagens`, a nova passagem (`/passagens/nova?...` pelo botão "Começar passagem"), o detalhe de uma passagem, `/solicitacoes` (quadro e tabela), o detalhe de uma solicitação (sheet), `/dashboard`, `/conta`, `/admin` e as cinco telas de cadastro. Grave em `.git/sdd/visual/legibilidade/<tela>-<tema>-<tamanho>.png` (fora do git).

- [ ] **Step 3: Classificar o que está quebrado**

Para cada captura, anote em `.git/sdd/visual/legibilidade.md` só o que é defeito:
- texto com contraste abaixo de 4.5:1 (meça com o DevTools ou com os valores dos tokens);
- borda ou campo invisível (ex.: `input` sem contorno no escuro);
- fundo claro fixo que sobrou no escuro (ou o contrário);
- controle com alvo menor que 44px abaixo de 860px;
- layout quebrado na faixa de 768–860px (que passou a ser "celular").

O que for só "layout antigo" (não é defeito) vai para a lista de pendências dos próximos handoffs (Task 17), não é corrigido aqui.

- [ ] **Step 4: Corrigir cada defeito com teste**

Para cada defeito: escreva primeiro o teste que falha (o de contraste em `src/app/themeContrast.test.ts` para um par de tokens, ou um teste do componente para a classe/estrutura), corrija só com tokens, rode o teste do arquivo e o `bun run lint`. Um commit por tela, mensagem em `.git/sdd/visual/msg-task-15-<tela>.txt`:

```text
fix(visual): <tela> legível no tema escuro

<o que estava quebrado e o que mudou>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

- [ ] **Step 5: Conferir e fechar**

Recapture as telas corrigidas e compare com as do Step 2. Rode `bun run check-types`, `bun run lint` e os testes dos arquivos tocados. Expected: verdes; o relatório lista cada defeito com o commit que o corrigiu.

### Task 16: Verificação pixel perfect contra o protótipo (controlador)

**Files:**
- Create (fora do git): `.git/sdd/visual/tools/package.json`, `.git/sdd/visual/tools/capture.mjs`, `.git/sdd/visual/tools/diff.mjs`, `.git/sdd/visual/proto/` (cópias do protótipo por estado), `.git/sdd/visual/pares/` (capturas e diferenças), `.git/sdd/visual/pixel.md` (relatório)
- Modify: os componentes das Tasks 9–14 onde houver diferença

**Interfaces:**
- Consumes: tudo das Tasks 1–14; o banco de teste local e o `next dev` da Task 15 (Step 1).
- Produces: o relatório `pixel.md` com cada par, a diferença medida e o que foi corrigido ou aceito.

- [ ] **Step 1: Preparar as cópias do protótipo com nomes fictícios**

Copie `.git/sdd/visual/handoff/Inicio.dc.html` e `support.js` para `.git/sdd/visual/proto/`. Na cópia, troque **todos** os nomes e e-mails de exemplo por fictícios: o administrador vira "Ana Teste" (`ana.teste@example.com`), quem entrega vira "Bruno Teste", a operadora vira "Carla Teste" e quem confirma vira "Diego Teste" (procure com `grep -n "por \|Olá\|@" .git/sdd/visual/proto/Inicio.dc.html` e troque cada ocorrência, inclusive as sementes do avatar na URL do DiceBear do protótipo, que passam a ser os ids dos usuários fictícios do banco de teste — veja o Step 2). Os estados ficam nos `default` do JSON em `data-props` (linha do `<script type="text/x-dc" data-dc-script data-props=...>`): para cada estado da tabela abaixo, gere uma cópia `proto-<estado>.html` trocando os `default`.

| Estado | tema | perfil | primeiroAcesso | turno | pendente | solicitacoes | Screenshot de referência |
|---|---|---|---|---|---|---|---|
| admin-escuro | Escuro | Administrador | false | Começar | true | Paradas | 01, 02 |
| admin-claro | Claro | Administrador | false | Começar | true | Paradas | 03, 04 |
| primeiro-escuro | Escuro | Administrador | true | Começar | false | Vazio | 05, 06 |
| primeiro-claro | Claro | Administrador | true | Começar | false | Vazio | 07, 08 |
| continuar | Escuro | Administrador | false | Continuar rascunho | false | Vazio | 09 |
| entregue | Escuro | Administrador | false | Entregue | false | Paradas | 10 |
| confirmada-operador | Claro | Colega | false | Confirmada | false | Paradas | 11 |
| sem-turnos | Escuro | Administrador | false | Sem turnos | false | Paradas | 12 |

(`tela` fica `Auto` em todos; o tamanho de celular vem do viewport.)

- [ ] **Step 2: Semear o banco de teste com os mesmos dados**

Com o app da Task 15 no ar, monte pelo próprio app (como administrador) ou por um script em `.git/sdd/visual/tools/seed.mjs` que usa os helpers de `test/fixtures.ts`, o mundo do protótipo: setores ULD (lilac), Carga (peach), Operações (sky) e Eco (green); Turno 1 06:00–14:00, Turno 2 14:00–22:00 e Turno 3 22:00–06:00 no ULD; as pessoas fictícias do Step 1; a passagem pendente do Turno 3 entregue por "Bruno Teste" com o texto do "Fica para o próximo turno" do protótipo; três solicitações abertas e paradas com os textos e destinos do protótipo. Cada estado da tabela do Step 1 vira um estado do banco (ex.: para `continuar`, um rascunho salvo; para `primeiro-*`, um banco só com o administrador e sem convites). Registre no `pixel.md` como reproduzir cada estado.

- [ ] **Step 3: Ferramentas de captura e diferença (fora do repositório)**

```bash
mkdir -p .git/sdd/visual/tools && cd .git/sdd/visual/tools && printf '{"name":"visual-tools","private":true,"type":"module"}' > package.json && bun add pixelmatch@7.2.0 pngjs@7.0.0
```

`capture.mjs` usa o `@playwright/test` do repositório (`chromium.launch()`), recebe a URL, o viewport (`1440x900` ou `390x844`), o tema e o caminho de saída, espera as fontes (`document.fonts.ready`) e tira o print da página inteira; para o protótipo, captura só o elemento da janela do app (leia a marcação da cópia para achar o seletor da moldura) no mesmo tamanho. `diff.mjs` lê dois PNG, recorta para o menor tamanho comum, aplica máscaras (retângulos da hora e da barra do turno, que dependem do "agora") e grava o PNG de diferença e a porcentagem de pixels diferentes (`pixelmatch` com `threshold: 0.1`).

- [ ] **Step 4: Capturar os pares e medir**

Para cada estado e cada tamanho (1440×900 e 390×844), capture o protótipo e o app e rode o `diff.mjs`. Grave em `.git/sdd/visual/pares/<estado>-<tamanho>-{proto,app,diff}.png` e a porcentagem no `pixel.md`. Expected na primeira rodada: diferenças visíveis; o objetivo é zerar as diferenças de layout (posição, tamanho, cor, raio, tipografia).

- [ ] **Step 5: Corrigir até bater**

Para cada diferença de layout: ache o valor na spec/protótipo, corrija o componente (só tokens e os valores da spec), recapture o par e meça de novo. Mudança que altera estrutura ou texto ganha teste do componente antes. Um commit por componente, mensagem em `.git/sdd/visual/msg-task-16-<componente>.txt`:

```text
fix(visual): <componente> igual ao protótipo

<o que estava diferente: valor antes → depois>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

Diferença que sobra por causa do motor (anti-aliasing da fonte, arredondamento de subpixel) é aceita e registrada no `pixel.md` com o motivo.

- [ ] **Step 6: Fechar**

Rode `bun run check-types`, `bun run lint` e os testes dos componentes tocados. Expected: verdes; o `pixel.md` tem todos os pares com a porcentagem final e os motivos das diferenças aceitas. Derrube o `next dev` e o banco de teste pelo PID de quem escuta a 3201 e a 54331 (nunca a 3000).

### Task 17: Documentos finais e migração no banco de dev (controlador)

**Files:**
- Modify: `.context/architecture.md` (ADR), `.context/ui-rules.md`, `.context/library-docs.md`, `.context/progress-tracker.md`, `.context/pendencias.md`, `memory.md`
- Test: `test/pendenciasDoc.test.ts`, `test/uiRegistryDoc.test.ts`

**Interfaces:**
- Consumes: tudo; os relatórios `legibilidade.md` e `pixel.md`.
- Produces: o estado documentado para a próxima sessão e o banco de dev migrado.

- [ ] **Step 1: ADR em `architecture.md`**

Acrescente no log de decisões uma entrada `### 2026-11-27 — Visual novo do Início e do shell` com **Decisão** (D-V1..3 e C-V1..8 da spec, a coluna `sector.color` com o check `sector_color_valid` e o backfill único, `next-themes`, Satoshi baixada no build, DiceBear no servidor), **Por quê** (handoff do dono; licença da Satoshi; regra "a cor pertence à entidade"), **Trade-offs aceitos** (as outras telas na paleta nova com o layout antigo; o build depende do Fontshare; ~22 KB de data URI por avatar; `ª`/`º` caem na fonte seguinte; a faixa 768–860px virou celular) e **Verificado** (os totais do portão final, preenchidos no fim). Atualize a seção de dados (`sector.color`) e a de UI se elas listarem tokens.

- [ ] **Step 2: `ui-rules.md` e `library-docs.md`**

`ui-rules.md`: tema escuro padrão com switch; botões e badges em pílula; "celular" abaixo de 860px; cards de destaque (`Card feature`) com as cores fixas e a regra do amarelo só para "precisa de atenção"; a cor do setor vem de `sector.color` (paleta fechada, nunca ciclada). `library-docs.md`: as seções já foram escritas pelas tarefas que trouxeram cada uma (17 Satoshi na Task 2, 18 `next-themes` na Task 3, 19 DiceBear na Task 8, 20 container queries na Task 9, todas antes de "Como adicionar uma biblioteca nova"); aqui só confira que a numeração ficou 17 a 20 sem buraco e acerte o que a verificação visual (Task 16) tiver ensinado (por exemplo, um corte de container query que mudou).

- [ ] **Step 3: Pendências**

Em `.context/pendencias.md`, com o próximo id livre e `Aberto, não triado`: o layout novo das outras telas (um item por grupo: autenticação, Passagens, Solicitações, Dashboard, Administração), cada defeito aceito do `legibilidade.md` que não foi corrigido, o peso do data URI dos avatares (trocar por rota com cache se pesar no celular), os glifos `ª`/`º` ausentes na Satoshi, e qualquer diferença aceita do `pixel.md` que mereça revisão. Ajuste a faixa do `test/pendenciasDoc.test.ts` se ele fixar o último id.

- [ ] **Step 4: Migração no banco de dev (host conferido)**

```bash
bun run db:hosts
```

Expected: o host das migrações começa com `ep-blue-voice`. Só então:

```bash
bun run db:migrate
```

Expected: a migração da cor do setor aplicada sem erro. Se o host for outro, **pare** e avise o dono.

- [ ] **Step 5: `progress-tracker.md`, `memory.md` e commit**

`progress-tracker.md`: uma seção "Visual novo (Início e shell)" com os itens entregues e os totais do portão. `memory.md`: o estado para a próxima sessão (o que foi feito, o que falta: os outros handoffs). Rode `bunx vitest run test/pendenciasDoc.test.ts test/uiRegistryDoc.test.ts`, `bun run check-types` e `bun run lint`. Commit com a mensagem em `.git/sdd/visual/msg-task-17.txt`:

```text
docs: visual novo do Início e do shell

ADR, regras de UI, bibliotecas, pendências dos próximos handoffs e o
estado da obra.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

### Task 18: Pack de correção do Início (cartão "Passagem do meu turno")

> **Spec:** §6.4.1. **Base:** `5bedc84` (Tasks 1–16 e a rodada de correções da revisão final). **Escopo:** os itens 1 a 4 do README do pack (`.git/sdd/visual/handoff-correcoes/README.md`; o protótipo `Inicio.dc.html` dele é lido como TEXTO). O item 5 (`HandoverDetail`) **não entra**: ele fica para o handoff "Passagem de turno", e a Task 17 o registra nas pendências, junto do grupo Passagens. Um implementador e uma revisão. Nada do pack com cara de pessoa real entra no repositório: nos testes, "Ana Teste", "Bia Teste" e "Bruno Teste".
>
> **Código conferido** em 2026-11-27, num worktree descartável sobre `5bedc84`. Com os Steps aplicados em sequência, ficam verdes o `check-types`, o Biome (`src` e `.context`) e os 14 arquivos de teste do Step 27. Os estados vermelhos dos Steps 6, 14 e 18 batem com os `Expected` (12, 7 e 5 falhas). Os contrastes impressos no Step 8 são os da lista.
>
> **Desvio de valor (spec §6.4.1):** a tinta do bloco "Confirmada" é `#123b27`, não o `#14402a` do handoff. O valor do handoff dá 4,41:1 no lilás e reprovaria o guarda de contraste.

**Files:**
- Create: `src/components/app-shell/AvatarStack.tsx` (pilha de avatares sobrepostos)
- Create: `src/components/app-shell/AvatarStack.test.tsx`
- Modify: `src/features/handovers/home.ts` (`MyShiftState` `delivered`/`confirmed` ganha `deliveredById`/`confirmedById`; o `loadMine` preenche os dois)
- Modify: `src/features/handovers/home.test.ts` (os ids nos testes `delivered` e `confirmed`)
- Modify: `src/app/globals.css` (tokens `--on-pastel-success*` no `:root` e no `@theme inline`; saem os `--pastel-*`)
- Modify: `src/app/themeContrast.test.ts` (tokens novos, os dois blocos de status sobre cada setor, caso negativo do `#14402a`; saem os pares `pastel-*`)
- Modify: `src/components/passagens/MyShiftCard.tsx` (reescrito: blocos de status e linha de entrega com avatar)
- Modify: `src/components/passagens/MyShiftCard.test.tsx` (fixtures com ids; testes novos de `delivered` e `confirmed`)
- Modify: `src/components/passagens/HomeCards.tsx` (gera os avatares de quem entregou e de quem confirmou)
- Modify: `src/components/passagens/HomeCards.test.tsx` (sementes dos avatares)
- Modify: `src/components/passagens/HomeHandovers.test.tsx` (integração: avatares da entregue e da confirmada)
- Modify: `src/components/ui/badge.tsx` (saem as variantes `pastel-pending` e `pastel-confirmed`)
- Modify: `src/components/ui/badge.test.tsx`
- Modify: `.context/ui-tokens.md` (tokens e contraste)
- Modify: `.context/ui-registry.md` (`AvatarStack` novo; `Badge`, `UserAvatar`, `MyShiftCard` e `HomeCards` mudam)

**Interfaces:**
- Consumes:
  - `UserAvatar` e `type UserAvatarSize` (`@/components/app-shell/UserAvatar`, Task 8): `{ src: string; size: 34 | 36 | 44 | 52 | 84; tilt?: number; frame?: "default" | "on-pastel"; className?: string }`. A inclinação vai em `style.transform`, e o `className` entra na moldura.
  - `avatarDataUri(seed: string): string` (`@/lib/avatar`, Task 8). Lança erro com semente vazia.
  - `MyShiftState` e `loadMine` (`@/features/handovers/home`, Task 10).
  - `MyShiftCard` (Task 12), `HomeCards` (Task 14) e o token `--on-pastel` (Task 1).
- Produces:
  - `MyShiftState`, estados `delivered`/`confirmed`: ganham `deliveredById: string` e `confirmedById: string | null`.
  - `export type StackedAvatar = { id: string; src: string; tilt?: number };`
  - `export function AvatarStack(props: { avatars: readonly StackedAvatar[]; size: UserAvatarSize; frame?: "default" | "on-pastel"; className?: string })`.
  - `MyShiftCard` ganha `deliveredAvatarSrc?: string | null` e `confirmedAvatarSrc?: string | null` (padrão `null`).
  - Tokens `--on-pastel-success-soft` e `--on-pastel-success`, com os utilitários `bg-on-pastel-success-soft` e `text-on-pastel-success`.
  - Remove: as variantes `pastel-pending` e `pastel-confirmed` do `Badge`; os tokens `--pastel-pending`, `--pastel-pending-foreground`, `--pastel-confirmed` e `--pastel-confirmed-foreground`, com os `--color-*` deles.

Testes existentes que mencionam o que esta task toca: o `grep -rlE "MyShiftCard|HomeCards|AvatarStack|UserAvatar|features/handovers/home\"|globals\.css|ui/badge\"" src test e2e` lista estes.
- **Mudam nos Steps abaixo:** `MyShiftCard.test.tsx`, `HomeCards.test.tsx`, `HomeHandovers.test.tsx`, `badge.test.tsx`, `home.test.ts` e `themeContrast.test.ts`.
- **Só rodam no Step 27:** `UserAvatar.test.tsx`, `PendingHandoverCard.test.tsx`, `chartPalette.test.ts`, `colors.test.ts`, `test/fontsConfig.test.ts`, `rawColors.test.ts` e `test/uiRegistryDoc.test.ts`.
- **Nenhum E2E depende do selo antigo.** O `e2e/passagem.spec.ts` procura "Aguardando recebimento" e "Confirmada por …" no resumo da passagem, não no Início. A âncora `^Entregue às \d{2}:\d{2} por Ana Teste$` dele é a do `PendingHandoverCard`, que não muda.

- [ ] **Step 1: Dados — escrever o teste que falha**

Edit em `src/features/handovers/home.test.ts`, no teste "delivered: traz id, quem entregou e quando":

old_string:
```ts
      expect(mine).toMatchObject({
        kind: "delivered",
        handoverId: passagem.id,
        deliveredByName: "Ana Teste",
        deliveredAt: spDate("2026-11-21", "14:02"),
        confirmedByName: null,
        confirmedAt: null,
      });
```
new_string:
```ts
      expect(mine).toMatchObject({
        kind: "delivered",
        handoverId: passagem.id,
        // Semente do avatar da linha de entrega (spec §6.4.1).
        deliveredById: ana,
        deliveredByName: "Ana Teste",
        deliveredAt: spDate("2026-11-21", "14:02"),
        confirmedById: null,
        confirmedByName: null,
        confirmedAt: null,
      });
```

Edit no mesmo arquivo, no teste "confirmed: traz quem confirmou e quando":

old_string:
```ts
      expect(mine).toMatchObject({
        kind: "confirmed",
        confirmedByName: "Bia Teste",
        confirmedAt: spDate("2026-11-21", "14:04"),
      });
```
new_string:
```ts
      expect(mine).toMatchObject({
        kind: "confirmed",
        // As duas sementes da pilha de avatares (spec §6.4.1).
        deliveredById: ana,
        deliveredByName: "Ana Teste",
        confirmedById: bia,
        confirmedByName: "Bia Teste",
        confirmedAt: spDate("2026-11-21", "14:04"),
      });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bunx vitest run src/features/handovers/home.test.ts`
Expected: FAIL em "delivered: traz id, quem entregou e quando" e em "confirmed: traz quem confirmou e quando" (`expected { … } to match object { … }`, porque faltam `deliveredById` e `confirmedById`). Os outros testes passam.

- [ ] **Step 3: Implementar os ids no `MyShiftState` e no `loadMine`**

Edit em `src/features/handovers/home.ts` (o tipo):

old_string:
```ts
  | {
      kind: "delivered" | "confirmed";
      handoverId: string;
      ref: HandoverRef;
      shift: ShiftChoice;
      deliveredByName: string;
      deliveredAt: Date;
      confirmedByName: string | null;
      confirmedAt: Date | null;
    };
```
new_string:
```ts
  | {
      kind: "delivered" | "confirmed";
      handoverId: string;
      ref: HandoverRef;
      shift: ShiftChoice;
      // Ids para o avatar da linha de entrega (semente estável, spec §6.4.1).
      deliveredById: string;
      deliveredByName: string;
      deliveredAt: Date;
      confirmedById: string | null;
      confirmedByName: string | null;
      confirmedAt: Date | null;
    };
```

Edit no mesmo arquivo (o retorno do `loadMine`):

old_string:
```ts
    shift: chosen,
    deliveredByName:
      (row.deliveredBy === null ? undefined : people.get(row.deliveredBy)) ??
      "",
    deliveredAt: row.deliveredAt ?? row.updatedAt,
    confirmedByName:
```
new_string:
```ts
    shift: chosen,
    // O check handover_status_consistent garante quem entregou (e quem
    // confirmou, na confirmada). O "" é o mesmo fallback do nome, para uma
    // linha fora do check; o HomeCards não gera avatar com id vazio.
    deliveredById: row.deliveredBy ?? "",
    deliveredByName:
      (row.deliveredBy === null ? undefined : people.get(row.deliveredBy)) ??
      "",
    deliveredAt: row.deliveredAt ?? row.updatedAt,
    confirmedById: row.confirmedBy,
    confirmedByName:
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bunx vitest run src/features/handovers/home.test.ts`
Expected: PASS (o arquivo inteiro).

- [ ] **Step 5: Tokens — escrever o teste de contraste que falha**

São cinco Edits em `src/app/themeContrast.test.ts`.

a) Tokens do contrato. old_string:
```ts
  ...SECTOR_TOKENS,
  "pastel-pending",
  "pastel-pending-foreground",
  "pastel-confirmed",
  "pastel-confirmed-foreground",
];
```
new_string:
```ts
  ...SECTOR_TOKENS,
  "on-pastel-success",
  "on-pastel-success-soft",
];
```

b) Valores fixos. old_string:
```ts
  "sector-pink": "#f2a7c6",
  "pastel-pending": "#cbe4f6",
  "pastel-pending-foreground": "#1d4a72",
  "pastel-confirmed": "#d3eedd",
  "pastel-confirmed-foreground": "#1f5131",
};
```
new_string:
```ts
  "sector-pink": "#f2a7c6",
  // Bloco "Confirmada" do cartão de turno (spec §6.4.1). A tinta do handoff
  // (#14402a) dava 4,41:1 no lilás; o token é ela escurecida até passar.
  "on-pastel-success": "#123b27",
  "on-pastel-success-soft": "rgba(46, 125, 79, 0.22)",
};
```

c) Pares opacos. old_string:
```ts
  ["on-pastel-ink", "on-pastel"],
  ["pastel-pending-foreground", "pastel-pending"],
  ["pastel-confirmed-foreground", "pastel-confirmed"],
];
```
new_string:
```ts
  ["on-pastel-ink", "on-pastel"],
];
```

d) Blocos translúcidos: o "Confirmada" sobre cada setor. old_string:
```ts
  ["on-invite-soft", "on-pastel-soft", "invite"],
];
```
new_string:
```ts
  ["on-invite-soft", "on-pastel-soft", "invite"],
  // Bloco "Confirmada" do cartão de turno (§6.4.1), sobre a cor de cada setor.
  ...SECTOR_TOKENS.map((base): [string, string, string] => [
    "on-pastel-success",
    "on-pastel-success-soft",
    base,
  ]),
];
```

e) O bloco "Aguardando recebimento" (`on-pastel/10`, sem token próprio) e o caso negativo do verde do handoff. old_string:
```ts
  it("o bloco translúcido muda o fundo medido (compor não é no-op)", () => {
    const base = solid(fixed("sector-lilac"), "sector-lilac");
    expect(over(fixed("on-pastel-soft"), base)).not.toEqual(base);
  });
});
```
new_string:
```ts
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
 * O bloco "Aguardando recebimento" do cartão de turno (spec §6.4.1) é `bg-on-pastel/10`: o token
 * `on-pastel` com 10% de opacidade, sem token próprio. O guarda compõe essa mistura sobre a cor de
 * cada setor e mede a tinta `on-pastel`. O "Confirmada" está em OVERLAY_CASES, com os tokens dele.
 */
const PENDING_BLOCK_ALPHA = 0.1;

function pendingBlockRatio(base: string): number {
  const ink = solid(fixed("on-pastel"), "on-pastel");
  const block = over(
    { rgb: ink, alpha: PENDING_BLOCK_ALPHA },
    solid(fixed(base), base),
  );
  return contrast(ink, block);
}

describe("contraste do bloco 'Aguardando recebimento' (on-pastel/10 sobre a cor do setor)", () => {
  if (process.env.VITEST_PRINT_THEME_CONTRAST) {
    it("imprime a matriz medida", () => {
      const lines = SECTOR_TOKENS.map(
        (base) =>
          `on-pastel sobre on-pastel/10 em ${base}: ${pendingBlockRatio(base).toFixed(2)}:1`,
      );
      console.log(`\n[bloco Aguardando recebimento]\n${lines.join("\n")}`);
      expect(lines).toHaveLength(SECTOR_TOKENS.length);
    });
  }

  it.each(
    SECTOR_TOKENS,
  )("on-pastel sobre on-pastel/10 em cima de %s (≥4,5:1)", (base) => {
    const ratio = pendingBlockRatio(base);
    expect(
      ratio,
      `on-pastel sobre on-pastel/10 em ${base}: ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(TEXT_MIN);
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `bunx vitest run src/app/themeContrast.test.ts`
Expected: `12 failed`.
- Com "--on-pastel-success ausente em :root" e "--on-pastel-success-soft ausente em :root": estrutura, tabela das cores fixas, OVERLAY_CASES e o caso negativo.
- Também falham "a ponte --color-on-pastel-success existe no @theme inline" e "a ponte --color-on-pastel-success-soft existe no @theme inline".
- O bloco "Aguardando recebimento" já passa, porque usa o `--on-pastel` de hoje.

- [ ] **Step 7: Implementar os tokens**

Edit em `src/app/globals.css` (`@theme inline`):

old_string:
```css
  --color-sector-pink: var(--sector-pink);
  --color-pastel-pending: var(--pastel-pending);
  --color-pastel-pending-foreground: var(--pastel-pending-foreground);
  --color-pastel-confirmed: var(--pastel-confirmed);
  --color-pastel-confirmed-foreground: var(--pastel-confirmed-foreground);
```
new_string:
```css
  --color-sector-pink: var(--sector-pink);
  --color-on-pastel-success: var(--on-pastel-success);
  --color-on-pastel-success-soft: var(--on-pastel-success-soft);
```

Edit em `src/app/globals.css` (`:root`, no fim das cores fixas):

old_string:
```css
  --sector-pink: #f2a7c6;
  --pastel-pending: #cbe4f6;
  --pastel-pending-foreground: #1d4a72;
  --pastel-confirmed: #d3eedd;
  --pastel-confirmed-foreground: #1f5131;
}
```
new_string:
```css
  --sector-pink: #f2a7c6;
  /*
   * Bloco "Confirmada" do cartão de turno (spec §6.4.1): verde translúcido por cima da cor do
   * setor e a tinta verde-escura. A tinta do handoff dava 4,41:1 no lilás; esta passa (AA) nos
   * cinco setores. O "Aguardando recebimento" não tem token: é `bg-on-pastel/10`.
   */
  --on-pastel-success-soft: rgba(46, 125, 79, 0.22);
  --on-pastel-success: #123b27;
}
```

- [ ] **Step 8: Rodar e ver passar (e conferir os números)**

Run: `bunx vitest run src/app/themeContrast.test.ts src/app/chartPalette.test.ts src/features/sectors/colors.test.ts`
Expected: PASS nos três arquivos.

Run: `VITEST_PRINT_THEME_CONTRAST=1 bunx vitest run src/app/themeContrast.test.ts`
Expected: PASS, e o console imprime estes valores, que o Step 25 copia para o `ui-tokens.md`:
- `on-pastel sobre on-pastel/10 em sector-lilac|peach|sky|green|pink`: 6.56 · 8.08 · 8.02 · 8.54 · 7.61;
- `on-pastel-success sobre on-pastel-success-soft em sector-lilac|peach|sky|green|pink`: 4.71 · 5.61 · 5.69 · 6.01 · 5.29.

Se algum número sair diferente, use o impresso, nunca o desta lista.

- [ ] **Step 9: `AvatarStack` — escrever o teste que falha**

Write `src/components/app-shell/AvatarStack.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AvatarStack, type StackedAvatar } from "./AvatarStack";

const ENTREGOU: StackedAvatar = {
  id: "entregou",
  src: "data:image/svg+xml,ana",
  tilt: 3,
};
const CONFIRMOU: StackedAvatar = {
  id: "confirmou",
  src: "data:image/svg+xml,bruno",
  tilt: -4,
};
const TERCEIRA: StackedAvatar = {
  id: "terceira",
  src: "data:image/svg+xml,carla",
};

/** As molduras (o `div` do `UserAvatar`), na ordem do DOM. */
function framesOf(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll("img")).map((img) => {
    const frame = img.parentElement;
    if (!(frame instanceof HTMLElement)) throw new Error("moldura ausente");
    return frame;
  });
}

describe("AvatarStack", () => {
  it("lista vazia não desenha nada", () => {
    const { container } = render(<AvatarStack avatars={[]} size={36} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("um avatar: o invólucro não encolhe e centra, e o avatar fica por cima, sem recuo", () => {
    const { container } = render(
      <AvatarStack avatars={[ENTREGOU]} size={36} frame="on-pastel" />,
    );

    const stack = container.firstElementChild;
    expect(stack).toHaveAttribute("data-slot", "avatar-stack");
    expect(stack).toHaveClass("flex", "flex-none", "items-center");
    const [only, ...rest] = framesOf(container);
    expect(rest).toHaveLength(0);
    expect(only).toHaveClass("relative", "z-1", "size-[36px]", "bg-on-pastel");
    expect(only).not.toHaveClass("-ml-2");
    expect(only?.style.transform).toBe("rotate(3deg)");
  });

  it("dois avatares, na ordem recebida: o primeiro por cima (z-index 1) e o segundo 8px sobreposto, cada um com a sua inclinação", () => {
    const { container } = render(
      <AvatarStack
        avatars={[ENTREGOU, CONFIRMOU]}
        size={36}
        frame="on-pastel"
      />,
    );

    expect(
      Array.from(container.querySelectorAll("img")).map((img) =>
        img.getAttribute("src"),
      ),
    ).toEqual([ENTREGOU.src, CONFIRMOU.src]);
    const [first, second] = framesOf(container);
    expect(first).toHaveClass("relative", "z-1");
    expect(first).not.toHaveClass("-ml-2");
    expect(second).toHaveClass("-ml-2");
    expect(second).not.toHaveClass("z-1");
    expect(first?.style.transform).toBe("rotate(3deg)");
    expect(second?.style.transform).toBe("rotate(-4deg)");
  });

  it("três ou mais: o primeiro continua por cima e todos depois dele recuam 8px; sem tilt, sem transform", () => {
    const { container } = render(
      <AvatarStack avatars={[ENTREGOU, CONFIRMOU, TERCEIRA]} size={34} />,
    );

    const frames = framesOf(container);
    expect(frames).toHaveLength(3);
    expect(frames[0]).toHaveClass("relative", "z-1");
    expect(frames[1]).toHaveClass("-ml-2");
    expect(frames[2]).toHaveClass("-ml-2");
    expect(frames[2]?.style.transform).toBe("");
  });

  it("sem frame, a moldura é a padrão (bg-frame); o tamanho chega a todos", () => {
    const { container } = render(
      <AvatarStack avatars={[ENTREGOU, CONFIRMOU]} size={44} />,
    );

    for (const frame of framesOf(container)) {
      expect(frame).toHaveClass("bg-frame", "size-[44px]");
      expect(frame).not.toHaveClass("bg-on-pastel");
    }
  });

  it("className de quem usa entra no invólucro sem perder as classes fixas", () => {
    const { container } = render(
      <AvatarStack avatars={[ENTREGOU]} size={36} className="mt-1" />,
    );

    expect(container.firstElementChild).toHaveClass(
      "mt-1",
      "flex",
      "flex-none",
      "items-center",
    );
  });

  it("é decorativa: nenhuma imagem na árvore de acessibilidade (o nome está no texto ao lado)", () => {
    const { container, queryByRole } = render(
      <AvatarStack avatars={[ENTREGOU, CONFIRMOU]} size={36} />,
    );

    expect(queryByRole("img")).toBeNull();
    for (const img of Array.from(container.querySelectorAll("img"))) {
      expect(img).toHaveAttribute("alt", "");
    }
  });
});
```

- [ ] **Step 10: Rodar e ver falhar**

Run: `bunx vitest run src/components/app-shell/AvatarStack.test.tsx`
Expected: FAIL com `Failed to resolve import "./AvatarStack"`.

- [ ] **Step 11: Implementar o `AvatarStack`**

Write `src/components/app-shell/AvatarStack.tsx`:

```tsx
import { cn } from "cn";

import { UserAvatar, type UserAvatarSize } from "./UserAvatar";

export type StackedAvatar = {
  // Chave React: estável e única na pilha (o papel da pessoa ou o id dela).
  id: string;
  // Data URI de `avatarDataUri(userId)` (src/lib/avatar.ts), gerado no servidor.
  src: string;
  // Inclinação em graus; sem ela, o avatar fica reto.
  tilt?: number;
};

// Avatares sobrepostos numa linha de texto (pack de correção do Início, spec
// §6.4.1). Na ordem recebida: o primeiro fica por cima de todos (`relative
// z-1`, o `z-index: 1` do protótipo) e cada um depois dele entra 8px por baixo
// do anterior (`-ml-2`). Decorativo como o `UserAvatar`: o nome das pessoas
// está no texto ao lado. Lista vazia não desenha nada.
export function AvatarStack({
  avatars,
  size,
  frame = "default",
  className,
}: {
  avatars: readonly StackedAvatar[];
  size: UserAvatarSize;
  frame?: "default" | "on-pastel";
  className?: string;
}) {
  if (avatars.length === 0) return null;
  return (
    <div
      data-slot="avatar-stack"
      className={cn("flex flex-none items-center", className)}
    >
      {avatars.map((avatar, index) => (
        <UserAvatar
          key={avatar.id}
          src={avatar.src}
          size={size}
          tilt={avatar.tilt}
          frame={frame}
          className={index === 0 ? "relative z-1" : "-ml-2"}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 12: Rodar e ver passar**

Run: `bunx vitest run src/components/app-shell/AvatarStack.test.tsx src/components/app-shell/UserAvatar.test.tsx`
Expected: PASS (7 testes do `AvatarStack`; o `UserAvatar` sem mudança).

- [ ] **Step 13: `MyShiftCard` — escrever os testes que falham**

São seis Edits em `src/components/passagens/MyShiftCard.test.tsx`.

a) Os avatares de entrega. old_string:
```tsx
const AVATAR = "data:image/svg+xml,rascunho";
```
new_string:
```tsx
const AVATAR = "data:image/svg+xml,rascunho";
const DELIVERED_AVATAR = "data:image/svg+xml,entregou";
const CONFIRMED_AVATAR = "data:image/svg+xml,confirmou";
```

b) As fixtures ganham os ids. old_string:
```tsx
const DELIVERED: MyShiftState = {
  kind: "delivered",
  handoverId: "h1",
  ref: REF,
  shift: SHIFT,
  deliveredByName: "Ana Teste",
  deliveredAt: spDate("2026-11-20", "14:05"),
  confirmedByName: null,
  confirmedAt: null,
};
const CONFIRMED: MyShiftState = {
  kind: "confirmed",
  handoverId: "h1",
  ref: REF,
  shift: SHIFT,
  deliveredByName: "Ana Teste",
  deliveredAt: spDate("2026-11-20", "14:05"),
  confirmedByName: "Bia Teste",
  confirmedAt: spDate("2026-11-20", "14:20"),
};
```
new_string:
```tsx
const DELIVERED: MyShiftState = {
  kind: "delivered",
  handoverId: "h1",
  ref: REF,
  shift: SHIFT,
  deliveredById: "u-ana",
  deliveredByName: "Ana Teste",
  deliveredAt: spDate("2026-11-20", "14:05"),
  confirmedById: null,
  confirmedByName: null,
  confirmedAt: null,
};
const CONFIRMED: MyShiftState = {
  kind: "confirmed",
  handoverId: "h1",
  ref: REF,
  shift: SHIFT,
  deliveredById: "u-ana",
  deliveredByName: "Ana Teste",
  deliveredAt: spDate("2026-11-20", "14:05"),
  confirmedById: "u-bia",
  confirmedByName: "Bia Teste",
  confirmedAt: spDate("2026-11-20", "14:20"),
};
```

c) O `renderCard` passa as props novas (padrão sem avatar). old_string:
```tsx
      sectorParam={null}
      avatarSrc={null}
      {...props}
```
new_string:
```tsx
      sectorParam={null}
      avatarSrc={null}
      deliveredAvatarSrc={null}
      confirmedAvatarSrc={null}
      {...props}
```

d) Helpers, logo depois do `cardOf`. old_string:
```tsx
function cardOf(container: HTMLElement): HTMLElement {
  const card = container.querySelector('[data-slot="card"]');
  if (!(card instanceof HTMLElement)) throw new Error("cartão ausente");
  return card;
}
```
new_string:
```tsx
function cardOf(container: HTMLElement): HTMLElement {
  const card = container.querySelector('[data-slot="card"]');
  if (!(card instanceof HTMLElement)) throw new Error("cartão ausente");
  return card;
}

function parentOf(element: Element | undefined): HTMLElement {
  const parent = element?.parentElement;
  if (!(parent instanceof HTMLElement)) throw new Error("elemento sem pai");
  return parent;
}

function avatarsIn(element: Element): HTMLImageElement[] {
  return Array.from(element.querySelectorAll("img"));
}

/** `later` vem depois de `earlier` na ordem do documento (sem ser filho dele). */
function follows(earlier: Node, later: Node): boolean {
  return (
    earlier.compareDocumentPosition(later) === Node.DOCUMENT_POSITION_FOLLOWING
  );
}
```

e) Os testes de `delivered` e `confirmed` (selo) viram os do bloco e do avatar. old_string: os dois testes inteiros, do `it(` do primeiro até o `});` do segundo, logo antes de `it("confirmed sem quem confirmou nem hora: 'outra pessoa', sem inventar a hora"`:
```tsx
  it("delivered: selo 'Aguardando recebimento', quem entregou, link para a passagem e sem barra", () => {
    renderCard(DELIVERED);

    // Selo pastel no tamanho do protótipo (28px, 12px de padding, 13px).
    expect(screen.getByText("Aguardando recebimento")).toHaveClass(
      "bg-pastel-pending",
      "text-pastel-pending-foreground",
      "h-7",
      "px-3",
      "text-[13px]",
    );
    expect(screen.getByText("Aguardando recebimento")).not.toHaveClass("h-6");
    expect(
      screen.getByText(
        "Entregue às 14:05 por Ana Teste. Aguardando recebimento.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver passagem" })).toHaveAttribute(
      "href",
      "/passagens/h1",
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Turno sugerido pelo horário de agora."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Começar passagem" }),
    ).not.toBeInTheDocument();
  });

  it("confirmed: selo 'Confirmada', entrega e confirmação com nomes e horas", () => {
    renderCard(CONFIRMED);

    expect(screen.getByText("Confirmada")).toHaveClass(
      "bg-pastel-confirmed",
      "text-pastel-confirmed-foreground",
      "h-7",
    );
    expect(
      screen.getByText(
        "Entregue por Ana Teste às 14:05. Confirmada por Bia Teste às 14:20.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver passagem" })).toHaveAttribute(
      "href",
      "/passagens/h1",
    );
  });
```
new_string:
```tsx
  it("delivered: bloco 'Aguardando recebimento' de largura inteira, sem selo, com ícone decorativo", () => {
    const { container } = renderCard(DELIVERED);

    // Pack de correção (spec §6.4.1): bloco, não mais o selo em pílula.
    const block = screen.getByText("Aguardando recebimento");
    expect(block.tagName).toBe("P");
    expect(block).toHaveClass(
      "flex",
      "items-center",
      "gap-2.5",
      "self-stretch",
      "rounded-[22px]",
      "px-[22px]",
      "py-[18px]",
      "font-heading",
      "text-base",
      "leading-[normal]",
      "font-bold",
      "bg-on-pastel/10",
      "text-on-pastel",
    );
    expect(block).not.toHaveClass("h-7");
    expect(block).not.toHaveClass("rounded-full");
    expect(container.querySelector('[data-slot="badge"]')).toBeNull();
    const icon = block.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveClass("size-[18px]", "shrink-0");
  });

  it("delivered: linha de entrega com o avatar de quem entregou (36px, +3°) e a frase em 15px/1.5", () => {
    renderCard(DELIVERED, { deliveredAvatarSrc: DELIVERED_AVATAR });

    const sentence = screen.getByText(
      "Entregue às 14:05 por Ana Teste. Aguardando recebimento.",
    );
    expect(sentence).toHaveClass("text-[15px]", "leading-normal");
    const line = parentOf(sentence);
    expect(line).toHaveClass("flex", "items-center", "gap-2.5");
    const [avatar, ...rest] = avatarsIn(line);
    expect(rest).toHaveLength(0);
    expect(avatar).toHaveAttribute("src", DELIVERED_AVATAR);
    expect(avatar).toHaveAttribute("alt", "");
    const frame = parentOf(avatar);
    expect(frame).toHaveClass("size-[36px]", "bg-on-pastel");
    expect(frame.style.transform).toBe("rotate(3deg)");
  });

  it("delivered: bloco, linha de entrega e ações nessa ordem; 12px entre o bloco e a linha; sem barra", () => {
    renderCard(DELIVERED, { deliveredAvatarSrc: DELIVERED_AVATAR });

    const block = screen.getByText("Aguardando recebimento");
    const line = parentOf(
      screen.getByText(
        "Entregue às 14:05 por Ana Teste. Aguardando recebimento.",
      ),
    );
    const group = parentOf(block);
    expect(parentOf(line)).toBe(group);
    expect(group).toHaveClass("flex", "flex-col", "items-start", "gap-3");
    const primary = screen.getByRole("link", { name: "Ver passagem" });
    expect(follows(block, line)).toBe(true);
    expect(follows(line, primary)).toBe(true);
    expect(primary).toHaveAttribute("href", "/passagens/h1");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Turno sugerido pelo horário de agora."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Começar passagem" }),
    ).not.toBeInTheDocument();
  });

  it("delivered sem avatar: a frase aparece sozinha, sem imagem nem pilha", () => {
    const { container } = renderCard(DELIVERED);

    expect(
      screen.getByText(
        "Entregue às 14:05 por Ana Teste. Aguardando recebimento.",
      ),
    ).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-slot="avatar-stack"]')).toBeNull();
  });

  it("delivered ignora o avatar de quem confirmou (ainda não houve confirmação)", () => {
    const { container } = renderCard(DELIVERED, {
      deliveredAvatarSrc: DELIVERED_AVATAR,
      confirmedAvatarSrc: CONFIRMED_AVATAR,
    });

    expect(avatarsIn(container).map((img) => img.getAttribute("src"))).toEqual([
      DELIVERED_AVATAR,
    ]);
  });

  it("confirmed: bloco verde 'Confirmada' de largura inteira, sem selo, com ícone decorativo", () => {
    const { container } = renderCard(CONFIRMED);

    const block = screen.getByText("Confirmada");
    expect(block.tagName).toBe("P");
    expect(block).toHaveClass(
      "flex",
      "items-center",
      "gap-2.5",
      "self-stretch",
      "rounded-[22px]",
      "px-[22px]",
      "py-[18px]",
      "font-heading",
      "text-base",
      "leading-[normal]",
      "font-bold",
      "bg-on-pastel-success-soft",
      "text-on-pastel-success",
    );
    expect(block).not.toHaveClass("bg-on-pastel/10");
    expect(block).not.toHaveClass("h-7");
    expect(container.querySelector('[data-slot="badge"]')).toBeNull();
    expect(block.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("confirmed: pilha com quem entregou por cima (+3°) e quem confirmou 8px por baixo (−4°), com nomes e horas", () => {
    renderCard(CONFIRMED, {
      deliveredAvatarSrc: DELIVERED_AVATAR,
      confirmedAvatarSrc: CONFIRMED_AVATAR,
    });

    const sentence = screen.getByText(
      "Entregue por Ana Teste às 14:05. Confirmada por Bia Teste às 14:20.",
    );
    expect(sentence).toHaveClass("text-[15px]", "leading-normal");
    const line = parentOf(sentence);
    expect(line).toHaveClass("flex", "items-center", "gap-2.5");
    expect(line.querySelector('[data-slot="avatar-stack"]')).not.toBeNull();
    const [delivered, confirmed, ...rest] = avatarsIn(line);
    expect(rest).toHaveLength(0);
    expect(delivered).toHaveAttribute("src", DELIVERED_AVATAR);
    expect(confirmed).toHaveAttribute("src", CONFIRMED_AVATAR);
    expect(parentOf(delivered)).toHaveClass(
      "relative",
      "z-1",
      "size-[36px]",
      "bg-on-pastel",
    );
    expect(parentOf(delivered).style.transform).toBe("rotate(3deg)");
    expect(parentOf(confirmed)).toHaveClass("-ml-2", "size-[36px]");
    expect(parentOf(confirmed).style.transform).toBe("rotate(-4deg)");

    const block = screen.getByText("Confirmada");
    expect(parentOf(line)).toBe(parentOf(block));
    expect(parentOf(block)).toHaveClass("flex-col", "items-start", "gap-3");
    expect(follows(block, line)).toBe(true);
    expect(screen.getByRole("link", { name: "Ver passagem" })).toHaveAttribute(
      "href",
      "/passagens/h1",
    );
  });

  it("confirmed sem o avatar de quem confirmou: só o de quem entregou, por cima e sem recuo", () => {
    const { container } = renderCard(CONFIRMED, {
      deliveredAvatarSrc: DELIVERED_AVATAR,
    });

    const [only, ...rest] = avatarsIn(container);
    expect(rest).toHaveLength(0);
    expect(only).toHaveAttribute("src", DELIVERED_AVATAR);
    expect(parentOf(only)).toHaveClass("relative", "z-1");
    expect(parentOf(only)).not.toHaveClass("-ml-2");
  });

  it("confirmed sem avatares: a frase inteira e nenhuma imagem", () => {
    const { container } = renderCard(CONFIRMED);

    expect(
      screen.getByText(
        "Entregue por Ana Teste às 14:05. Confirmada por Bia Teste às 14:20.",
      ),
    ).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
```

f) O guarda de cor do arquivo passa todos os avatares. old_string:
```tsx
      const { container, unmount } = renderCard(state, { avatarSrc: AVATAR });
```
new_string:
```tsx
      const { container, unmount } = renderCard(state, {
        avatarSrc: AVATAR,
        deliveredAvatarSrc: DELIVERED_AVATAR,
        confirmedAvatarSrc: CONFIRMED_AVATAR,
      });
```

O teste "confirmed sem quem confirmou nem hora: 'outra pessoa', sem inventar a hora" continua como está.

- [ ] **Step 14: Rodar e ver falhar**

Run: `bunx vitest run src/components/passagens/MyShiftCard.test.tsx`
Expected: `7 failed`.
- Os dois testes de bloco, "delivered: bloco 'Aguardando recebimento'…" e "confirmed: bloco verde 'Confirmada'…": as classes ainda são as do `Badge`.
- "delivered: linha de entrega com o avatar…", "delivered: bloco, linha de entrega e ações nessa ordem…", "delivered ignora o avatar de quem confirmou…", "confirmed: pilha com quem entregou por cima…" e "confirmed sem o avatar de quem confirmou…": nenhum `img`, e a frase ainda está no grupo, não numa linha própria.
- "delivered sem avatar" e "confirmed sem avatares" já passam, porque hoje não há avatar. Os outros 24 testes do arquivo também passam.

- [ ] **Step 15: Implementar o `MyShiftCard`**

Write `src/components/passagens/MyShiftCard.tsx` (arquivo inteiro):

```tsx
import { cn } from "cn";
import { ArrowRight, CircleCheck, Clock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  AvatarStack,
  type StackedAvatar,
} from "@/components/app-shell/AvatarStack";
import { UserAvatar } from "@/components/app-shell/UserAvatar";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MyShiftState } from "@/features/handovers/home";
import { formatDateBR, formatTimeBR } from "@/features/handovers/saoPaulo";
import { handoverHref, newHandoverHref } from "@/features/handovers/urls";
import { SECTOR_COLOR_BG, type SectorColor } from "@/features/sectors/colors";

import { ShiftProgressBar } from "./ShiftProgressBar";

// Protótipo: o primário dentro do card colorido tem 22px de padding (o do
// `pill`); o secundário, 20px (o `cn` troca o `px-[22px]` pelo `px-5`).
const PRIMARY = buttonVariants({ variant: "on-pastel", size: "pill" });
const SECONDARY = cn(
  buttonVariants({ variant: "on-pastel-secondary", size: "pill" }),
  "px-5",
);

// Bloco de status de `delivered` e `confirmed` (pack de correção, spec
// §6.4.1): largura inteira, no estilo do bloco "Fica para o próximo turno"
// (raio 22px, padding 18px 22px), Satoshi 700/16px e ícone de 18px. O tom
// escurece (`on-pastel/10`) ou esverdeia (`on-pastel-success-soft`) a cor do
// setor por cima, então serve para qualquer setor.
const STATUS_BLOCK =
  "flex items-center gap-2.5 self-stretch rounded-[22px] px-[22px] py-[18px] font-heading text-base leading-[normal] font-bold";

const STATUS_TONE = {
  pending: { className: "bg-on-pastel/10 text-on-pastel", Icon: Clock },
  confirmed: {
    className: "bg-on-pastel-success-soft text-on-pastel-success",
    Icon: CircleCheck,
  },
} as const;

// Inclinação dos avatares da linha de entrega (protótipo): +3° quem entregou,
// −4° quem confirmou.
const DELIVERED_TILT = 3;
const CONFIRMED_TILT = -4;

// 64px; 52px quando o cartão divide a linha com Solicitações e a área útil é
// menor que 1240px (container query do contêiner principal); 44px no celular.
const TIME_CLASS =
  "font-heading text-[64px] leading-none font-black tracking-[-0.035em] tabular-nums max-md:text-[44px] @min-[1040px]/main:@max-[1239px]/main:text-[52px]";

function Shell({
  color,
  sectorName,
  children,
}: {
  color: SectorColor;
  sectorName: string;
  children: ReactNode;
}) {
  return (
    <Card
      variant="feature"
      className={cn(
        "gap-[22px] text-on-pastel transition-colors duration-[450ms] motion-reduce:transition-none",
        SECTOR_COLOR_BG[color],
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 font-heading text-lg leading-[normal] font-bold">
          Passagem do meu turno
        </h2>
        <span
          title={sectorName}
          className="h-7 max-w-[55%] min-w-0 truncate rounded-full bg-on-pastel px-3 font-mono text-xs leading-7 font-medium tracking-[.04em] whitespace-nowrap text-on-pastel-ink"
        >
          {sectorName}
        </span>
      </div>
      {children}
    </Card>
  );
}

function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={PRIMARY}>
      {children}
      <ArrowRight aria-hidden="true" strokeWidth={2.2} />
    </Link>
  );
}

function Actions({ primary }: { primary: ReactNode }) {
  return (
    <div className="mt-auto flex flex-wrap gap-2.5">
      {primary}
      <Link href="/passagens" className={SECONDARY}>
        Ver todas as passagens
      </Link>
    </div>
  );
}

function StatusBlock({
  tone,
  children,
}: {
  tone: keyof typeof STATUS_TONE;
  children: ReactNode;
}) {
  const { className, Icon } = STATUS_TONE[tone];
  return (
    <p className={cn(STATUS_BLOCK, className)}>
      <Icon
        aria-hidden="true"
        strokeWidth={2.2}
        className="size-[18px] shrink-0"
      />
      {children}
    </p>
  );
}

// Linha de entrega: o avatar (ou a pilha) à esquerda e a frase à direita, em
// 15px/1.5. Sem avatar, a frase aparece sozinha.
function DeliveryLine({
  avatars,
  children,
}: {
  avatars: readonly StackedAvatar[];
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <AvatarStack avatars={avatars} size={36} frame="on-pastel" />
      <p className="text-[15px] leading-normal">{children}</p>
    </div>
  );
}

// Os avatares que existem, na ordem da pilha (quem entregou por cima).
function present(avatars: readonly (StackedAvatar | null)[]): StackedAvatar[] {
  return avatars.filter((avatar): avatar is StackedAvatar => avatar !== null);
}

export function MyShiftCard({
  state,
  sectorId,
  sectorName,
  sectorColor,
  canManageCatalog,
  sectorParam,
  avatarSrc = null,
  deliveredAvatarSrc = null,
  confirmedAvatarSrc = null,
}: {
  state: MyShiftState;
  sectorId: string;
  sectorName: string;
  sectorColor: SectorColor;
  canManageCatalog: boolean;
  sectorParam: string | null;
  // Avatar de quem salvou o rascunho (estado `continue`).
  avatarSrc?: string | null;
  // Avatares da linha de entrega (`delivered` e `confirmed`): quem entregou e
  // quem confirmou, data URIs gerados no servidor pelo `HomeCards`.
  deliveredAvatarSrc?: string | null;
  confirmedAvatarSrc?: string | null;
}) {
  if (state.kind === "no-shifts") {
    return (
      <Shell color={sectorColor} sectorName={sectorName}>
        <div className="flex flex-col gap-1.5">
          <p className="font-heading text-[32px] leading-[1.05] font-black tracking-[-0.02em]">
            Nenhum turno neste setor.
          </p>
          <p className="text-[15px] leading-[normal] text-on-pastel-muted">
            {canManageCatalog
              ? "Cadastre os turnos do setor para começar a passagem."
              : "Peça a um administrador para cadastrar os turnos do setor."}
          </p>
        </div>
        <Actions
          primary={
            canManageCatalog ? (
              <PrimaryLink href={`/admin/turnos?setor=${sectorId}`}>
                Ir para Turnos
              </PrimaryLink>
            ) : null
          }
        />
      </Shell>
    );
  }

  const { shift, ref } = state;
  const newHref = newHandoverHref(ref, sectorParam ?? undefined);
  const deliverer: StackedAvatar | null =
    deliveredAvatarSrc === null
      ? null
      : { id: "delivered", src: deliveredAvatarSrc, tilt: DELIVERED_TILT };
  const confirmer: StackedAvatar | null =
    confirmedAvatarSrc === null
      ? null
      : { id: "confirmed", src: confirmedAvatarSrc, tilt: CONFIRMED_TILT };

  return (
    <Shell color={sectorColor} sectorName={sectorName}>
      <div className="flex flex-col gap-1.5">
        <span className="font-heading text-xl leading-[normal] font-bold break-words">
          {shift.name}
        </span>
        <span className={TIME_CLASS}>
          {shift.startsAt}–{shift.endsAt}
        </span>
        <span className="mt-1 font-mono text-sm leading-[normal] font-medium text-on-pastel-muted">
          {formatDateBR(ref.operationalDate)}
        </span>
      </div>

      {(state.kind === "start" || state.kind === "continue") && (
        <div className="flex flex-col gap-2">
          <ShiftProgressBar progress={state.progress} />
          <p className="mt-0.5 text-[15px] leading-[normal] text-on-pastel-muted">
            Turno sugerido pelo horário de agora.
          </p>
        </div>
      )}

      {state.kind === "continue" && state.saved && (
        <div className="flex w-fit max-w-full items-center gap-2.5 rounded-[18px] bg-on-pastel-soft py-2.5 pr-3.5 pl-2.5">
          {avatarSrc !== null && (
            <UserAvatar src={avatarSrc} size={34} tilt={-3} frame="on-pastel" />
          )}
          <span className="text-[15px] leading-[normal]">
            Rascunho salvo às {formatTimeBR(state.saved.at)} por{" "}
            {state.saved.byName}
          </span>
        </div>
      )}

      {state.kind === "delivered" && (
        <div className="flex flex-col items-start gap-3">
          <StatusBlock tone="pending">Aguardando recebimento</StatusBlock>
          <DeliveryLine avatars={present([deliverer])}>
            Entregue às {formatTimeBR(state.deliveredAt)} por{" "}
            {state.deliveredByName}. Aguardando recebimento.
          </DeliveryLine>
        </div>
      )}

      {state.kind === "confirmed" && (
        <div className="flex flex-col items-start gap-3">
          <StatusBlock tone="confirmed">Confirmada</StatusBlock>
          <DeliveryLine avatars={present([deliverer, confirmer])}>
            Entregue por {state.deliveredByName} às{" "}
            {formatTimeBR(state.deliveredAt)}. Confirmada por{" "}
            {state.confirmedByName ?? "outra pessoa"}
            {state.confirmedAt ? ` às ${formatTimeBR(state.confirmedAt)}` : ""}.
          </DeliveryLine>
        </div>
      )}

      <Actions
        primary={
          state.kind === "start" ? (
            <PrimaryLink href={newHref}>Começar passagem</PrimaryLink>
          ) : state.kind === "continue" ? (
            <PrimaryLink href={newHref}>Continuar passagem</PrimaryLink>
          ) : state.kind === "delivered" || state.kind === "confirmed" ? (
            <PrimaryLink href={handoverHref(state.handoverId)}>
              Ver passagem
            </PrimaryLink>
          ) : null
        }
      />
    </Shell>
  );
}
```

O que mudou em relação ao arquivo da Task 12/16:
- sai o import do `Badge` e a constante `STATE_BADGE`;
- entram `STATUS_BLOCK`, `STATUS_TONE`, as duas inclinações e os componentes `StatusBlock`, `DeliveryLine` e `present`;
- entram as duas props novas;
- os ramos `delivered` e `confirmed` foram reescritos.

O resto é o mesmo texto de hoje.

- [ ] **Step 16: Rodar e ver passar**

Run: `bunx vitest run src/components/passagens/MyShiftCard.test.tsx src/components/app-shell/AvatarStack.test.tsx`
Expected: PASS (os dois arquivos inteiros).

- [ ] **Step 17: `HomeCards` e integração — escrever os testes que falham**

Edit em `src/components/passagens/HomeCards.test.tsx` (as fixtures de entrega, antes do `PENDING`):

old_string:
```tsx
const PENDING: PendingHandover = {
```
new_string:
```tsx
const DELIVERED: MyShiftState = {
  kind: "delivered",
  handoverId: "h2",
  ref: REF,
  shift: SHIFT,
  deliveredById: "u-ana",
  deliveredByName: "Ana Teste",
  deliveredAt: spDate("2026-11-20", "13:52"),
  confirmedById: null,
  confirmedByName: null,
  confirmedAt: null,
};
const CONFIRMED: MyShiftState = {
  kind: "confirmed",
  handoverId: "h2",
  ref: REF,
  shift: SHIFT,
  deliveredById: "u-ana",
  deliveredByName: "Ana Teste",
  deliveredAt: spDate("2026-11-20", "13:52"),
  confirmedById: "u-bruno",
  confirmedByName: "Bruno Teste",
  confirmedAt: spDate("2026-11-20", "14:06"),
};
const PENDING: PendingHandover = {
```

Edit no mesmo arquivo (testes novos no fim do `describe`):

old_string:
```tsx
    expect(
      screen.getByRole("link", { name: "Ver solicitações" }),
    ).toHaveAttribute("href", `/solicitacoes?setor=${SECTOR_ID}`);
  });
});
```
new_string:
```tsx
    expect(
      screen.getByRole("link", { name: "Ver solicitações" }),
    ).toHaveAttribute("href", `/solicitacoes?setor=${SECTOR_ID}`);
  });

  describe("avatares da linha de entrega do meu turno (spec §6.4.1)", () => {
    // As sementes (o mock devolve `data:image/svg+xml,<id>`), na ordem do DOM.
    function shiftCardAvatars(): (string | null)[] {
      const card = screen
        .getByRole("heading", { name: "Passagem do meu turno" })
        .closest('[data-slot="card"]');
      if (!(card instanceof HTMLElement)) {
        throw new Error("cartão do turno ausente");
      }
      return Array.from(card.querySelectorAll("img")).map((img) =>
        img.getAttribute("src"),
      );
    }

    it("entregue: o avatar usa o id de quem entregou", () => {
      renderCards({ home: home({ mine: DELIVERED }) });

      expect(shiftCardAvatars()).toEqual(["data:image/svg+xml,u-ana"]);
    });

    it("confirmada: a pilha traz quem entregou e depois quem confirmou, pelos ids", () => {
      renderCards({ home: home({ mine: CONFIRMED }) });

      expect(shiftCardAvatars()).toEqual([
        "data:image/svg+xml,u-ana",
        "data:image/svg+xml,u-bruno",
      ]);
    });

    it("confirmada sem o id de quem confirmou: só o avatar de quem entregou", () => {
      renderCards({
        home: home({ mine: { ...CONFIRMED, confirmedById: null } }),
      });

      expect(shiftCardAvatars()).toEqual(["data:image/svg+xml,u-ana"]);
    });

    it("id vazio de quem entregou (linha fora do check do banco): sem avatar, e a frase continua", () => {
      renderCards({
        home: home({ mine: { ...DELIVERED, deliveredById: "" } }),
      });

      expect(shiftCardAvatars()).toEqual([]);
      expect(
        screen.getByText(
          "Entregue às 13:52 por Ana Teste. Aguardando recebimento.",
        ),
      ).toBeInTheDocument();
    });

    it("começar passagem não tem linha de entrega nem avatar no cartão do turno", () => {
      renderCards();

      expect(shiftCardAvatars()).toEqual([]);
    });
  });
});
```

Edit em `src/components/passagens/HomeHandovers.test.tsx` (helper, antes do comentário do contador):

old_string:
```tsx
// O contador e a palavra são dois elementos (o número é grande).
```
new_string:
```tsx
// As sementes dos avatares do cartão "Passagem do meu turno", na ordem do DOM.
function shiftCardAvatars(): (string | null)[] {
  const card = screen
    .getByRole("heading", { name: "Passagem do meu turno" })
    .closest('[data-slot="card"]');
  if (!(card instanceof HTMLElement)) {
    throw new Error("cartão do turno não encontrado");
  }
  return Array.from(card.querySelectorAll("img")).map((img) =>
    img.getAttribute("src"),
  );
}

// O contador e a palavra são dois elementos (o número é grande).
```

Edit no mesmo arquivo (fim do teste "quem entregou não vê o cartão de confirmar, só o próprio turno aguardando", mais um teste novo da confirmada):

old_string:
```tsx
    expect(
      screen.getByText(
        "Entregue às 09:30 por Ana Teste. Aguardando recebimento.",
      ),
    ).toBeInTheDocument();
  });

  it("passagem entregue de outro setor não vaza para o cartão", async () => {
```
new_string:
```tsx
    expect(
      screen.getByText(
        "Entregue às 09:30 por Ana Teste. Aguardando recebimento.",
      ),
    ).toBeInTheDocument();
    // A linha de entrega leva o avatar de quem entregou (spec §6.4.1).
    expect(shiftCardAvatars()).toEqual([`data:image/svg+xml,${ana.id}`]);
  });

  it("confirmada: a linha do meu turno traz o avatar de quem entregou e depois o de quem confirmou", async () => {
    const { uld, shiftRow, ana, bia } = await setup();
    await insertHandover(db, {
      sectorId: uld.id,
      shiftId: shiftRow.id,
      operationalDate: TODAY,
      status: "confirmed",
      deliveredBy: ana.id,
      deliveredAt: spDate(TODAY, "09:30"),
      confirmedBy: bia.id,
      confirmedAt: spDate(TODAY, "09:45"),
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
    );

    await renderHome();

    expect(shiftCardAvatars()).toEqual([
      `data:image/svg+xml,${ana.id}`,
      `data:image/svg+xml,${bia.id}`,
    ]);
    expect(
      screen.getByText(
        "Entregue por Ana Teste às 09:30. Confirmada por Bia Teste às 09:45.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Confirmada")).toHaveClass(
      "bg-on-pastel-success-soft",
      "text-on-pastel-success",
    );
  });

  it("passagem entregue de outro setor não vaza para o cartão", async () => {
```

- [ ] **Step 18: Rodar e ver falhar**

Run: `bunx vitest run src/components/passagens/HomeCards.test.tsx src/components/passagens/HomeHandovers.test.tsx`
Expected: `5 failed`.
- No `HomeCards`: "entregue: o avatar usa o id de quem entregou", "confirmada: a pilha traz…" e "confirmada sem o id de quem confirmou…" (`expected [] to deeply equal [ … ]`).
- No `HomeHandovers`: "quem entregou não vê o cartão de confirmar…" e "confirmada: a linha do meu turno traz…".
- O motivo é um só: o `HomeCards` ainda não passa os avatares. "id vazio…" e "começar passagem…" já passam.

- [ ] **Step 19: Implementar o `HomeCards`**

Write `src/components/passagens/HomeCards.tsx` (arquivo inteiro):

```tsx
import {
  type InviteCounts,
  InviteTeamCard,
} from "@/components/app-shell/InviteTeamCard";
import { RequestsHomeCard } from "@/components/solicitacoes/RequestsHomeCard";
import type { HomeHandovers as HomeHandoversData } from "@/features/handovers/home";
import type { HomeRequests } from "@/features/requests/types";
import { requestsHref } from "@/features/requests/urls";
import { avatarDataUri } from "@/lib/avatar";

import { MyShiftCard } from "./MyShiftCard";
import { PendingHandoverCard } from "./PendingHandoverCard";

// O `avatarDataUri` recusa semente vazia. Quem entregou só vem vazio se a
// linha da passagem escapar do check do banco (spec §6.4.1); aí a frase
// aparece sem avatar.
function avatarOf(userId: string | null): string | null {
  return userId === null || userId === "" ? null : avatarDataUri(userId);
}

// Os cartões do Início, depois do hero. Em coluna, na ordem: convite (primeiro
// acesso do admin), pendente (se houver) e, na linha de baixo, turno e
// solicitações. Esta linha é 1 coluna e vira `minmax(0,1.3fr) minmax(0,1fr)` a
// partir de 1040px de ÁREA ÚTIL (container query do `@container/main`, não a
// largura da janela). Os avatares nascem aqui, no servidor, com o id da pessoa;
// os cartões só desenham o data URI que recebem. O `data-slot="home-cards"` é o
// ponto de extensão que a Task 11 criou (e testa) no `HomeHandovers`.
export function HomeCards({
  home,
  requests,
  sectorParam,
  canManageCatalog,
  actorId,
  inviteCounts,
  firstAccess,
}: {
  home: HomeHandoversData;
  requests: HomeRequests;
  sectorParam: string | null;
  canManageCatalog: boolean;
  actorId: string;
  // Não nulo = mostrar "Convide sua equipe" (admin, sozinho, não dispensado).
  inviteCounts: InviteCounts | null;
  // Primeiro acesso do admin (mesmo depois de dispensar o convite).
  firstAccess: boolean;
}) {
  const savedAvatar =
    home.mine.kind === "continue" && home.mine.saved
      ? avatarDataUri(home.mine.saved.byId)
      : null;
  // Linha de entrega do meu turno: quem entregou e, na confirmada, quem
  // confirmou (a pilha do `MyShiftCard`).
  const deliveredAvatar =
    home.mine.kind === "delivered" || home.mine.kind === "confirmed"
      ? avatarOf(home.mine.deliveredById)
      : null;
  const confirmedAvatar =
    home.mine.kind === "confirmed" ? avatarOf(home.mine.confirmedById) : null;

  return (
    <div data-slot="home-cards" className="flex flex-col gap-4">
      {inviteCounts && (
        <InviteTeamCard
          counts={inviteCounts}
          avatarSrc={avatarDataUri(actorId)}
        />
      )}
      {home.pending && (
        <PendingHandoverCard
          pending={home.pending}
          avatarSrc={avatarDataUri(home.pending.deliveredById)}
        />
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-4 @min-[1040px]/main:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <MyShiftCard
          state={home.mine}
          sectorId={home.sector.id}
          sectorName={home.sector.name}
          sectorColor={home.sector.color}
          canManageCatalog={canManageCatalog}
          sectorParam={sectorParam}
          avatarSrc={savedAvatar}
          deliveredAvatarSrc={deliveredAvatar}
          confirmedAvatarSrc={confirmedAvatar}
        />
        <RequestsHomeCard
          home={requests}
          allHref={requestsHref(sectorParam)}
          avatarSrc={avatarDataUri(actorId)}
          firstAccess={firstAccess}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 20: Rodar e ver passar**

Run: `bunx vitest run src/components/passagens/HomeCards.test.tsx src/components/passagens/HomeHandovers.test.tsx src/components/passagens/PendingHandoverCard.test.tsx`
Expected: PASS (os três arquivos inteiros).

- [ ] **Step 21: `Badge` — escrever o teste que falha**

São três Edits em `src/components/ui/badge.test.tsx`.

a) old_string:
```tsx
    ["neutral", "bg-accent", "text-foreground"],
    ["pastel-pending", "bg-pastel-pending", "text-pastel-pending-foreground"],
    [
      "pastel-confirmed",
      "bg-pastel-confirmed",
      "text-pastel-confirmed-foreground",
    ],
  ] as const)("variant=%s usa %s e %s", (variant, background, foreground) => {
```
new_string:
```tsx
    ["neutral", "bg-accent", "text-foreground"],
  ] as const)("variant=%s usa %s e %s", (variant, background, foreground) => {
```

b) old_string:
```tsx
    for (const variant of [
      "warning",
      "info",
      "success",
      "neutral",
      "pastel-pending",
      "pastel-confirmed",
    ] as const) {
```
new_string:
```tsx
    for (const variant of ["warning", "info", "success", "neutral"] as const) {
```

c) Teste novo, antes de "nenhuma variante usa hex cru…". old_string:
```tsx
  it("nenhuma variante usa hex cru nem cor crua do Tailwind", () => {
```
new_string:
```tsx
  it("as variantes pastel-pending e pastel-confirmed saíram (o cartão de turno usa blocos, spec §6.4.1)", () => {
    // @ts-expect-error variante removida no pack de correção do Início
    const pending = badgeVariants({ variant: "pastel-pending" });
    // @ts-expect-error variante removida no pack de correção do Início
    const confirmed = badgeVariants({ variant: "pastel-confirmed" });
    expect(pending).not.toMatch(/pastel/);
    expect(confirmed).not.toMatch(/pastel/);
  });

  it("nenhuma variante usa hex cru nem cor crua do Tailwind", () => {
```

O `@ts-expect-error` também é guarda no `check-types`: se alguém devolver a variante, o comentário fica sem erro e o `tsc` falha.

- [ ] **Step 22: Rodar e ver falhar**

Run: `bunx vitest run src/components/ui/badge.test.tsx`
Expected: FAIL em "as variantes pastel-pending e pastel-confirmed saíram…" (`expected '… bg-pastel-pending …' not to match /pastel/`).

- [ ] **Step 23: Remover as variantes**

Edit em `src/components/ui/badge.tsx`:

old_string:
```tsx
        neutral: "bg-accent text-foreground",
        // Sempre claros nos dois temas: ficam sobre o pastel do cartão de turno.
        "pastel-pending": "bg-pastel-pending text-pastel-pending-foreground",
        "pastel-confirmed":
          "bg-pastel-confirmed text-pastel-confirmed-foreground",
      },
```
new_string:
```tsx
        neutral: "bg-accent text-foreground",
      },
```

- [ ] **Step 24: Rodar, ver passar e conferir que nada mais usa os nomes antigos**

Run: `bunx vitest run src/components/ui/badge.test.tsx`
Expected: PASS.

Run: `grep -rn "pastel-pending\|pastel-confirmed\|pastel-pending-foreground\|pastel-confirmed-foreground" src test e2e`
Expected: só as 3 linhas do teste novo em `src/components/ui/badge.test.tsx` (o título e as duas chamadas). Nada em `globals.css`, `themeContrast.test.ts`, `badge.tsx` ou `MyShiftCard*`.

- [ ] **Step 25: Atualizar `.context/ui-tokens.md`**

Edit (seção "3. Cores fixas"):

old_string:
```markdown
| `pastel-pending` / `-foreground` | `#cbe4f6` / `#1d4a72` | badge "Aguardando recebimento" no cartão de turno |
| `pastel-confirmed` / `-foreground` | `#d3eedd` / `#1f5131` | badge "Confirmada" no cartão de turno |
```
new_string:
```markdown
| `on-pastel-success-soft` / `on-pastel-success` | `rgba(46,125,79,.22)` / `#123b27` | bloco "Confirmada" do cartão de turno (spec §6.4.1). O `#14402a` do handoff dava 4,41:1 no lilás e foi escurecido até passar |

**Bloco "Aguardando recebimento"** (spec §6.4.1): `bg-on-pastel/10`, o `on-pastel` com 10% de opacidade (= `rgba(28,27,25,.10)`), sem token próprio; o texto é `text-on-pastel`.
```

Edit (tabela "Par fixo"):

old_string:
```markdown
| `pastel-pending-foreground` · `pastel-confirmed-foreground` | 7,02 · 7,48 |
| o menor par sobre bloco translúcido (`on-pastel-muted` sobre `on-pastel-soft` em lilás) | 5,19 |
```
new_string:
```markdown
| `on-pastel` sobre `on-pastel/10` (bloco "Aguardando recebimento") em lilás · pêssego · azul · verde · rosa | 6,56 · 8,08 · 8,02 · 8,54 · 7,61 |
| `on-pastel-success` sobre `on-pastel-success-soft` (bloco "Confirmada") em lilás · pêssego · azul · verde · rosa | 4,71 · 5,61 · 5,69 · 6,01 · 5,29 |
| o menor par sobre bloco translúcido (`on-pastel-success` sobre `on-pastel-success-soft` em lilás) | 4,71 |
```

Os números são os do Step 8. Se o impresso diferir, use o impresso.

Run: `grep -n "pastel-pending\|pastel-confirmed" .context/ui-tokens.md`
Expected: nenhuma linha.

- [ ] **Step 26: Atualizar `.context/ui-registry.md`**

Antes de editar, anote a contagem de cabeçalhos:

Run: `grep -c "^### " .context/ui-registry.md`
Expected: `158`.

a) `Badge`, "Como funciona". old_string:
```markdown
  `neutral` (`bg-accent text-foreground`), `pastel-pending` e `pastel-confirmed` (claros nos dois
  temas, para o cartão de turno). `size`:
```
new_string:
```markdown
  `neutral` (`bg-accent text-foreground`). `size`:
```

b) `Badge`, "Usa". old_string:
```markdown
- **Usa:** tokens `primary`, `secondary`, `destructive`, `warning`, `info`, `success`, `accent`, `pastel-pending`, `pastel-confirmed`.
```
new_string:
```markdown
- **Usa:** tokens `primary`, `secondary`, `destructive`, `warning`, `info`, `success`, `accent`.
```

c) `Badge`, "Histórico" (fim da linha). old_string:
```markdown
e `leading-[normal]` (o texto ficava até 0,8px acima do centro do protótipo).
```
new_string:
```markdown
e `leading-[normal]` (o texto ficava até 0,8px acima do centro do protótipo). 2026-11-27 — Pack de correção do Início (Task 18, spec §6.4.1): saem as variantes `pastel-pending` e `pastel-confirmed` e os tokens delas (o cartão de turno passou a usar blocos de largura inteira).
```

d) `UserAvatar`, "Histórico", e a entrada nova `AvatarStack` logo depois. old_string:
```markdown
- **Histórico:** 2026-11-27 — criado no visual novo do Início (Task 8).

### InviteTeamCard
```
new_string:
```markdown
- **Histórico:** 2026-11-27 — criado no visual novo do Início (Task 8). 2026-11-27 — Pack de correção (Task 18): também na linha de entrega do `MyShiftCard` (36 px, +3° quem entregou, −4° quem confirmou), pelo `AvatarStack`.

### AvatarStack
- **Status:** ✅ pronto (2026-11-27)
- **Local:** `src/components/app-shell/AvatarStack.tsx` (sem `"use client"`, sem `server-only`: só desenha)
- **Propósito:** avatares sobrepostos de mais de uma pessoa numa linha de texto (hoje, quem entregou e quem confirmou, no `MyShiftCard`).
- **Como funciona:** props `{ avatars: { id, src, tilt? }[], size: UserAvatarSize, frame?: "default" | "on-pastel", className? }`. Invólucro `flex flex-none items-center` (`data-slot="avatar-stack"`) com um `UserAvatar` por item, na ordem recebida: o primeiro com `relative z-1` (fica por cima, como o `z-index: 1` do protótipo) e cada um depois dele com `-ml-2` (8 px por baixo do anterior). `id` é a chave React (estável e única na pilha: o papel ou o id da pessoa). Lista vazia não desenha nada. Decorativo: as imagens têm `alt=""` e o nome das pessoas está no texto ao lado.
- **Usa:** `UserAvatar`.
- **Histórico:** 2026-11-27 — criado no pack de correção do Início (Task 18).

### InviteTeamCard
```

e) `MyShiftCard`, "Como funciona" (só o trecho dos estados `delivered` e `confirmed`). old_string:
```markdown
; os selos pastel ficam no tamanho do protótipo (`h-7 px-3 text-[13px]`, ícone de 14px, por `className` sobre o `size="md"`); `delivered` → `Badge pastel-pending` (`Clock`) "Aguardando recebimento" e "Entregue às … Aguardando recebimento." + "Ver passagem"; `confirmed` → `Badge pastel-confirmed` (`CircleCheck`) "Confirmada" e "Entregue por … Confirmada por …" + "Ver passagem"; `no-shifts`
```
new_string:
```markdown
; `delivered` → bloco de largura inteira "Aguardando recebimento" (`<p>` `self-stretch`, raio 22 px, padding 18/22 px, Satoshi 700/16 px, `Clock` de 18 px `aria-hidden`, `bg-on-pastel/10` e `text-on-pastel`) e, 12 px abaixo, a linha de entrega (`flex items-center gap-2.5`: `AvatarStack` de 36 px com quem entregou a +3°, de `deliveredAvatarSrc`, e "Entregue às … Aguardando recebimento." em 15 px/1,5) + "Ver passagem"; `confirmed` → o mesmo bloco em verde, "Confirmada" com `CircleCheck` (`bg-on-pastel-success-soft` e `text-on-pastel-success`), e a linha com a pilha (quem entregou a +3°, por cima; quem confirmou a −4°, de `confirmedAvatarSrc`, 8 px sobreposto) e "Entregue por … Confirmada por …" + "Ver passagem"; sem avatar, a frase aparece sozinha; `no-shifts`
```

f) `MyShiftCard`, "Usa". old_string:
```markdown
- **Usa:** `Card`, `Badge`, `buttonVariants`, `UserAvatar`, `ShiftProgressBar`, `SECTOR_COLOR_BG`, `newHandoverHref`, `handoverHref`.
```
new_string:
```markdown
- **Usa:** `Card`, `buttonVariants`, `UserAvatar`, `AvatarStack`, `ShiftProgressBar`, `SECTOR_COLOR_BG`, `newHandoverHref`, `handoverHref`; tokens `on-pastel`, `on-pastel-success`, `on-pastel-success-soft`.
```

g) `MyShiftCard`, "Histórico" (fim da linha). old_string:
```markdown
selos de estado com `leading-[normal]` depois do `text-[13px]` (o twMerge do Badge descarta o `leading` que vem antes).
```
new_string:
```markdown
selos de estado com `leading-[normal]` depois do `text-[13px]` (o twMerge do Badge descarta o `leading` que vem antes). 2026-11-27 — Pack de correção do Início (Task 18, spec §6.4.1): `delivered` e `confirmed` trocam o selo pastel por um bloco de largura inteira (neutro `on-pastel/10` e verde `on-pastel-success*`) e ganham avatar na linha de entrega (pilha de dois no `confirmed`); props novas `deliveredAvatarSrc` e `confirmedAvatarSrc`.
```

h) `HomeCards`, "Como funciona". old_string:
```markdown
Gera no servidor os avatares (`avatarDataUri`): quem entregou (`deliveredById`), quem salvou o rascunho (`saved.byId`) e quem está logado (`actorId`: convite e solicitações vazias).
```
new_string:
```markdown
Gera no servidor os avatares (`avatarDataUri`): quem entregou a passagem pendente (`pending.deliveredById`), quem salvou o rascunho (`saved.byId`), quem entregou e quem confirmou a passagem do meu turno (`mine.deliveredById`, `mine.confirmedById`; id vazio ou nulo não vira avatar) e quem está logado (`actorId`: convite e solicitações vazias).
```

i) `HomeCards`, "Histórico". old_string:
```markdown
- **Histórico:** 2026-11-27 — criado no visual novo do Início (Task 14).

### HomeHandovers
```
new_string:
```markdown
- **Histórico:** 2026-11-27 — criado no visual novo do Início (Task 14). 2026-11-27 — Pack de correção (Task 18): avatares de quem entregou e de quem confirmou para o `MyShiftCard` (`deliveredAvatarSrc`, `confirmedAvatarSrc`).

### HomeHandovers
```

Run: `grep -c "^### " .context/ui-registry.md`
Expected: `159` (os 158 de antes mais o `AvatarStack`; nenhum cabeçalho sumiu). Se der outro número, compare `git diff .context/ui-registry.md | grep "^[-+]### "` e restaure o que sumiu.

- [ ] **Step 27: Conferir tipos, lint e os testes tocados**

Run: `bun run check-types && bun run lint`
Expected: sem erros. Se o Biome reclamar só de formatação, rode `bun run format` e confira o `git diff`.

Run: `bunx vitest run src/features/handovers/home.test.ts src/app/themeContrast.test.ts src/app/rawColors.test.ts src/app/chartPalette.test.ts src/features/sectors/colors.test.ts test/fontsConfig.test.ts test/uiRegistryDoc.test.ts`
Expected: PASS.

Run: `bunx vitest run src/components/app-shell/AvatarStack.test.tsx src/components/app-shell/UserAvatar.test.tsx src/components/passagens/MyShiftCard.test.tsx src/components/passagens/HomeCards.test.tsx src/components/passagens/HomeHandovers.test.tsx src/components/passagens/PendingHandoverCard.test.tsx src/components/ui/badge.test.tsx`
Expected: PASS.

Nunca `bun test` nem a suíte inteira.

- [ ] **Step 28: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/visual/msg-task-18.txt`:

```
feat(inicio): pack de correção do cartão do meu turno

Entregue e confirmada trocam o selo em pílula por um bloco de largura
inteira (on-pastel/10 e o verde on-pastel-success) e ganham avatar na
linha de entrega: quem entregou e, na confirmada, a pilha com quem
confirmou (AvatarStack novo). O MyShiftState traz deliveredById e
confirmedById, e o HomeCards gera os avatares no servidor. Saem as
variantes pastel do Badge e os tokens delas. A tinta verde do handoff
dava 4,41:1 no lilás e foi escurecida para #123b27 (spec §6.4.1).

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Run: `git add src/features/handovers/home.ts src/features/handovers/home.test.ts src/app/globals.css src/app/themeContrast.test.ts src/components/app-shell/AvatarStack.tsx src/components/app-shell/AvatarStack.test.tsx src/components/passagens/MyShiftCard.tsx src/components/passagens/MyShiftCard.test.tsx src/components/passagens/HomeCards.tsx src/components/passagens/HomeCards.test.tsx src/components/passagens/HomeHandovers.test.tsx src/components/ui/badge.tsx src/components/ui/badge.test.tsx .context/ui-tokens.md .context/ui-registry.md && git commit -F .git/sdd/visual/msg-task-18.txt`

Expected: um commit com os 15 arquivos. `git status` limpo, a não ser pelo `AGENTS.md` regravado pelo `next dev`, se ele tiver rodado.

- [ ] **Step 29: Conferência visual contra o protótipo atualizado (controlador)**

Use as ferramentas da Task 16 (`.git/sdd/visual/tools/`, fora do git).
1. **Cópia do protótipo.** Copie `.git/sdd/visual/handoff-correcoes/Inicio.dc.html` e `support.js` para `.git/sdd/visual/proto/`, como `proto-entregue-v2.html` e `proto-confirmada-v2.html`.
   - Na cópia, troque **todos** os nomes de exemplo por fictícios, inclusive as sementes do DiceBear na URL: quem entrega vira "Bruno Teste" e quem confirma vira "Diego Teste", com os ids do banco de teste, como no Step 1 da Task 16. Use `grep -n "por \|seed=" .git/sdd/visual/proto/proto-*-v2.html`.
   - Troque o `default` da prop `turno` para "Entregue" ou "Confirmada".
2. **Banco de teste.** Semeie a passagem do Turno 1 de hoje, entregue (e depois confirmada), no setor de cada screenshot: ULD (lilás) no escuro; Carga (pêssego) e Operações (azul) no claro.
3. **Pares.** Capture os pares em 1440×900 e 390×844, nos dois temas.
   - Mascare a hora e a barra, que dependem do "agora", e a arte dos avatares (a semente do protótipo não é a do app).
   - Registre a diferença no `.git/sdd/visual/pixel.md`, numa seção "Pack de correção".
4. **Correções.** O que não bater no bloco, na linha ou nos espaçamentos é corrigido no `MyShiftCard`, com teste antes, num commit `fix(visual): …` por ajuste.
   - O bloco verde sobre o setor Eco entra na conferência como observação para o dono (spec §6.4.1). Não é defeito.
