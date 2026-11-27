import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Licença da Satoshi (ITF FFL): o .woff2 não pode ir para artefato público. O trace do Playwright
// guarda os recursos da página (fontes) junto dos snapshots do DOM; no CI o trace fica só com
// prints, passos e console.

const read = (path: string) =>
  readFileSync(path, "utf8").replaceAll("\r\n", "\n");

describe("trace do Playwright no CI", () => {
  const config = read("playwright.config.ts");

  it("no CI o trace não grava snapshots do DOM nem fontes do código", () => {
    expect(config).toMatch(/process\.env\.CI/);
    expect(config).toMatch(/snapshots:\s*false/);
    expect(config).toMatch(/sources:\s*false/);
    expect(config).toMatch(/screenshots:\s*true/);
  });

  it("fora do CI o trace continua retain-on-failure", () => {
    expect(config).toContain('"retain-on-failure"');
  });

  it("o artefato do CI é só a pasta do relatório do Playwright", () => {
    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("path: playwright-report/");
  });
});
