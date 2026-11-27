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
