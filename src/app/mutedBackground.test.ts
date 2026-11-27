/**
 * Guarda do `bg-muted` (PR B, spec §9, P83). Na paleta nova `--muted` = `--card` = `--popover` nos
 * dois temas: dentro de cartão, diálogo ou Sheet, um fundo `bg-muted` (com ou sem opacidade, em
 * repouso, no hover ou aberto) não muda de cor, e o estado ou o rodapé somem. Fundo de estado é
 * `accent` (PB-D8, `ui-rules.md §6`). Varre os `.ts` e `.tsx` de `src/` (fora os `*.test.*`), sem
 * os comentários, como o `rawColors.test.ts`.
 *
 * Exceções numa lista fechada, por arquivo e classe exata, cada uma com o motivo. Uma exceção que
 * não existe mais reprova: apague-a.
 *
 * Rodar: `bunx vitest run src/app/mutedBackground.test.ts`
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { stripComments } from "../../test/actionGuards";

const SRC = join(import.meta.dirname, "..");

/**
 * Uma classe (já sem aspas nem espaço) cujo utilitário é `bg-muted`: com variantes antes (`hover:`,
 * `aria-expanded:`, `group-hover:`, `[a]:hover:`, `dark:hover:`, `has-[…]:`), opacidade depois
 * (`/50`, `/[0.3]`) e `!`. Nunca `bg-muted-foreground`.
 */
export const MUTED_BG_PATTERN =
  /^(?:\S*:)?!?bg-muted(?:\/(?:\d+|\[[^\]\s]+\]))?!?$/;

/** Chave relativa a `src/`, com `/`. A classe tem de ser exatamente a do `snippet`. */
export const MUTED_BG_EXCEPTIONS: Record<
  string,
  readonly { snippet: string; reason: string }[]
> = {
  "components/solicitacoes/RequestColumn.tsx": [
    {
      snippet: "bg-muted/30",
      reason:
        "a coluna do Quadro fica sobre o background da página (não dentro de cartão) e tem borda; a branch E troca pelo token --column (roteiro §3.1)",
    },
  ],
};

/** As classes `bg-muted` do código (comentários fora), menos as exceções do arquivo. */
export function mutedBackgroundViolations(source: string, key = ""): string[] {
  const allowed = new Set(
    (MUTED_BG_EXCEPTIONS[key] ?? []).map((exception) => exception.snippet),
  );
  return stripComments(source)
    .split(/[\s"'`]+/)
    .filter((token) => MUTED_BG_PATTERN.test(token) && !allowed.has(token));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(?:ts|tsx)$/.test(entry.name) &&
      !/\.test\.(?:ts|tsx)$/.test(entry.name)
      ? [full]
      : [];
  });
}

const files = sourceFiles(SRC).map((full) => ({
  full,
  key: relative(SRC, full).replaceAll("\\", "/"),
}));

describe("nenhum .ts/.tsx de src/ usa bg-muted como fundo", () => {
  it("anti-vacuidade: acha os arquivos que deve varrer", () => {
    expect(files.length).toBeGreaterThanOrEqual(300);
    const keys = files.map((file) => file.key);
    expect(keys).toContain("components/ui/button.tsx");
    expect(keys).toContain("components/solicitacoes/RequestColumn.tsx");
    expect(keys).toContain("lib/theme.ts");
    expect(keys.some((key) => /\.test\.(?:ts|tsx)$/.test(key))).toBe(false);
  });

  it("todos os arquivos estão limpos", () => {
    const offenders = files.flatMap(({ full, key }) =>
      mutedBackgroundViolations(readFileSync(full, "utf8"), key).map(
        (token) => `${key}: ${token}`,
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("cada exceção está viva: o arquivo existe, tem motivo e, sem a exceção, reprovaria", () => {
    for (const [key, exceptions] of Object.entries(MUTED_BG_EXCEPTIONS)) {
      const file = join(SRC, key);
      expect(existsSync(file), `${key} não existe: apague a exceção`).toBe(
        true,
      );
      const found = mutedBackgroundViolations(readFileSync(file, "utf8"));
      for (const { snippet, reason } of exceptions) {
        expect(reason.length, `${key}: ${snippet} sem motivo`).toBeGreaterThan(
          20,
        );
        expect(
          found,
          `${key} não tem mais ${snippet}: apague a exceção`,
        ).toContain(snippet);
      }
    }
  });

  it("a exceção vale só no arquivo dela e só para a classe exata", () => {
    const column = "components/solicitacoes/RequestColumn.tsx";
    expect(
      mutedBackgroundViolations(
        'className="bg-muted/30"',
        "components/x/Outro.tsx",
      ),
    ).toEqual(["bg-muted/30"]);
    expect(
      mutedBackgroundViolations('className="bg-muted/30"', column),
    ).toEqual([]);
    expect(
      mutedBackgroundViolations(
        'className="hover:bg-muted/30 bg-muted"',
        column,
      ),
    ).toEqual(["hover:bg-muted/30", "bg-muted"]);
  });
});

describe("MUTED_BG_PATTERN reprova o que deve reprovar (casos positivos)", () => {
  it.each([
    "bg-muted",
    "bg-muted/50",
    "bg-muted/30",
    "bg-muted/[0.3]",
    "hover:bg-muted",
    "aria-expanded:bg-muted",
    "group-hover:bg-muted/50",
    "[a]:hover:bg-muted",
    "dark:hover:bg-muted/50",
    "has-aria-expanded:bg-muted/50",
    "data-[state=selected]:bg-muted",
    "has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-muted/50",
    "bg-muted!",
    "!bg-muted",
  ])("%s casa", (token) => {
    expect(MUTED_BG_PATTERN.test(token)).toBe(true);
  });
});

describe("MUTED_BG_PATTERN deixa passar o que não é fundo muted (casos negativos)", () => {
  it.each([
    "bg-muted-foreground",
    "group-hover:bg-muted-foreground",
    "text-muted-foreground",
    "hover:text-muted-foreground",
    "border-muted",
    "bg-accent",
    "hover:bg-accent/50",
    "bg-mutedx",
    "xbg-muted",
    "bg-muted/",
    "",
  ])("%j não casa", (token) => {
    expect(MUTED_BG_PATTERN.test(token)).toBe(false);
  });
});

describe("mutedBackgroundViolations (a varredura de um arquivo)", () => {
  it("comentário não conta", () => {
    expect(
      mutedBackgroundViolations(
        `// hover:bg-muted\n/* bg-muted/50 */\nconst a = "bg-card";`,
      ),
    ).toEqual([]);
  });

  it("acha a classe em className, cn, cva e template literal", () => {
    expect(
      mutedBackgroundViolations(`
        <div className="flex bg-muted/50 p-4" />;
        cn("flex", open && "aria-expanded:bg-muted");
        const v = cva("base", { variants: { ghost: "hover:bg-muted dark:hover:bg-muted/50" } });
        const t = \`p-2 \${active ? "group-hover:bg-muted" : ""}\`;
      `),
    ).toEqual([
      "bg-muted/50",
      "aria-expanded:bg-muted",
      "hover:bg-muted",
      "dark:hover:bg-muted/50",
      "group-hover:bg-muted",
    ]);
  });

  it("código limpo e vazio passam", () => {
    expect(
      mutedBackgroundViolations(
        `const a = "bg-accent hover:bg-accent/50 text-muted-foreground bg-muted-foreground";`,
      ),
    ).toEqual([]);
    expect(mutedBackgroundViolations("")).toEqual([]);
  });
});
