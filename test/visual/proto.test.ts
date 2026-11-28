import { describe, expect, it } from "vitest";

import { parseNamesList } from "../../scripts/visual/names.mjs";
import {
  applyReplacements,
  findLeftovers,
  readProps,
  setPropDefaults,
} from "../../scripts/visual/proto.mjs";

// O motor das cópias do protótipo (spec §5.6), com HTML sintético e uma lista sintética
// de termos inventados. Os erros dizem o número da troca ou da linha da lista, nunca o texto.

const PROPS = {
  tema: { editor: "enum", options: ["Escuro", "Claro"], default: "Escuro" },
  pendente: { editor: "boolean", default: false },
};

function encode(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function page(
  props: unknown = PROPS,
  body = "<p>Fulano Inventado & cia</p>",
): string {
  return `<!doctype html><div data-props="${encode(JSON.stringify(props))}">${body}</div>`;
}

function messageOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "";
}

describe("applyReplacements", () => {
  it("troca todas as ocorrências, na ordem (a segunda vê o resultado da primeira)", () => {
    expect(
      applyReplacements("a-b-a", [
        ["a", "x"],
        ["x-b", "y"],
      ]),
    ).toBe("y-x");
  });

  it("sem troca, devolve o mesmo texto", () => {
    expect(applyReplacements("abc", [])).toBe("abc");
  });

  it("troca ausente: erro com o número, sem o texto original", () => {
    const message = messageOf(() =>
      applyReplacements("abc", [
        ["a", "x"],
        ["Original Secreto", "y"],
      ]),
    );
    expect(message).toBe("troca nº 2 não encontrada");
    expect(message).not.toContain("Original Secreto");
  });

  it("troca mal formada e lista que não é lista", () => {
    expect(() => applyReplacements("abc", [["", "x"]])).toThrow(
      "troca nº 1 inválida",
    );
    expect(() => applyReplacements("abc", [["a"]])).toThrow(
      "troca nº 1 inválida",
    );
    expect(() => applyReplacements("abc", "a")).toThrow("não são uma lista");
  });
});

describe("readProps e setPropDefaults", () => {
  it("lê o data-props decodificado", () => {
    expect(readProps(page())).toEqual(PROPS);
  });

  it("muda o default e mantém o resto da página e das props", () => {
    const html = setPropDefaults(page(), { tema: "Claro", pendente: true });
    expect(readProps(html)).toEqual({
      tema: { ...PROPS.tema, default: "Claro" },
      pendente: { ...PROPS.pendente, default: true },
    });
    expect(html).toContain("<p>Fulano Inventado & cia</p>");
    expect(html.startsWith("<!doctype html><div data-props=")).toBe(true);
  });

  it("prop desconhecida, valor fora das opções e tipo errado lançam", () => {
    expect(() => setPropDefaults(page(), { perfil: "Colega" })).toThrow(
      "prop desconhecida: perfil",
    );
    expect(() => setPropDefaults(page(), { tema: "Sépia" })).toThrow(
      "valor fora das opções da prop tema",
    );
    expect(() => setPropDefaults(page(), { pendente: "sim" })).toThrow(
      "a prop pendente é booleana",
    );
  });

  it("sem data-props, com dois, ou com JSON quebrado: lança", () => {
    expect(() => readProps("<div></div>")).toThrow(
      "a cópia não tem data-props",
    );
    expect(() => readProps(`${page()}${page()}`)).toThrow(
      "a cópia tem 2 data-props",
    );
    expect(() => readProps('<div data-props="{nada"></div>')).toThrow(
      "data-props não é um JSON válido",
    );
    expect(() => readProps('<div data-props="[1]"></div>')).toThrow(
      "data-props não é um objeto",
    );
  });
});

describe("findLeftovers", () => {
  const list = parseNamesList(
    [
      "# lista sintética, só com termos inventados",
      "Fulano Inventado",
      "!Fulano Inventado de Teste",
      "pessoa.inventada@exemplo.test",
    ].join("\n"),
  );
  const nameLine = list.terms[0]?.listLine;
  const emailLine = list.terms[1]?.listLine;

  it("acha o termo da lista pela linha da lista, sem caixa", () => {
    expect(findLeftovers("<p>FULANO INVENTADO</p>", list)).toEqual([
      { kind: "lista", listLine: nameLine, line: 1 },
    ]);
    expect(findLeftovers("a\nPessoa.Inventada@exemplo.test", list)).toEqual([
      { kind: "lista", listLine: emailLine, line: 2 },
    ]);
  });

  it("a frase permitida (!) não conta, e texto limpo não acha nada", () => {
    expect(findLeftovers("Fulano Inventado de Teste", list)).toEqual([]);
    expect(findLeftovers("Ana Teste e Bruno Teste", list)).toEqual([]);
  });

  it("os leftovers extras contam pelo número, sem caixa", () => {
    expect(
      findLeftovers("img de api.exemplo.test", list, [
        "outro.test",
        "API.EXEMPLO.TEST",
      ]),
    ).toEqual([{ kind: "extra", index: 2 }]);
  });
});
