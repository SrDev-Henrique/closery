import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { listSourceFiles, stripComments } from "./actionGuards";

// Guarda do log: um erro do Drizzle carrega SQL e parâmetros na mensagem, então
// nada em src/ escreve no console por conta própria. Todo erro inesperado passa
// por src/lib/logServerError.ts (resumo sem mensagem, pilha nem objeto).

const LOGGER = "src/lib/logServerError.ts";

function productionFiles(): string[] {
  return listSourceFiles(
    "src",
    (name) => /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name),
  ).map((file) => file.replaceAll("\\", "/"));
}

function code(file: string): string {
  return stripComments(readFileSync(file, "utf8"));
}

describe("log de erro", () => {
  it("só o logServerError escreve no console em src/", () => {
    const offenders = productionFiles().filter(
      (file) => file !== LOGGER && /\bconsole\./.test(code(file)),
    );
    expect(offenders).toEqual([]);
  });

  it("o logServerError é o único que escreve, e escreve uma vez", () => {
    expect(code(LOGGER).match(/\bconsole\./g)).toHaveLength(1);
  });

  it("a varredura enxerga os arquivos de produção (não passa por estar vazia)", () => {
    const files = productionFiles();
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain(LOGGER);
  });
});
