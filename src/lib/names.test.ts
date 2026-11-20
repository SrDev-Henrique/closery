import { describe, expect, it } from "vitest";

import { firstName, greetingTitle } from "@/lib/names";

describe("firstName", () => {
  it("devolve a primeira palavra do nome", () => {
    expect(firstName("Maria Souza")).toBe("Maria");
  });

  it("devolve o nome inteiro quando há uma palavra só", () => {
    expect(firstName("Ana")).toBe("Ana");
  });

  it("ignora espaços nas pontas e repetidos", () => {
    expect(firstName("   Ana    Paula  ")).toBe("Ana");
  });

  it("trata quebra de linha e tabulação como separador", () => {
    expect(firstName("Ana\tPaula")).toBe("Ana");
    expect(firstName("Ana\nPaula")).toBe("Ana");
  });

  it("preserva acentos e caracteres fora do latim básico", () => {
    expect(firstName("José Álvaro")).toBe("José");
    expect(firstName("李 雷")).toBe("李");
  });

  it("devolve texto vazio para nome vazio ou só de espaços", () => {
    expect(firstName("")).toBe("");
    expect(firstName("   ")).toBe("");
  });
});

describe("greetingTitle", () => {
  it("monta 'Olá, {primeiro nome}'", () => {
    expect(greetingTitle("Maria Souza")).toBe("Olá, Maria");
  });

  it("cai para 'Olá' sem vírgula solta quando o nome está vazio", () => {
    expect(greetingTitle("")).toBe("Olá");
    expect(greetingTitle("  ")).toBe("Olá");
  });
});
