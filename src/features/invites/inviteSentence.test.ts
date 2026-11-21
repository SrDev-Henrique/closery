import { describe, expect, it } from "vitest";
import { inviteSentence } from "./inviteSentence";

describe("inviteSentence", () => {
  it("operador convidado por alguém: setor e papel", () => {
    expect(
      inviteSentence({
        role: "operator",
        sectorName: "ULD",
        inviterName: "Marta Teste",
      }),
    ).toBe("Marta Teste te convidou para o setor ULD como Operador.");
  });

  it("administrador convidado por alguém: sem setor", () => {
    expect(
      inviteSentence({
        role: "admin",
        sectorName: null,
        inviterName: "Marta Teste",
      }),
    ).toBe("Marta Teste te convidou como Administrador.");
  });

  it("administrador criado pelo script (sem convidante)", () => {
    expect(
      inviteSentence({ role: "admin", sectorName: null, inviterName: null }),
    ).toBe("Você foi convidado como Administrador.");
  });

  it("operador criado pelo script (sem convidante) mantém o setor", () => {
    expect(
      inviteSentence({
        role: "operator",
        sectorName: "ULD",
        inviterName: null,
      }),
    ).toBe("Você foi convidado para o setor ULD como Operador.");
  });

  it("administrador ignora o setor, mesmo que exista", () => {
    expect(
      inviteSentence({ role: "admin", sectorName: "ULD", inviterName: "Ana" }),
    ).toBe("Ana te convidou como Administrador.");
  });

  it("operador sem nome de setor não inventa um setor", () => {
    expect(
      inviteSentence({
        role: "operator",
        sectorName: null,
        inviterName: "Ana",
      }),
    ).toBe("Ana te convidou como Operador.");
  });

  it("preserva nomes com acento e emoji sem alterar", () => {
    expect(
      inviteSentence({
        role: "operator",
        sectorName: "Armazém Ç",
        inviterName: "José 🚀",
      }),
    ).toBe("José 🚀 te convidou para o setor Armazém Ç como Operador.");
  });
});
