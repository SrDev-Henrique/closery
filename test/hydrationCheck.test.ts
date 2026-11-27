import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

import {
  CLIENT_ID_PATTERN,
  type DomSnapshot,
  hydrationProblems,
  snapshotDom,
} from "./hydrationCheck";

// O verificador do e2e/hydration.spec.ts com instantâneos sintéticos (sem
// navegador): limpo, duplicado, `_r_`, dois h1 e o console.

function snapshot(overrides: Partial<DomSnapshot> = {}): DomSnapshot {
  return {
    mains: 1,
    h1PerMain: [1],
    ids: ["_R_1a_-senha", "privacidade-onde"],
    refs: ["_R_1a_-senha"],
    ...overrides,
  };
}

describe("hydrationProblems", () => {
  it("página limpa, hidratada no servidor: nenhum problema", () => {
    expect(hydrationProblems(snapshot(), 1, [])).toEqual([]);
  });

  it("tela de auth: um <main> e nenhum <h1> esperado (o título é o CardTitle)", () => {
    expect(hydrationProblems(snapshot({ h1PerMain: [0] }), 0, [])).toEqual([]);
  });

  it("vazio: sem ids, sem referências e sem erros não é problema", () => {
    expect(hydrationProblems(snapshot({ ids: [], refs: [] }), 1, [])).toEqual(
      [],
    );
  });

  it("dois <main>: conteúdo duplicado", () => {
    expect(
      hydrationProblems(snapshot({ mains: 2, h1PerMain: [1, 1] }), 1, []),
    ).toEqual(["2 elementos <main> (esperado 1): conteúdo duplicado"]);
  });

  it("nenhum <main>: o h1 não teria onde ser contado", () => {
    expect(
      hydrationProblems(snapshot({ mains: 0, h1PerMain: [] }), 1, []),
    ).toEqual(["nenhum <main> na página"]);
  });

  it("dois <h1> no mesmo <main>, e zero quando se espera um", () => {
    expect(hydrationProblems(snapshot({ h1PerMain: [2] }), 1, [])).toEqual([
      "<main> 1 com 2 <h1> (esperado 1)",
    ]);
    expect(hydrationProblems(snapshot({ h1PerMain: [0] }), 1, [])).toEqual([
      "<main> 1 com 0 <h1> (esperado 1)",
    ]);
  });

  it("id repetido aparece uma vez, com a contagem", () => {
    expect(
      hydrationProblems(snapshot({ ids: ["a", "b", "a", "a"] }), 1, []),
    ).toEqual(["id repetido 3 vezes: a"]);
  });

  it("id e referência no formato do cliente (_r_…_), inclusive dentro de id composto", () => {
    expect(
      hydrationProblems(
        snapshot({
          ids: ["_r_3_-senha", "base-ui-_r_5_"],
          refs: ["_r_3_-senha"],
        }),
        1,
        [],
      ),
    ).toEqual([
      "id gerado no cliente: _r_3_-senha",
      "id gerado no cliente: base-ui-_r_5_",
      "referência a id gerado no cliente: _r_3_-senha",
    ]);
  });

  it("mensagem de hidratação no console: texto do dev, sem caixa", () => {
    const problems = hydrationProblems(snapshot(), 1, [
      "Uncaught Error: Hydration failed because the server rendered HTML didn't match the client.",
      "HYDRATION MISMATCH",
      "The server could not finish this Suspense boundary. Switched to client rendering.",
    ]);
    expect(problems).toHaveLength(3);
    expect(problems[0]).toMatch(
      /^hidratação no console: Uncaught Error: Hydration failed/,
    );
  });

  it.each([
    "418",
    "419",
    "422",
    "423",
    "424",
  ])("erro minificado da produção (#%s) conta como hidratação", (code) => {
    const message = `Error: Minified React error #${code}; visit https://react.dev/errors/${code}?args[]=HTML&args[]= for the full message`;
    expect(hydrationProblems(snapshot(), 1, [message])).toHaveLength(1);
  });

  it("outros erros não contam (404 de recurso, outro código do React, código mais longo)", () => {
    expect(
      hydrationProblems(snapshot(), 1, [
        "Failed to load resource: the server responded with a status of 404 ()",
        "Error: Minified React error #185; visit https://react.dev/errors/185",
        "Error: visit https://react.dev/errors/4180",
      ]),
    ).toEqual([]);
  });

  it("mensagem longa sai cortada em 200 caracteres", () => {
    const [problem] = hydrationProblems(snapshot(), 1, [
      `Hydration ${"x".repeat(500)}`,
    ]);
    expect(problem).toHaveLength("hidratação no console: ".length + 200);
  });

  it("junta todos os problemas de uma vez", () => {
    expect(
      hydrationProblems(
        { mains: 2, h1PerMain: [1, 0], ids: ["_r_1_", "_r_1_"], refs: [] },
        1,
        ["Hydration failed"],
      ),
    ).toHaveLength(5);
  });

  it.each([-1, 1.5, Number.NaN])("expectedH1 inválido (%s) lança", (value) => {
    expect(() => hydrationProblems(snapshot(), value, [])).toThrow(
      "expectedH1 inválido",
    );
  });
});

describe("CLIENT_ID_PATTERN", () => {
  it.each([
    "_r_0_",
    "_r_1a_",
    "base-ui-_r_5_",
    "_r_3_-senha",
    "_r__",
  ])("%s é do cliente", (id) => {
    expect(CLIENT_ID_PATTERN.test(id)).toBe(true);
  });

  it.each([
    "_R_0_",
    "_R_1aH2_",
    "_R_r_",
    "_R_1r_-senha",
    "privacidade-onde",
    "r_1_",
    "",
  ])("%s não é do cliente", (id) => {
    expect(CLIENT_ID_PATTERN.test(id)).toBe(false);
  });
});

describe("snapshotDom (roda na página: nada de fora da função)", () => {
  type FakeElement = {
    id?: string;
    attrs?: Record<string, string>;
    h1?: number;
  };

  function fakeDocument(parts: {
    mains: FakeElement[];
    withId: FakeElement[];
    referrers: FakeElement[];
  }) {
    const element = (fake: FakeElement) => ({
      id: fake.id ?? "",
      getAttribute: (name: string) => fake.attrs?.[name] ?? null,
      querySelectorAll: (selector: string) =>
        selector === "h1" ? Array.from({ length: fake.h1 ?? 0 }) : [],
    });
    return {
      querySelectorAll: (selector: string) => {
        if (selector === "main") return parts.mains.map(element);
        if (selector === "[id]") return parts.withId.map(element);
        return parts.referrers.map(element);
      },
    };
  }

  // Num contexto novo do `vm` só existe o `document` falso: se a função usasse
  // algo do módulo (uma constante, um import), daria ReferenceError aqui, como
  // daria no navegador.
  function runIsolated(document: unknown): DomSnapshot {
    const result = runInNewContext(`(${snapshotDom.toString()})()`, {
      document,
    });
    return JSON.parse(JSON.stringify(result)) as DomSnapshot;
  }

  it("conta os <main>, os <h1> de cada um, os ids e as referências", () => {
    const document = fakeDocument({
      mains: [{ h1: 1 }],
      withId: [{ id: "_R_1_-email" }, { id: "" }, { id: "secao" }],
      referrers: [
        { attrs: { for: "_R_1_-email" } },
        { attrs: { "aria-describedby": "_R_1_-ajuda  _R_1_-erro" } },
        { attrs: { "aria-labelledby": "secao", "aria-controls": "menu" } },
      ],
    });
    expect(runIsolated(document)).toEqual({
      mains: 1,
      h1PerMain: [1],
      ids: ["_R_1_-email", "secao"],
      refs: ["_R_1_-email", "_R_1_-ajuda", "_R_1_-erro", "secao", "menu"],
    });
  });

  it("página sem nada: zeros e listas vazias", () => {
    expect(
      runIsolated(fakeDocument({ mains: [], withId: [], referrers: [] })),
    ).toEqual({ mains: 0, h1PerMain: [], ids: [], refs: [] });
  });

  it("dois <main> com h1 diferentes", () => {
    const document = fakeDocument({
      mains: [{ h1: 1 }, { h1: 2 }],
      withId: [],
      referrers: [],
    });
    expect(runIsolated(document).h1PerMain).toEqual([1, 2]);
  });
});
