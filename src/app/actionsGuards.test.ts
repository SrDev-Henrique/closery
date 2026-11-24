import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import {
  actionsMissingGuard,
  hasUseServerDirective,
  listSourceFiles,
  startsWithUseServer,
} from "../../test/actionGuards";

// Guarda de toda Server Action do projeto (P27). Uma Server Action é um
// endpoint público: qualquer arquivo com "use server" tem de ser um actions.ts
// do grupo (app), cada função exportada autoriza por conta própria
// (`requireAdmin()` sob admin/, `requireUser()` ou `requireAdmin()` no resto)
// como PRIMEIRA instrução, e nada além de funções async é exportado.

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

// Pública por natureza: quem abre o convite ainda não tem sessão. A action só
// valida o token e grava o cookie do convite. Qualquer outra exceção é
// decisão de segurança e entra aqui com o motivo.
export const AUTH_ACTION_FILES: readonly string[] = [
  "src/app/(auth)/convite/[token]/actions.ts",
];

// Quantos actions.ts o guarda precisa achar (um número que só sobe: se cair, a
// varredura parou de enxergar algum arquivo). (app): actions.ts e
// passagens/actions.ts (Fase 3) e solicitacoes/actions.ts (Fase 4).
const MIN_ADMIN_ACTION_FILES = 5;
const MIN_APP_ACTION_FILES = 3;

const APP_PREFIX = "src/app/(app)/";
const ADMIN_PREFIX = "src/app/(app)/admin/";

/**
 * Problemas de um arquivo com "use server", dado o caminho (relativo à raiz,
 * com "/") e o código. [] = tudo certo. Só faz sentido para arquivos em que
 * `hasUseServerDirective` é verdadeiro.
 */
export function actionFileProblems(path: string, source: string): string[] {
  if (AUTH_ACTION_FILES.includes(path)) return [];

  const problems: string[] = [];
  const isAppActions =
    path.startsWith(APP_PREFIX) && path.split("/").at(-1) === "actions.ts";
  if (!isAppActions) {
    problems.push(
      `"use server" só pode existir em um actions.ts sob ${APP_PREFIX}: ${path}`,
    );
    return problems;
  }
  if (!startsWithUseServer(source)) {
    problems.push(`${path} precisa começar com "use server".`);
  }
  const allowed = path.startsWith(ADMIN_PREFIX)
    ? (["requireAdmin"] as const)
    : (["requireUser", "requireAdmin"] as const);
  for (const name of actionsMissingGuard(source, allowed)) {
    problems.push(
      `${path}: ${name} não começa com ${allowed.join("() ou ")}() (e só funções async podem ser exportadas).`,
    );
  }
  return problems;
}

function isRuntimeSource(name: string): boolean {
  return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name);
}

function relativePath(file: string): string {
  return relative(ROOT, file).replaceAll("\\", "/");
}

describe("todo arquivo com 'use server' passa pelo guarda", () => {
  const files = listSourceFiles(SRC, isRuntimeSource)
    .map((file) => ({ path: relativePath(file), file }))
    .filter(({ file }) => hasUseServerDirective(readFileSync(file, "utf8")));

  it("encontra os arquivos de actions", () => {
    const admin = files.filter(({ path }) => path.startsWith(ADMIN_PREFIX));
    const app = files.filter(
      ({ path }) =>
        path.startsWith(APP_PREFIX) && !path.startsWith(ADMIN_PREFIX),
    );
    expect(admin.length).toBeGreaterThanOrEqual(MIN_ADMIN_ACTION_FILES);
    expect(app.length).toBeGreaterThanOrEqual(MIN_APP_ACTION_FILES);
  });

  it("as exceções documentadas existem e continuam sendo 'use server'", () => {
    const paths = files.map(({ path }) => path);
    for (const exception of AUTH_ACTION_FILES) {
      expect(paths, `${exception} deixou de ser uma action`).toContain(
        exception,
      );
    }
  });

  it.each(files.map(({ path, file }) => [path, file]))("%s", (path, file) => {
    expect(
      actionFileProblems(path as string, readFileSync(file as string, "utf8")),
    ).toEqual([]);
  });
});

describe("actionFileProblems (o guarda de fato falha)", () => {
  const goodUser = `"use server";
export async function saveAction(input: unknown) {
  const actor = await requireUser();
  return run({ actor, input });
}`;

  it("action de passagem com requireUser na primeira linha → []", () => {
    expect(
      actionFileProblems("src/app/(app)/passagens/actions.ts", goodUser),
    ).toEqual([]);
  });

  it("action fora do admin pode usar requireAdmin", () => {
    const source = `"use server";
export async function chooseSectorAction(input: unknown) {
  await requireAdmin();
}`;
    expect(actionFileProblems("src/app/(app)/actions.ts", source)).toEqual([]);
  });

  it("action sem guarda → problema com o nome dela", () => {
    const source = `"use server";
export async function saveAction(input: unknown) {
  return run({ input });
}`;
    const problems = actionFileProblems(
      "src/app/(app)/passagens/actions.ts",
      source,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("saveAction");
  });

  it("guarda só em comentário não conta", () => {
    const source = `"use server";
export async function saveAction() {
  // const actor = await requireUser();
  return 1;
}`;
    expect(
      actionFileProblems("src/app/(app)/passagens/actions.ts", source),
    ).toHaveLength(1);
  });

  it("guarda depois de outro trabalho não vale: tem de ser a primeira instrução", () => {
    const source = `"use server";
export async function saveAction(input: unknown) {
  await save(input);
  await requireUser();
}`;
    expect(
      actionFileProblems("src/app/(app)/passagens/actions.ts", source),
    ).toHaveLength(1);
  });

  it("sob admin/ só requireAdmin vale: requireUser reprova", () => {
    expect(
      actionFileProblems("src/app/(app)/admin/setores/actions.ts", goodUser),
    ).toHaveLength(1);
    const admin = goodUser.replace("requireUser", "requireAdmin");
    expect(
      actionFileProblems("src/app/(app)/admin/setores/actions.ts", admin),
    ).toEqual([]);
  });

  it("export que não é função async reprova (constante, função síncrona)", () => {
    const source = `"use server";
export const LIMIT = 3;
export function helper() { return 1; }
export async function saveAction() {
  await requireUser();
}`;
    expect(
      actionFileProblems("src/app/(app)/passagens/actions.ts", source),
    ).toHaveLength(2);
  });

  it("arquivo sem a diretiva no topo reprova", () => {
    const source = `import { x } from "y";
export async function saveAction() {
  await requireUser();
}`;
    const problems = actionFileProblems(
      "src/app/(app)/passagens/actions.ts",
      source,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('começar com "use server"');
  });

  it("'use server' inline em arquivo que não é actions.ts reprova", () => {
    const source = `export async function sneaky() {
  "use server";
  return 1;
}`;
    expect(hasUseServerDirective(source)).toBe(true);
    expect(
      actionFileProblems("src/features/handovers/sneaky.ts", source),
    ).toHaveLength(1);
    expect(
      actionFileProblems("src/app/(app)/passagens/helpers.ts", source),
    ).toHaveLength(1);
  });

  it("actions.ts fora do grupo (app) reprova", () => {
    expect(
      actionFileProblems("src/features/handovers/actions.ts", goodUser),
    ).toHaveLength(1);
    expect(
      actionFileProblems("src/app/(auth)/outra/actions.ts", goodUser),
    ).toHaveLength(1);
    expect(actionFileProblems("src/app/api/actions.ts", goodUser)).toHaveLength(
      1,
    );
  });

  it("a exceção documentada do convite passa sem guarda; outro arquivo de (auth) não", () => {
    const publicAction = `"use server";
export async function armInvite(token: string) {
  return { ok: true };
}`;
    expect(
      actionFileProblems(
        "src/app/(auth)/convite/[token]/actions.ts",
        publicAction,
      ),
    ).toEqual([]);
    expect(
      actionFileProblems("src/app/(auth)/entrar/actions.ts", publicAction),
    ).toHaveLength(1);
  });
});

describe("hasUseServerDirective", () => {
  it("vê a diretiva de arquivo, com aspas simples ou duplas, depois de comentário", () => {
    expect(hasUseServerDirective(`"use server";\nexport {}`)).toBe(true);
    expect(hasUseServerDirective(`// ações\n'use server'\n`)).toBe(true);
  });

  it("vê a diretiva inline dentro de função", () => {
    expect(
      hasUseServerDirective(
        `export function a() {\n  async function b() {\n    "use server";\n  }\n}`,
      ),
    ).toBe(true);
  });

  it("ignora comentário, 'use client' e texto no meio de uma frase", () => {
    expect(hasUseServerDirective(`// "use server"\n`)).toBe(false);
    expect(hasUseServerDirective(`/* "use server" */`)).toBe(false);
    expect(hasUseServerDirective(`"use client";\nexport {}`)).toBe(false);
    expect(
      hasUseServerDirective(`const x = 'não use "use server" aqui';`),
    ).toBe(false);
  });
});
