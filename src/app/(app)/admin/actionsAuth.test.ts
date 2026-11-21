import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Guarda das Server Actions do admin. Uma Server Action é um endpoint público:
// pode ser chamada de qualquer rota, então cada função exportada autoriza por
// conta própria, com `requireAdmin()` como PRIMEIRA instrução (F2-7).

const ROOT = process.cwd();
const ADMIN_DIR = join(ROOT, "src", "app", "(app)", "admin");

// Sobe para 5 na Tarefa 11, quando existirem os cinco actions.ts (setores,
// destinos, turnos, itens, equipe).
const MIN_ACTION_FILES = 0;

const FIRST_STATEMENT_GUARD =
  /^\s*(?:const\s+[\w$]+\s*=\s*)?await\s+requireAdmin\s*\(\s*\)/;

function stripComments(source: string): string {
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

/**
 * Nomes dos exports de um actions.ts que não cumprem o contrato: função
 * `export async function` cujo corpo não começa com `requireAdmin()` (comentários
 * removidos), ou qualquer outro export em tempo de execução (`const`,
 * `function` síncrona, `default`, `{ … }`). [] = tudo certo.
 */
export function actionsMissingAdminGuard(source: string): string[] {
  const code = stripComments(source);
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
    if (!FIRST_STATEMENT_GUARD.test(body)) offenders.push(match[2]);
  }
  return offenders;
}

function startsWithUseServer(source: string): boolean {
  return /^\s*(["'])use server\1/.test(stripComments(source));
}

function findActionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return findActionFiles(full);
    return name === "actions.ts" ? [full] : [];
  });
}

describe("todo actions.ts do admin chama requireAdmin() primeiro", () => {
  const files = findActionFiles(ADMIN_DIR);

  it("encontra os arquivos de actions", () => {
    expect(files.length).toBeGreaterThanOrEqual(MIN_ACTION_FILES);
  });

  it.each(
    files.map((file) => [relative(ROOT, file).replaceAll("\\", "/"), file]),
  )("%s", (name, file) => {
    const source = readFileSync(file as string, "utf8");
    expect(
      startsWithUseServer(source),
      `${name} precisa começar com "use server".`,
    ).toBe(true);
    expect(
      actionsMissingAdminGuard(source),
      `${name}: toda função exportada começa com requireAdmin() e só exporta funções async.`,
    ).toEqual([]);
  });
});

describe("actionsMissingAdminGuard (o guarda de fato falha)", () => {
  it("action com requireAdmin na primeira linha → []", () => {
    const source = `"use server";
export async function createSectorAction(input: unknown) {
  const actor = await requireAdmin();
  return runAdminAction({ actor, schema, input, run });
}`;
    expect(actionsMissingAdminGuard(source)).toEqual([]);
  });

  it("aceita `await requireAdmin();` sem atribuição", () => {
    const source = `export async function a() {\n  await requireAdmin();\n  return 1;\n}`;
    expect(actionsMissingAdminGuard(source)).toEqual([]);
  });

  it("action sem requireAdmin → o nome dela", () => {
    const source = `"use server";
export async function createSectorAction(input: unknown) {
  return runAdminAction({ input });
}`;
    expect(actionsMissingAdminGuard(source)).toEqual(["createSectorAction"]);
  });

  it("requireAdmin só em comentário não conta", () => {
    const source = `export async function a() {
  // const actor = await requireAdmin();
  /* await requireAdmin(); */
  return 1;
}`;
    expect(actionsMissingAdminGuard(source)).toEqual(["a"]);
  });

  it("um export sem guarda entre dois com guarda → só o do meio", () => {
    const source = `export async function first() {
  await requireAdmin();
}
export async function middle() {
  return 1;
}
export async function last() {
  await requireAdmin();
}`;
    expect(actionsMissingAdminGuard(source)).toEqual(["middle"]);
  });

  it("requireAdmin em função auxiliar fora da action não salva a action", () => {
    const source = `export async function a() {
  return 1;
}
async function helper() {
  await requireAdmin();
}`;
    expect(actionsMissingAdminGuard(source)).toEqual(["a"]);
  });

  it("requireAdmin depois de outro trabalho não vale: tem de ser a primeira instrução", () => {
    const source = `export async function a(input: unknown) {
  await writeSomething(input);
  await requireAdmin();
}`;
    expect(actionsMissingAdminGuard(source)).toEqual(["a"]);
  });

  it("entende parâmetros e retorno com chaves: tipos de objeto não enganam", () => {
    const source = `export async function a(input: { id: string }): Promise<AdminResult<{ id: string }>> {
  return runAdminAction({ input });
}
export async function b(input: { id: string }): Promise<AdminResult<{ id: string }>> {
  const actor = await requireAdmin();
  return runAdminAction({ actor, input });
}`;
    expect(actionsMissingAdminGuard(source)).toEqual(["a"]);
  });

  it("chaves dentro de strings não confundem o corpo", () => {
    const source = `export async function a() {
  await requireAdmin();
  return "}";
}
export async function b() {
  return "{";
}`;
    expect(actionsMissingAdminGuard(source)).toEqual(["b"]);
  });

  it("export que não é `export async function` é recusado", () => {
    const source = `export const createAction = async () => { await requireAdmin(); };
export function syncAction() { return 1; }
export default async function () {}
export { foo };`;
    expect(actionsMissingAdminGuard(source)).toEqual([
      "createAction",
      "syncAction",
      "default",
      "{",
    ]);
  });

  it("função não exportada sem guarda é ignorada", () => {
    const source = `async function helper() { return 1; }
export async function a() {
  await requireAdmin();
}`;
    expect(actionsMissingAdminGuard(source)).toEqual([]);
  });

  it("arquivo sem nenhuma action → []", () => {
    expect(actionsMissingAdminGuard(`"use server";`)).toEqual([]);
  });
});

describe("startsWithUseServer", () => {
  it("aceita aspas simples e duplas, depois de comentário", () => {
    expect(startsWithUseServer(`"use server";\nexport {}`)).toBe(true);
    expect(startsWithUseServer(`// ações\n'use server'\n`)).toBe(true);
  });

  it("recusa arquivo sem a diretiva ou com ela fora do topo", () => {
    expect(startsWithUseServer(`export async function a() {}`)).toBe(false);
    expect(startsWithUseServer(`import x from "y";\n"use server";`)).toBe(
      false,
    );
  });
});
