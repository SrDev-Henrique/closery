import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import {
  actionsMissingGuard,
  listSourceFiles,
  startsWithUseServer,
} from "../../../../test/actionGuards";

// Guarda das Server Actions do admin. Uma Server Action é um endpoint público:
// pode ser chamada de qualquer rota, então cada função exportada autoriza por
// conta própria, com `requireAdmin()` como PRIMEIRA instrução (F2-7). A
// varredura vive em test/actionGuards.ts, compartilhada com src/app/actionsGuards.test.ts.

const ROOT = process.cwd();
const ADMIN_DIR = join(ROOT, "src", "app", "(app)", "admin");

// Sobe para 5 na Tarefa 11, quando existirem os cinco actions.ts (setores,
// destinos, turnos, itens, equipe).
const MIN_ACTION_FILES = 5;

/** Nomes dos exports que não cumprem o contrato do admin ([] = tudo certo). */
export function actionsMissingAdminGuard(source: string): string[] {
  return actionsMissingGuard(source, ["requireAdmin"]);
}

function findActionFiles(dir: string): string[] {
  return listSourceFiles(dir, (name) => name === "actions.ts");
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
