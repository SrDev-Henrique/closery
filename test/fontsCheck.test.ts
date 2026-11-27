import { describe, expect, it } from "vitest";

import {
  FONTSHARE_CSS_URL,
  isSatoshiFileValid,
  parseFontshareCss,
  SATOSHI_SHA256,
  SATOSHI_WEIGHTS,
  satoshiPath,
  sha256Hex,
} from "../scripts/fontsCheck.mjs";
import { fakeFontBytes, fixtureUrl, fontshareCss } from "./fontsFixtures";

// Regras puras da Satoshi (scripts/fontsCheck.mjs). O CLI (scripts/fetchFonts.mjs) só baixa e grava.

describe("SATOSHI_SHA256 e SATOSHI_WEIGHTS", () => {
  it("têm os três pesos e os hashes fixados do contrato", () => {
    expect(SATOSHI_WEIGHTS).toEqual([500, 700, 900]);
    expect(SATOSHI_SHA256).toEqual({
      500: "af02a72246f53ad49c44a591921edbd39ec8258a03d8cc2e0532aa1e497e85b4",
      700: "353a7fbfb4475f0c31470a7449226006cb64211c71055ca9db860a8acdaa9f68",
      900: "bd11b5820231420e78046c611aebdd628dc17ad67788258ffe3fe902253efd3b",
    });
    for (const hash of Object.values(SATOSHI_SHA256)) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("a URL do CSS pede os três pesos", () => {
    expect(FONTSHARE_CSS_URL).toBe(
      "https://api.fontshare.com/v2/css?f[]=satoshi@500,700,900&display=swap",
    );
  });
});

describe("satoshiPath", () => {
  it.each([
    [500, "src/fonts/satoshi/Satoshi-500.woff2"],
    [700, "src/fonts/satoshi/Satoshi-700.woff2"],
    [900, "src/fonts/satoshi/Satoshi-900.woff2"],
  ] as const)("peso %i → %s (sempre com /, vale no Windows e no Linux)", (weight, path) => {
    expect(satoshiPath(weight)).toBe(path);
  });

  it("recusa peso que não é dos três (400 não existe aqui)", () => {
    expect(() => satoshiPath(400 as never)).toThrow(
      "Peso da Satoshi não suportado: 400",
    );
  });
});

describe("sha256Hex", () => {
  it("bate com os vetores conhecidos do SHA-256", () => {
    expect(sha256Hex(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(sha256Hex(new Uint8Array())).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});

describe("isSatoshiFileValid", () => {
  const expected = {
    500: sha256Hex(fakeFontBytes(500)),
    700: sha256Hex(fakeFontBytes(700)),
    900: sha256Hex(fakeFontBytes(900)),
  };

  it("aceita os bytes com o hash do peso", () => {
    expect(isSatoshiFileValid(500, fakeFontBytes(500), expected)).toBe(true);
  });

  it("recusa bytes de outro peso, vazios e adulterados", () => {
    expect(isSatoshiFileValid(500, fakeFontBytes(700), expected)).toBe(false);
    expect(isSatoshiFileValid(500, new Uint8Array(), expected)).toBe(false);
    expect(
      isSatoshiFileValid(
        500,
        Uint8Array.from([...fakeFontBytes(500), 0]),
        expected,
      ),
    ).toBe(false);
  });

  it("sem o terceiro argumento usa os hashes fixados (bytes de mentira reprovam)", () => {
    expect(isSatoshiFileValid(500, fakeFontBytes(500))).toBe(false);
  });
});

describe("parseFontshareCss", () => {
  it("lê o woff2 de cada peso do CSS no formato real, com https:", () => {
    const urls = parseFontshareCss(fontshareCss());
    expect([...urls.keys()]).toEqual([500, 700, 900]);
    expect(urls.get(500)).toBe(`https:${fixtureUrl(500, "woff2")}`);
    expect(urls.get(700)).toBe(`https:${fixtureUrl(700, "woff2")}`);
    expect(urls.get(900)).toBe(`https:${fixtureUrl(900, "woff2")}`);
  });

  it("nunca devolve o woff nem o ttf", () => {
    for (const url of parseFontshareCss(fontshareCss()).values()) {
      expect(url.endsWith(".woff2")).toBe(true);
    }
  });

  it("lê CRLF, aspas duplas, URL já com https:// e um peso só", () => {
    const css = [
      "@font-face {",
      "  font-family: 'Satoshi';",
      '  src: url("https://cdn.fontshare.com/wf/A/B/C.woff2") format("woff2"),',
      '       url("https://cdn.fontshare.com/wf/A/B/C.woff") format("woff");',
      "  font-weight: 700;",
      "}",
    ].join("\r\n");
    expect(parseFontshareCss(css)).toEqual(
      new Map([[700, "https://cdn.fontshare.com/wf/A/B/C.woff2"]]),
    );
  });

  it("falha alto sem nenhum @font-face (corpo vazio ou HTML de erro)", () => {
    expect(() => parseFontshareCss("")).toThrow("nenhum @font-face");
    expect(() => parseFontshareCss("<html>Bad gateway</html>")).toThrow(
      "nenhum @font-face",
    );
  });

  it("falha alto quando um peso vem sem woff2", () => {
    const css = `@font-face {
  src: url('//cdn.fontshare.com/wf/A/B/C.ttf') format('truetype');
  font-weight: 500;
}`;
    expect(() => parseFontshareCss(css)).toThrow("sem woff2 no peso 500");
  });

  it("recusa URL que não é da CDN da Fontshare (defesa em profundidade além do hash)", () => {
    const css = `@font-face {
  src: url('//cdn.exemplo.test/wf/A/B/C.woff2') format('woff2');
  font-weight: 500;
}`;
    expect(() => parseFontshareCss(css)).toThrow("URL de fonte inesperada");
    const http = `@font-face {
  src: url('http://cdn.fontshare.com/wf/A/B/C.woff2') format('woff2');
  font-weight: 500;
}`;
    expect(() => parseFontshareCss(http)).toThrow("URL de fonte inesperada");
  });

  it("ignora bloco sem font-weight (não é um dos nossos pesos)", () => {
    const css = `@font-face { font-family: 'X'; src: url('//cdn.fontshare.com/wf/A/B/C.woff2') format('woff2'); }\n${fontshareCss([900])}`;
    expect([...parseFontshareCss(css).keys()]).toEqual([900]);
  });
});
