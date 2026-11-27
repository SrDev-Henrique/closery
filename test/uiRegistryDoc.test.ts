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
const requestFiles = sourceFiles(join("src", "components", "solicitacoes"));
const kokonutFiles = sourceFiles(join("src", "components", "kokonutui"));
const dashboardFiles = sourceFiles(join("src", "components", "dashboard"));
const privacyFiles = sourceFiles(join("src", "components", "privacy"));
const primitiveFiles = [
  "toggle",
  "toggle-group",
  "native-select",
  "dialog",
  "table",
  "chart",
]
  .map((name) => join("src", "components", "ui", `${name}.tsx`))
  .filter((file) => existsSync(file));

describe("ui-registry.md cobre os componentes das Fases 2 a 5", () => {
  it.each(
    [
      ...adminFiles,
      ...handoverFiles,
      ...requestFiles,
      ...kokonutFiles,
      ...dashboardFiles,
      ...privacyFiles,
      ...primitiveFiles,
    ].map((file) => [file, nameOf(file)]),
  )("%s está no catálogo", (file, name) => {
    expect(
      new RegExp(String.raw`\b${name}\b`, "i").test(registry),
      `${file}: nenhuma menção a "${name}" em .context/ui-registry.md`,
    ).toBe(true);
  });

  it("pasta inexistente (como solicitacoes antes da Tarefa 10): a varredura devolve vazio e não lança", () => {
    expect(
      sourceFiles(join("src", "components", "pasta-que-nao-existe")),
    ).toEqual([]);
  });

  it.each([
    "Chart",
    "MetricCard",
    "SpendingRing",
    "chartColors",
    "usePrefersReducedMotion",
    "StockTrendChart",
    "PrivacyLink",
    "ResetPasswordForm",
    "PasswordResetLinkButton",
  ])("%s tem cabeçalho próprio no catálogo (a menção solta não basta)", (name) => {
    expect(registry).toMatch(new RegExp(`^### ${name}(?![\\w])`, "m"));
  });

  it("os componentes do dashboard e do KokonutUI existem em disco (a varredura não é vazia)", () => {
    expect(kokonutFiles.length).toBeGreaterThanOrEqual(2);
    expect(dashboardFiles.length).toBeGreaterThanOrEqual(3);
  });

  it("AdminOverview descreve os cartões da Fase 2", () => {
    expect(registry).toContain(
      "2026-11-21 — Fase 2: cartões dos cinco cadastros",
    );
  });
});
