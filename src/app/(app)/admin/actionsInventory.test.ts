import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Inventário das Server Actions de /admin: o contrato da Fase 2 lista 18
// funções em 5 arquivos. Action nova ou sumida muda esta lista de propósito,
// para quem revisa ver (o guarda actionsAuth.test.ts confere o requireAdmin).

const ADMIN_DIR = join(process.cwd(), "src", "app", "(app)", "admin");

const EXPECTED: Record<string, string[]> = {
  "destinos/actions.ts": [
    "createDestinationAction",
    "renameDestinationAction",
    "setDestinationActiveAction",
  ],
  "equipe/actions.ts": [
    "cancelInviteAction",
    "createInviteAction",
    "createPasswordResetLinkAction",
    "setPersonActiveAction",
    "updatePersonAction",
  ],
  "itens/actions.ts": [
    "createItemAction",
    "moveItemAction",
    "setItemActiveAction",
    "updateItemAction",
  ],
  "setores/actions.ts": [
    "createSectorAction",
    "renameSectorAction",
    "setSectorActiveAction",
  ],
  "turnos/actions.ts": [
    "createShiftAction",
    "moveShiftAction",
    "setShiftActiveAction",
    "updateShiftAction",
  ],
};

function findActionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return findActionFiles(full);
    return name === "actions.ts" ? [full] : [];
  });
}

function exportedFunctions(source: string): string[] {
  return [...source.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)]
    .map((match) => match[1] ?? "")
    .sort();
}

describe("Server Actions de /admin", () => {
  const files = findActionFiles(ADMIN_DIR).map((file) =>
    relative(ADMIN_DIR, file).replaceAll("\\", "/"),
  );

  it("há exatamente 5 arquivos actions.ts, um por cadastro", () => {
    expect([...files].sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(
    Object.entries(EXPECTED),
  )("%s exporta só as actions do contrato", (file, names) => {
    const source = readFileSync(join(ADMIN_DIR, file), "utf8");

    expect(source.trimStart().startsWith('"use server"')).toBe(true);
    expect(exportedFunctions(source)).toEqual(names);
    // Toda export é função async: arquivo "use server" não exporta mais nada.
    expect(source).not.toMatch(
      /^export\s+(?:const|let|type|interface|class)\b/m,
    );
  });
});
