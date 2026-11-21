import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Varredura das Server Actions, compartilhada pelos guardas. Uma Server Action
// é um endpoint público: cada função exportada autoriza por conta própria, com
// o guarda como PRIMEIRA instrução (F2-7, F3-13b).

export type GuardName = "requireAdmin" | "requireUser";

export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

// Índice do `}` que fecha o `{` em `open` (ignora chaves dentro de strings).
function matchingBrace(source: string, open: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < source.length; i++) {
    const char = source.charAt(i);
    if (quote) {
      if (char === "\\") i++;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) return i;
  }
  return -1;
}

// Índice do `{` que abre o corpo da função: depois dos parênteses dos
// parâmetros, pulando chaves de tipos como `Promise<AdminResult<{ id: string }>>`.
function bodyStart(source: string, afterName: number): number {
  const paramsOpen = source.indexOf("(", afterName);
  if (paramsOpen === -1) return -1;
  let depth = 0;
  let i = paramsOpen;
  for (; i < source.length; i++) {
    const char = source.charAt(i);
    if (char === "(") depth++;
    else if (char === ")" && --depth === 0) break;
  }
  let angle = 0;
  for (i += 1; i < source.length; i++) {
    const char = source.charAt(i);
    if (char === "<") angle++;
    else if (char === ">" && source.charAt(i - 1) !== "=") angle--;
    else if (char === "{" && angle === 0) return i;
  }
  return -1;
}

function firstStatementGuard(allowed: readonly GuardName[]): RegExp {
  return new RegExp(
    `^\\s*(?:const\\s+[\\w$]+\\s*=\\s*)?await\\s+(?:${allowed.join("|")})\\s*\\(\\s*\\)`,
  );
}

/**
 * Nomes dos exports de um actions.ts que não cumprem o contrato: função
 * `export async function` cujo corpo não começa com `await <guarda>()`
 * (comentários removidos), ou qualquer outro export em tempo de execução
 * (`const`, `function` síncrona, `default`, `{ … }`). [] = tudo certo.
 */
export function actionsMissingGuard(
  source: string,
  allowed: readonly GuardName[],
): string[] {
  const code = stripComments(source);
  const guard = firstStatementGuard(allowed);
  const offenders: string[] = [];

  for (const match of code.matchAll(
    /^export\s+(async\s+function\s+([\w$]+)|default\b|(?:const|let|var|function|class)\s+([\w$]+)|\{|\*)/gm,
  )) {
    const name = match[2] ?? match[3] ?? match[1] ?? "export";
    if (match[2] === undefined) {
      offenders.push(name.trim());
      continue;
    }
    const start = match.index + match[0].length;
    const open = bodyStart(code, start);
    const close = open === -1 ? -1 : matchingBrace(code, open);
    const body = open === -1 || close === -1 ? "" : code.slice(open + 1, close);
    if (!guard.test(body)) offenders.push(match[2]);
  }
  return offenders;
}

export function startsWithUseServer(source: string): boolean {
  return /^\s*(["'])use server\1/.test(stripComments(source));
}

/** Diretiva de arquivo OU inline (`"use server"` como primeira instrução de uma função). */
export function hasUseServerDirective(source: string): boolean {
  return /(?:^|[;{}\n])\s*(["'])use server\1/.test(stripComments(source));
}

/** Arquivos de `dir` (recursivo) cujo nome passa em `filter`, caminho completo. */
export function listSourceFiles(
  dir: string,
  filter: (name: string) => boolean,
): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listSourceFiles(full, filter);
    return filter(name) ? [full] : [];
  });
}
