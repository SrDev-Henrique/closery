import { describe, expect, it } from "vitest";

import {
  CORRECTED_LABEL,
  HISTORY_SITUATIONS,
  STATUS_DESCRIPTION,
  situationLabel,
} from "./status";

describe("situationLabel", () => {
  it("rótulo de cada situação", () => {
    expect(situationLabel("awaiting")).toBe("Aguardando recebimento");
    expect(situationLabel("unconfirmed")).toBe("Não confirmada");
    expect(situationLabel("missing")).toBe("Sem passagem");
  });

  it("confirmada leva o nome de quem confirmou", () => {
    expect(situationLabel("confirmed", "Bia Teste")).toBe(
      "Confirmada por Bia Teste",
    );
  });

  it('confirmada sem nome (null, undefined ou vazio): só "Confirmada"', () => {
    expect(situationLabel("confirmed")).toBe("Confirmada");
    expect(situationLabel("confirmed", null)).toBe("Confirmada");
    expect(situationLabel("confirmed", "")).toBe("Confirmada");
    expect(situationLabel("confirmed", "   ")).toBe("Confirmada");
  });

  it("o nome só entra na situação confirmada", () => {
    expect(situationLabel("awaiting", "Bia Teste")).toBe(
      "Aguardando recebimento",
    );
  });

  it("toda situação tem rótulo não vazio", () => {
    for (const situation of HISTORY_SITUATIONS) {
      expect(situationLabel(situation, "Bia Teste")).not.toBe("");
    }
  });
});

describe("constantes", () => {
  it("lista as quatro situações do histórico", () => {
    expect([...HISTORY_SITUATIONS]).toEqual([
      "awaiting",
      "confirmed",
      "unconfirmed",
      "missing",
    ]);
  });

  it("selo de correção", () => {
    expect(CORRECTED_LABEL).toBe("Corrigida");
  });

  it("descrição de cada status da passagem", () => {
    expect(STATUS_DESCRIPTION).toEqual({
      draft: "Rascunho",
      delivered: "Entregue",
      confirmed: "Confirmada",
    });
  });
});
