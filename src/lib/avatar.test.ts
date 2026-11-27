import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { AVATAR_BACKGROUNDS, avatarDataUri } from "./avatar";

describe("avatarDataUri", () => {
  it("devolve um data URI de SVG", () => {
    const uri = avatarDataUri("usuario-1");
    expect(uri.startsWith("data:image/svg+xml")).toBe(true);
    expect(decodeURIComponent(uri.slice(uri.indexOf(",") + 1))).toContain(
      "<svg",
    );
  });

  it("é determinístico: a mesma semente dá exatamente o mesmo resultado", () => {
    expect(avatarDataUri("usuario-1")).toBe(avatarDataUri("usuario-1"));
  });

  it("é determinístico mesmo sem o cache (instância nova do módulo)", async () => {
    const primeiro = avatarDataUri("usuario-fixo");
    const { vi } = await import("vitest");
    vi.resetModules();
    const outroModulo = await import("./avatar");
    expect(outroModulo.avatarDataUri("usuario-fixo")).toBe(primeiro);
  });

  it("trava a saída: o SHA-256 do data URI de uma semente fixa não muda (troca de versão do DiceBear que mude a arte falha aqui)", () => {
    const uri = avatarDataUri("00000000-0000-4000-8000-000000000001");
    expect(createHash("sha256").update(uri).digest("hex")).toBe(
      "0c4c7daa68bf5cca1ddc3ec5ac577e3eefd4725f93351b7110f2216f5bc4ad57",
    );
  });

  it("sementes diferentes dão avatares diferentes", () => {
    expect(avatarDataUri("usuario-1")).not.toBe(avatarDataUri("usuario-2"));
  });

  it("semente de uma letra e semente longa com acento funcionam", () => {
    expect(avatarDataUri("a").startsWith("data:image/svg+xml")).toBe(true);
    const longa = `ação-${"x".repeat(500)}`;
    expect(avatarDataUri(longa).startsWith("data:image/svg+xml")).toBe(true);
  });

  it.each([
    "",
    "   ",
    "\n\t",
  ])("semente vazia (%j) lança erro claro em vez de gerar um avatar anônimo", (seed) => {
    expect(() => avatarDataUri(seed)).toThrow(
      "avatarDataUri: a semente não pode ser vazia",
    );
  });

  it("exporta os quatro fundos pastel da spec (única exceção de cor crua do projeto)", () => {
    expect(AVATAR_BACKGROUNDS).toEqual([
      "#b6e3f4",
      "#ffdfbf",
      "#ffd5dc",
      "#d1d4f9",
    ]);
  });
});
