import { describe, expect, it } from "vitest";

import {
  NAME_MAX_LENGTH,
  normalizeName,
  validateName,
} from "@/features/admin/names";

describe("normalizeName", () => {
  it("tira espaços das pontas e colapsa os do meio", () => {
    expect(normalizeName("  Rede   de \t proteção \n")).toBe(
      "Rede de proteção",
    );
  });

  it("converte para NFC: 'e' + acento combinante vira 'é'", () => {
    const decomposed = "Cafe\u{301}";
    expect(decomposed).toHaveLength(5);
    expect(normalizeName(decomposed)).toBe("Café");
    expect(normalizeName(decomposed)).toHaveLength(4);
  });

  it("devolve vazio para vazio ou só espaços", () => {
    expect(normalizeName("")).toBe("");
    expect(normalizeName("   \n\t ")).toBe("");
  });

  it("colapsa espaço não separável e outros espaços Unicode", () => {
    expect(normalizeName("Carga\u{a0}\u{a0}geral")).toBe("Carga geral");
  });
});

describe("validateName", () => {
  it("aceita um nome e devolve o normalizado", () => {
    expect(validateName("  Carga   geral ")).toEqual({
      ok: true,
      name: "Carga geral",
    });
  });

  it("recusa vazio e só espaços com 'Informe o nome.'", () => {
    expect(validateName("")).toEqual({ ok: false, message: "Informe o nome." });
    expect(validateName("   ")).toEqual({
      ok: false,
      message: "Informe o nome.",
    });
  });

  it("aceita exatamente 60 caracteres e recusa 61", () => {
    expect(NAME_MAX_LENGTH).toBe(60);
    expect(validateName("a".repeat(60)).ok).toBe(true);
    expect(validateName("a".repeat(61))).toEqual({
      ok: false,
      message: "O nome pode ter no máximo 60 caracteres.",
    });
  });

  it("conta pontos de código: 60 emojis cabem, 61 não", () => {
    const emoji = "\u{1F600}";
    expect(emoji).toHaveLength(2);
    expect(validateName(emoji.repeat(60)).ok).toBe(true);
    expect(validateName(emoji.repeat(61)).ok).toBe(false);
  });

  it("mede depois de normalizar: espaços sobrando e acento decomposto não pesam", () => {
    const decomposed = "e\u{301}".repeat(60);
    expect(validateName(`  ${decomposed}  `)).toEqual({
      ok: true,
      name: "é".repeat(60),
    });
  });
});
