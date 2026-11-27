import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A Satoshi só funciona se o script rodar antes do dev e do build, o arquivo nunca entrar no git
// (licença ITF FFL: repositório público é proibido) e o CI guardar a pasta em cache.

const read = (path: string) =>
  readFileSync(path, "utf8").replaceAll("\r\n", "\n");

describe("configuração da Satoshi", () => {
  const scripts = JSON.parse(read("package.json")).scripts as Record<
    string,
    string
  >;

  it("package.json: `fonts` baixa e `predev`/`prebuild` o chamam", () => {
    expect(scripts.fonts).toBe("bun scripts/fetchFonts.mjs");
    expect(scripts.predev).toBe("bun run fonts");
    expect(scripts.prebuild).toBe("bun run fonts");
  });

  it(".gitignore: a pasta da fonte fica fora do git", () => {
    expect(read(".gitignore").split("\n")).toContain("/src/fonts/satoshi/");
  });

  it("ci.yml: o job do E2E guarda src/fonts/satoshi, com a chave pelo hash do script, antes do E2E", () => {
    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("path: src/fonts/satoshi");
    expect(ci).toContain(
      `key: satoshi-\${{ hashFiles('scripts/fontsCheck.mjs') }}`,
    );
    expect(ci.indexOf("src/fonts/satoshi")).toBeLessThan(
      ci.indexOf("bun run test:e2e"),
    );
  });

  it("layout.tsx: next/font/local com os 3 pesos, a variável --font-satoshi e swap", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain('from "next/font/local"');
    for (const weight of [500, 700, 900]) {
      expect(layout).toContain(`../fonts/satoshi/Satoshi-${weight}.woff2`);
      expect(layout).toContain(`weight: "${weight}"`);
    }
    expect(layout).toContain('variable: "--font-satoshi"');
    expect(layout).toContain('display: "swap"');
    expect(layout).toContain(`\${satoshi.variable}`);
  });

  it("globals.css: font-heading aponta para a Satoshi", () => {
    expect(read("src/app/globals.css")).toMatch(
      /--font-heading:\s*var\(--font-satoshi\)\s*;/,
    );
  });
});
