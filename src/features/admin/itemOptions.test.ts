import { describe, expect, it } from "vitest";

import {
  DEFAULT_UNIT,
  ITEM_FORM_DEFAULTS,
  ITEM_KIND_HELP,
  ITEM_KIND_LABELS,
  ITEM_UNIT_LABELS,
  ITEM_UNITS,
  OTHER_UNIT,
  resolveUnit,
  splitUnit,
  UNIT_MAX_LENGTH,
} from "@/features/admin/itemOptions";

describe("listas e rótulos", () => {
  it("a lista de unidades é a decidida pelo dono, na ordem", () => {
    expect([...ITEM_UNITS]).toEqual([
      "unidade",
      "rolo",
      "par",
      "pacote",
      "caixa",
      "saco",
      "metro",
      "kg",
    ]);
  });

  it("toda unidade tem rótulo; só 'kg' fica em minúsculas", () => {
    for (const unit of ITEM_UNITS) {
      expect(ITEM_UNIT_LABELS[unit]).toBeTruthy();
    }
    expect(ITEM_UNIT_LABELS.unidade).toBe("Unidade");
    expect(ITEM_UNIT_LABELS.kg).toBe("kg");
  });

  it("rótulos e ajudas dos tipos", () => {
    expect(ITEM_KIND_LABELS).toEqual({ control: "Controle", stock: "Estoque" });
    expect(ITEM_KIND_HELP.control).toBe(
      "Controle: soma no período, como redes danificadas.",
    );
    expect(ITEM_KIND_HELP.stock).toBe(
      "Estoque: vale a última contagem, nunca a soma.",
    );
  });

  it("o formulário nunca começa em branco: unidade e tipo vêm preenchidos", () => {
    expect(DEFAULT_UNIT).toBe("unidade");
    expect(OTHER_UNIT).toBe("outro");
    expect(UNIT_MAX_LENGTH).toBe(20);
    expect(ITEM_FORM_DEFAULTS).toEqual({
      name: "",
      unitChoice: "unidade",
      unitOther: "",
      kind: "control",
    });
  });
});

describe("resolveUnit", () => {
  it("unidade da lista vale por ela mesma e ignora o texto de 'Outro'", () => {
    expect(resolveUnit("rolo", "")).toEqual({ ok: true, unit: "rolo" });
    expect(resolveUnit("kg", "lixo")).toEqual({ ok: true, unit: "kg" });
  });

  it("'Outro' com texto grava o texto normalizado", () => {
    expect(resolveUnit("outro", "  Bobina   grande ")).toEqual({
      ok: true,
      unit: "Bobina grande",
    });
  });

  it("'Outro' vazio ou só espaços: 'Informe a unidade.' no campo do texto", () => {
    expect(resolveUnit("outro", "")).toEqual({
      ok: false,
      field: "unitOther",
      message: "Informe a unidade.",
    });
    expect(resolveUnit("outro", "   ")).toEqual({
      ok: false,
      field: "unitOther",
      message: "Informe a unidade.",
    });
  });

  it("'Outro' aceita 20 caracteres e recusa 21", () => {
    expect(resolveUnit("outro", "a".repeat(20))).toEqual({
      ok: true,
      unit: "a".repeat(20),
    });
    expect(resolveUnit("outro", "a".repeat(21))).toEqual({
      ok: false,
      field: "unitOther",
      message: "A unidade pode ter no máximo 20 caracteres.",
    });
  });

  it("conta pontos de código: 20 emojis cabem", () => {
    expect(resolveUnit("outro", "\u{1F600}".repeat(20)).ok).toBe(true);
    expect(resolveUnit("outro", "\u{1F600}".repeat(21)).ok).toBe(false);
  });

  it("'Outro' igual a uma da lista (sem caixa) vira o valor da lista", () => {
    expect(resolveUnit("outro", "Rolo")).toEqual({ ok: true, unit: "rolo" });
    expect(resolveUnit("outro", " KG ")).toEqual({ ok: true, unit: "kg" });
  });

  it("escolha desconhecida ou vazia: 'Escolha uma unidade.' no campo da escolha", () => {
    const expected = {
      ok: false,
      field: "unitChoice",
      message: "Escolha uma unidade.",
    };
    expect(resolveUnit("litro", "")).toEqual(expected);
    expect(resolveUnit("", "")).toEqual(expected);
    expect(resolveUnit("Rolo", "")).toEqual(expected);
  });
});

describe("splitUnit", () => {
  it("unidade da lista volta como escolha, sem texto extra", () => {
    expect(splitUnit("pacote")).toEqual({ choice: "pacote", other: "" });
  });

  it("unidade antiga fora da lista vira 'Outro' com o texto", () => {
    expect(splitUnit("Bobina grande")).toEqual({
      choice: "outro",
      other: "Bobina grande",
    });
  });

  it("caixa diferente da lista também cai em 'Outro' (o dado antigo é preservado)", () => {
    expect(splitUnit("Rolo")).toEqual({ choice: "outro", other: "Rolo" });
  });

  it("ida e volta: o que splitUnit devolve, resolveUnit aceita", () => {
    for (const unit of ["rolo", "Bobina grande"]) {
      const { choice, other } = splitUnit(unit);
      expect(resolveUnit(choice, other)).toEqual({ ok: true, unit });
    }
  });
});
