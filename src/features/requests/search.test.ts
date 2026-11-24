import { describe, expect, it } from "vitest";

import { codePointLength } from "@/features/handovers/fieldRules";

import { SEARCH_MAX_LENGTH } from "./limits";
import {
  foldForSearch,
  normalizeSearch,
  SEARCH_FOLD_FROM,
  SEARCH_FOLD_TO,
  searchPattern,
} from "./search";

describe("tabela de dobra", () => {
  it("as duas strings têm 24 caracteres, mesma posição", () => {
    expect(Array.from(SEARCH_FOLD_FROM)).toHaveLength(24);
    expect(Array.from(SEARCH_FOLD_TO)).toHaveLength(24);
  });
});

describe("normalizeSearch", () => {
  it("vazio e só espaços viram vazio", () => {
    expect(normalizeSearch("")).toBe("");
    expect(normalizeSearch("   \n\t ")).toBe("");
  });

  it("colapsa espaços e quebras e tira as pontas", () => {
    expect(normalizeSearch("  rede \n  de   proteção ")).toBe(
      "rede de proteção",
    );
  });

  it("NFD vira NFC", () => {
    expect(normalizeSearch("separac\u{327}a\u{303}o")).toBe("separação");
  });

  it("80 pontos de código passam; 81 são cortados em 80", () => {
    const eighty = "a".repeat(SEARCH_MAX_LENGTH);
    expect(normalizeSearch(eighty)).toBe(eighty);
    expect(normalizeSearch(`${eighty}b`)).toBe(eighty);
  });

  it("emoji conta 1 ponto de código, nunca é partido ao meio", () => {
    const text = "🙂".repeat(SEARCH_MAX_LENGTH + 1);
    const result = normalizeSearch(text);
    expect(codePointLength(result)).toBe(SEARCH_MAX_LENGTH);
    expect(result).toBe("🙂".repeat(SEARCH_MAX_LENGTH));
  });

  it("o corte que termina em espaço não deixa espaço no fim", () => {
    const text = `${"a".repeat(SEARCH_MAX_LENGTH - 1)} b`;
    expect(normalizeSearch(text)).toBe("a".repeat(SEARCH_MAX_LENGTH - 1));
  });
});

describe("foldForSearch", () => {
  it("tira acento, cedilha e til, em minúsculas", () => {
    expect(foldForSearch("SEPARAÇÃO Rápida")).toBe("separacao rapida");
  });

  it.each(
    Array.from(SEARCH_FOLD_FROM),
  )("a letra %s dobra para a da tabela, minúscula e maiúscula", (letter) => {
    const expected = SEARCH_FOLD_TO.charAt(SEARCH_FOLD_FROM.indexOf(letter));
    expect(foldForSearch(letter)).toBe(expected);
    expect(foldForSearch(letter.toUpperCase())).toBe(expected);
  });

  it("NFD e NFC dão o mesmo resultado", () => {
    expect(foldForSearch("a\u{301}")).toBe("a");
    expect(foldForSearch("c\u{327}")).toBe("c");
    expect(foldForSearch("n\u{303}")).toBe("n");
  });

  it("não mexe no que não está na tabela (números, símbolos, emoji)", () => {
    expect(foldForSearch("Doca 3 - 12% 🙂")).toBe("doca 3 - 12% 🙂");
  });

  it("vazio continua vazio", () => {
    expect(foldForSearch("")).toBe("");
  });
});

describe("searchPattern", () => {
  it("vazio e só espaços → null (sem filtro)", () => {
    expect(searchPattern("")).toBeNull();
    expect(searchPattern("   ")).toBeNull();
  });

  it("envolve em % e dobra acento e caixa", () => {
    expect(searchPattern("Rápida")).toBe("%rapida%");
    expect(searchPattern("separação")).toBe("%separacao%");
  });

  it("%, _ e \\ valem como texto (escapados com \\)", () => {
    expect(searchPattern("100%")).toBe("%100\\%%");
    expect(searchPattern("a_b")).toBe("%a\\_b%");
    expect(searchPattern("c:\\doca")).toBe("%c:\\\\doca%");
  });

  it("a barra escapa antes dos outros: '\\%' vira '\\\\\\%'", () => {
    expect(searchPattern("\\%")).toBe("%\\\\\\%%");
  });

  it("emoji passa intacto", () => {
    expect(searchPattern("🙂")).toBe("%🙂%");
  });
});
