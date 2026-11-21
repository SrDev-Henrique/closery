import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";

// Guarda de .context/ui-registry.md: todo componente da Fase 2 (a pasta
// src/components/admin e os primitivos novos do shadcn) precisa estar no
// catálogo, para ninguém criar um componente parecido sem saber que existe. A
// busca é pelo nome do arquivo (sem diferença de caixa, `useAdminAction` casa
// com `UseAdminAction`).

const registry = readFileSync(".context/ui-registry.md", "utf8");

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)
      ? [full]
      : [];
  });
}

function pascalCase(kebab: string): string {
  return kebab
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function nameOf(file: string): string {
  return pascalCase(basename(file).replace(/\.(ts|tsx)$/, ""));
}

const adminFiles = sourceFiles(join("src", "components", "admin"));
const handoverFiles = sourceFiles(join("src", "components", "passagens"));
const primitiveFiles = ["toggle", "toggle-group", "native-select", "dialog"]
  .map((name) => join("src", "components", "ui", `${name}.tsx`))
  .filter((file) => existsSync(file));

describe("ui-registry.md cobre os componentes das Fases 2 e 3", () => {
  it.each(
    [...adminFiles, ...handoverFiles, ...primitiveFiles].map((file) => [
      file,
      nameOf(file),
    ]),
  )("%s está no catálogo", (file, name) => {
    expect(
      new RegExp(String.raw`\b${name}\b`, "i").test(registry),
      `${file}: nenhuma menção a "${name}" em .context/ui-registry.md`,
    ).toBe(true);
  });

  it("AdminOverview descreve os cartões da Fase 2", () => {
    expect(registry).toContain(
      "2026-11-21 — Fase 2: cartões dos cinco cadastros",
    );
  });
});
