import { Script } from "node:vm";
import { describe, expect, it } from "vitest";

import { validateScreen } from "../../scripts/visual/screen.mjs";
import inicio from "../../scripts/visual/screens/inicio.mjs";
import legibilidade from "../../scripts/visual/screens/legibilidade.mjs";
import provas from "../../scripts/visual/screens/provas.mjs";
import { STATES } from "../../scripts/visual/seed/states/index";

// As configurações de tela versionadas (spec §5.5) são válidas, e cada semente existe.

const INICIO_COPIES = [
  "proto-admin-escuro",
  "proto-admin-claro",
  "proto-primeiro-escuro",
  "proto-primeiro-claro",
  "proto-continuar",
  "proto-sem-turnos",
  "proto-entregue-escuro-uld",
  "proto-confirmada-escuro-uld",
  "proto-entregue-claro-carga",
  "proto-confirmada-claro-operacoes",
];

/** A expressão é JavaScript que o navegador consegue ler: só compila, não roda. */
function parses(source: string): boolean {
  if (source === "") return false;
  try {
    return new Script(`(${source});`) instanceof Script;
  } catch {
    return false;
  }
}

describe("screens/inicio.mjs", () => {
  const states = Object.entries(inicio.states);

  it("é válida", () => {
    expect(validateScreen(inicio)).toEqual([]);
  });

  it("tem os 11 estados da spec §5.5, todos com a Ana em /?setor={setor}", () => {
    expect(Object.keys(inicio.states)).toEqual([
      "admin-escuro",
      "admin-claro",
      "primeiro-escuro",
      "primeiro-claro",
      "continuar",
      "sem-turnos",
      "menu",
      "entregue-escuro-uld",
      "confirmada-escuro-uld",
      "entregue-claro-carga",
      "confirmada-claro-operacoes",
    ]);
    for (const [, state] of states) {
      expect(state.person).toBe("ana");
      expect(state.path).toBe("/?setor={setor}");
    }
  });

  it("cada semente existe em STATES", () => {
    for (const [name, state] of states) {
      expect(Object.keys(STATES), name).toContain(state.seed);
    }
  });

  it("usa exatamente as dez cópias do protótipo", () => {
    expect(new Set(states.map(([, state]) => state.proto))).toEqual(
      new Set(INICIO_COPIES),
    );
  });

  it("os quatro do pack medem a região cartao; os outros, não", () => {
    const withCard = states
      .filter(([, state]) => state.regions?.cartao)
      .map(([name]) => name);
    expect(withCard).toEqual([
      "entregue-escuro-uld",
      "confirmada-escuro-uld",
      "entregue-claro-carga",
      "confirmada-claro-operacoes",
    ]);
  });

  it("o menu é só 390, só a janela, aberto pelos passos dos dois lados", () => {
    const menu = inicio.states.menu;
    expect(menu?.sizes).toEqual([390]);
    expect(menu?.viewportOnly).toBe(true);
    expect(menu?.steps?.app?.[0]).toMatchObject({ kind: "click" });
    expect(menu?.steps?.proto?.[0]).toMatchObject({ kind: "click" });
  });

  it("os do pack em Carga e Operações são só 1440, no setor certo", () => {
    expect(inicio.states["entregue-claro-carga"]).toMatchObject({
      sector: "Carga",
      sizes: [1440],
    });
    expect(inicio.states["confirmada-claro-operacoes"]).toMatchObject({
      sector: "Operações",
      sizes: [1440],
    });
  });

  it("patch, máscaras e região são JavaScript que o navegador lê", () => {
    expect(parses(inicio.patch?.read ?? "")).toBe(true);
    expect(parses(inicio.patch?.write ?? "")).toBe(true);
    expect(parses(inicio.masks ?? "")).toBe(true);
    expect(
      parses(inicio.states["entregue-escuro-uld"]?.regions?.cartao ?? ""),
    ).toBe(true);
  });
});

describe("screens/legibilidade.mjs", () => {
  const audit = legibilidade.audit ?? [];

  it("é válida e só tem audit (nenhum par)", () => {
    expect(validateScreen(legibilidade)).toEqual([]);
    expect(Object.keys(legibilidade.states)).toEqual([]);
  });

  it("tem as 27 telas do passe do PR A, sem repetir", () => {
    expect(audit).toHaveLength(27);
    expect(new Set(audit.map((entry) => entry.name)).size).toBe(27);
  });

  it("as quatro de fora do (app) vão sem sessão; o resto, com a Ana ou a Carla", () => {
    expect(
      audit.filter((entry) => entry.person === null).map((entry) => entry.name),
    ).toEqual(["entrar", "convite-invalido", "redefinir-senha", "privacidade"]);
    for (const entry of audit) {
      expect([null, "ana", "carla"]).toContain(entry.person);
    }
  });

  it("820 onde há tabela ou lista", () => {
    expect(
      audit
        .filter((entry) => entry.extraWidths?.includes(820))
        .map((entry) => entry.name),
    ).toEqual([
      "passagens",
      "passagens-operador",
      "nova-passagem",
      "solicitacoes-quadro",
      "solicitacoes-lista",
      "solicitacoes-tabela",
      "solicitacoes-operador",
      "dashboard",
      "admin-setores",
      "admin-turnos",
      "admin-itens",
      "admin-destinos",
      "admin-equipe",
    ]);
  });

  it("só usa os marcadores que o audit.mjs resolve", () => {
    const used = new Set(
      audit.flatMap((entry) =>
        [...entry.path.matchAll(/\{([a-z]+)\}/g)].map((m) => m[1]),
      ),
    );
    expect([...used].sort()).toEqual([
      "corrigida",
      "pendente",
      "setor",
      "solicitacao",
    ]);
  });

  it("o Sheet do detalhe é só a janela, aberto pelos passos", () => {
    const sheet = audit.find((entry) => entry.name === "solicitacao-sheet");
    expect(sheet?.viewportOnly).toBe(true);
    expect(sheet?.steps?.map((step) => step.kind)).toEqual([
      "click",
      "waitFor",
    ]);
  });
});

describe("screens/provas.mjs", () => {
  const states = Object.entries(provas.states);

  it("é válida", () => {
    expect(validateScreen(provas)).toEqual([]);
  });

  it("os estados da prova, todos só do app e com semente existente", () => {
    expect(Object.keys(provas.states)).toEqual([
      "falha-de-rede",
      "hover-outline-em-cartao",
      "hover-ghost-em-cartao",
      "hover-statlink",
      "hover-barlist-claro",
      "hover-barlist-escuro",
      "hover-agora-nao-claro",
      "hover-agora-nao-escuro",
    ]);
    for (const [name, state] of states) {
      expect(state.proto, name).toBeNull();
      expect(Object.keys(STATES), name).toContain(state.seed);
    }
  });

  it("a falha de rede aborta uma Server Action do 'Agora não' e exige o registro dela", () => {
    const state = provas.states["falha-de-rede"];
    expect(state).toMatchObject({
      seed: "inicio:primeiro",
      person: "ana",
      theme: "dark",
      path: "/",
    });
    expect(state?.steps?.app).toEqual([
      {
        kind: "failRequests",
        match: { method: "POST", header: "next-action" },
        times: 1,
      },
      { kind: "click", target: { role: "button", name: "Agora não" } },
      { kind: "wait", ms: 1500 },
    ]);
    expect(state?.expect).toEqual({ failedRequests: 1 });
  });

  it("os três hovers passam o mouse num alvo e esperam, no estado rico", () => {
    for (const name of [
      "hover-outline-em-cartao",
      "hover-ghost-em-cartao",
      "hover-statlink",
    ]) {
      const state = provas.states[name];
      expect(state?.seed, name).toBe("geral:rico");
      expect(
        state?.steps?.app?.map((step) => step.kind),
        name,
      ).toEqual(["hover", "wait"]);
    }
    // No claro o hover do outline e do ghost é bg-accent opaco: a sonda distingue o antes do depois.
    expect(provas.states["hover-outline-em-cartao"]?.theme).toBe("light");
    expect(provas.states["hover-ghost-em-cartao"]?.theme).toBe("light");
  });

  it("os hovers do P109 rodam nos dois temas, com um alvo cada, no estado rico", () => {
    const pairs = [
      ["hover-barlist", "/dashboard?setor={setor}"],
      ["hover-agora-nao", "/bem-vindo"],
    ] as const;
    for (const [prefix, path] of pairs) {
      const light = provas.states[`${prefix}-claro`];
      const dark = provas.states[`${prefix}-escuro`];
      expect(light?.theme, prefix).toBe("light");
      expect(dark?.theme, prefix).toBe("dark");
      for (const state of [light, dark]) {
        expect(state).toMatchObject({
          seed: "geral:rico",
          person: "ana",
          path,
        });
        expect(state?.steps?.app?.map((step) => step.kind)).toEqual([
          "hover",
          "wait",
        ]);
      }
      expect(light?.steps).toEqual(dark?.steps);
    }
    // A segunda linha da lista com barras: a barra é parcial e o trilho aparece.
    expect(provas.states["hover-barlist-claro"]?.steps?.app?.[0]).toEqual({
      kind: "hover",
      target: {
        css: 'ul[aria-label="Tempo até a entrega por destino"] > li:nth-child(2) > a',
      },
    });
  });
});
