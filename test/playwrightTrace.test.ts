import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

// Licença da Satoshi (ITF FFL): o .woff2 não pode ir para artefato público. O trace do Playwright
// guarda os recursos da página (fontes) junto dos snapshots do DOM; no CI o trace fica só com
// prints, passos e console.
//
// A config é avaliada de verdade, com `CI` ligado e desligado: um ternário invertido (o objeto sem
// snapshots fora do CI e o trace completo no CI) faz o teste falhar. O `e2e/db` puxa o banco, então
// entra só com as constantes que a config usa.
vi.mock("../e2e/db", () => ({
  E2E_APP_PORT: 3200,
  E2E_DB_PORT: 54329,
  E2E_DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:54329/postgres",
}));

async function traceWith(ci: string) {
  vi.resetModules();
  vi.stubEnv("CI", ci);
  const { default: config } = await import("../playwright.config");
  return config.use?.trace;
}

const read = (path: string) =>
  readFileSync(path, "utf8").replaceAll("\r\n", "\n");

describe("trace do Playwright no CI", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("no CI o trace não grava snapshots do DOM nem fontes do código, e guarda os prints", async () => {
    expect(await traceWith("true")).toEqual({
      mode: "retain-on-failure",
      snapshots: false,
      screenshots: true,
      sources: false,
    });
  });

  it("fora do CI o trace é o completo, retain-on-failure (sem o objeto que tira snapshots)", async () => {
    expect(await traceWith("")).toBe("retain-on-failure");
  });

  it("o artefato do CI é só a pasta do relatório do Playwright", () => {
    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("path: playwright-report/");
  });
});
