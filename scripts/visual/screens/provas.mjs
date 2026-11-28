// Os estados só do app que provam o PR B (spec §13): a falha de rede injetada numa Server Action e
// os hovers que antes sumiam dentro de cartão (bg-muted = card). Sem cópia do protótipo (proto: null):
// rodam no interact.mjs e no probe.mjs --app-only. Alvos escolhidos lendo as telas:
// - falha-de-rede: o "Agora não" do cartão "Convide sua equipe" (InviteTeamCard, uma Server Action);
// - hover-outline-em-cartao: o "Editar" (Button outline do EditDialog) de uma linha de destino, que é
//   um cartão (AdminListRow, bg-card), em /admin/destinos;
// - hover-ghost-em-cartao: o ↗ "Abrir página completa" (buttonVariants ghost) de um cartão do Quadro
//   (RequestCard, bg-card);
// - hover-statlink: o número "Abertas agora" do Dashboard (StatLink).
// O outline e o ghost vão no CLARO: lá o hover é bg-accent opaco e o bg-muted de antes era o próprio
// card, então a sonda distingue o antes do depois. No escuro o outline usa dark:hover:bg-input/50 (a
// Task 3 não muda) e o ghost usa accent/50, semitransparente (a string da cor sempre difere da do
// pai). O StatLink usa hover:bg-accent opaco nos dois temas e fica no escuro.

const HOVER_WAIT = { kind: "wait", ms: 300 };

/** @type {import("../screen.mjs").ScreenConfig} */
const provas = {
  name: "provas",
  // O título de /bem-vindo é o CardTitle com role="heading" aria-level=1, não um <h1>.
  ready: 'main h1, main [role="heading"][aria-level="1"]',
  states: {
    "falha-de-rede": {
      seed: "inicio:primeiro",
      person: "ana",
      theme: "dark",
      path: "/",
      sizes: [1440],
      proto: null,
      steps: {
        app: [
          {
            kind: "failRequests",
            match: { method: "POST", header: "next-action" },
            times: 1,
          },
          { kind: "click", target: { role: "button", name: "Agora não" } },
          { kind: "wait", ms: 1500 },
        ],
      },
      expect: { failedRequests: 1 },
    },
    "hover-outline-em-cartao": {
      seed: "geral:rico",
      person: "ana",
      theme: "light",
      path: "/admin/destinos",
      sizes: [1440],
      proto: null,
      steps: {
        app: [
          {
            kind: "hover",
            target: { role: "button", name: "Editar Doca Norte" },
          },
          HOVER_WAIT,
        ],
      },
    },
    "hover-ghost-em-cartao": {
      seed: "geral:rico",
      person: "ana",
      theme: "light",
      path: "/solicitacoes?setor={setor}&visao=quadro",
      sizes: [1440],
      proto: null,
      steps: {
        app: [
          {
            kind: "hover",
            target: { css: 'a[aria-label^="Abrir página completa de"]' },
          },
          HOVER_WAIT,
        ],
      },
    },
    "hover-statlink": {
      seed: "geral:rico",
      person: "ana",
      theme: "dark",
      path: "/dashboard?setor={setor}",
      sizes: [1440],
      proto: null,
      steps: {
        app: [{ kind: "hover", target: { text: "Abertas agora" } }, HOVER_WAIT],
      },
    },
    ...barListHover("light"),
    ...barListHover("dark"),
    ...skipHover("light"),
    ...skipHover("dark"),
  },
};

// P109 (2026-11-28): o trilho do BarList no hover da linha e o "Agora não" do PasskeyOffer, nos dois
// temas. A sonda compõe as cores na própria página (canvas) e compara a linha com o mouse com uma
// linha da mesma lista sem o mouse, então distingue o antes do depois (B-3).

/**
 * O hover da segunda linha de "Tempo até a entrega por destino" (a barra é parcial: o trilho aparece).
 * @param {"light" | "dark"} theme
 */
function barListHover(theme) {
  return {
    [`hover-barlist-${theme === "light" ? "claro" : "escuro"}`]: {
      seed: "geral:rico",
      person: "ana",
      theme,
      path: "/dashboard?setor={setor}",
      sizes: [1440],
      proto: null,
      steps: {
        app: [
          {
            kind: "hover",
            target: {
              css: 'ul[aria-label="Tempo até a entrega por destino"] > li:nth-child(2) > a',
            },
          },
          HOVER_WAIT,
        ],
      },
    },
  };
}

/**
 * O hover do "Agora não" (ghost no rodapé do cartão) em /bem-vindo.
 * @param {"light" | "dark"} theme
 */
function skipHover(theme) {
  return {
    [`hover-agora-nao-${theme === "light" ? "claro" : "escuro"}`]: {
      seed: "geral:rico",
      person: "ana",
      theme,
      path: "/bem-vindo",
      sizes: [1440],
      proto: null,
      steps: {
        app: [
          { kind: "hover", target: { role: "link", name: "Agora não" } },
          HOVER_WAIT,
        ],
      },
    },
  };
}

export default provas;
