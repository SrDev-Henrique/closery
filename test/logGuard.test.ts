import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { listSourceFiles, stripComments } from "./actionGuards";

// Guarda do log: um erro do Drizzle carrega SQL e parâmetros na mensagem, então
// nada em src/ escreve no console por conta própria. Todo erro inesperado passa
// por src/lib/logServerError.ts (resumo sem mensagem, pilha nem objeto). O
// mesmo vale para o Sentry: nenhum outro arquivo o importa, então nada sai sem
// passar pelo scrubEvent (beforeSend) nem pelo resumo do log.

const LOGGER = "src/lib/logServerError.ts";
const SENTRY_IMPORTERS = [
  "src/instrumentation-client.ts",
  "src/instrumentation.ts",
  "src/lib/logServerError.ts",
  "src/lib/sentry/options.ts",
  "src/lib/sentry/scrubEvent.ts",
];

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

  it("@sentry/nextjs só entra pelos 5 arquivos da integração", () => {
    const importers = productionFiles().filter((file) =>
      code(file).includes("@sentry/"),
    );
    expect(importers.sort()).toEqual(SENTRY_IMPORTERS);
  });

  it("o scrubEvent só importa tipo do Sentry (sem código de runtime)", () => {
    const source = code("src/lib/sentry/scrubEvent.ts");
    expect(source).toContain(
      'import type { ErrorEvent } from "@sentry/nextjs";',
    );
    expect(source.split("@sentry/")).toHaveLength(2);
  });
});
