import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import robots from "./robots";

describe("robots.txt", () => {
  it("proíbe todos os buscadores em todo o site", () => {
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
});

describe("metadata do layout raiz", () => {
  // O layout importa next/font/google, que o Vitest não resolve: o guarda lê o
  // texto do arquivo (a meta sai no HTML; o smoke e o E2E conferem a página).
  it("pede noindex e nofollow", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false/);
  });
});
