import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guarda estrutural: toda página do grupo (app) fica atrás do RequireUser do
// layout. Uma página nova que esquecesse requireUser não pode virar casca
// estática servida a quem só passou pelo proxy otimista.
const LAYOUT = readFileSync(
  join(process.cwd(), "src", "app", "(app)", "layout.tsx"),
  "utf8",
);
const CODE = LAYOUT.replace(/\/\/.*$/gm, "");

describe("layout do grupo (app)", () => {
  it("envolve {children} em <RequireUser>", () => {
    expect(LAYOUT).toMatch(/<RequireUser>\s*\{children\}\s*<\/RequireUser>/);
  });

  it("o RequireUser fica dentro de um <Suspense> (Cache Components)", () => {
    expect(LAYOUT).toMatch(
      /<Suspense fallback=\{[^}]*\}>\s*<RequireUser>\s*\{children\}\s*<\/RequireUser>\s*<\/Suspense>/,
    );
  });

  it("o layout não faz await no topo (a sessão é lida dentro do Suspense)", () => {
    expect(CODE).not.toMatch(/\bawait\b/);
    expect(CODE).not.toMatch(/export default async function/);
  });
});
