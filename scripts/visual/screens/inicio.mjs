// Pares do Início (spec §5.5): os do PR A que o pack de correção não tocou e os quatro do pack.
// Versionado e sem nome de pessoa: as cópias do protótipo (já com as pessoas e os textos trocados
// pelo vocabulário) ficam em .git/sdd/<out>/proto/, feitas pelo proto.mjs com a configuração da
// branch, que fica fora do git.
//
// As quatro funções abaixo rodam DENTRO da página (viram texto com String(fn)): não usam nada de
// fora delas. O cartão do turno tem a mesma estrutura nos dois lados: nome, horário e data em
// spans irmãos, e a linha "início · agora · fim" logo abaixo do trilho da barra.

/** No app: o que depende do relógio no cartão do turno. */
function readShift() {
  const spans = [...document.querySelectorAll("span")];
  const time = spans.find((s) =>
    /^\d\d:\d\d–\d\d:\d\d$/.test(s.textContent.trim()),
  );
  const now = spans.find((s) => /^agora \d\d:\d\d$/.test(s.textContent.trim()));
  const fill = document.querySelector('[role="progressbar"] > div');
  const text = (el) => (el ? el.textContent : null);
  return {
    pct: fill instanceof HTMLElement ? fill.style.width : null,
    texts: {
      name: text(time?.previousElementSibling),
      time: text(time),
      date: text(time?.nextElementSibling),
      start: text(now?.previousElementSibling),
      now: text(now),
      end: text(now?.nextElementSibling),
    },
  };
}

/** No protótipo: escreve o que o app leu (o mesmo texto e a mesma largura da barra). */
function writeShift(value) {
  if (!value) return;
  const spans = [...document.querySelectorAll("span")];
  const time = spans.find((s) =>
    /^\d\d:\d\d–\d\d:\d\d$/.test(s.textContent.trim()),
  );
  const now = spans.find((s) => /^agora \d\d:\d\d$/.test(s.textContent.trim()));
  const targets = {
    name: time?.previousElementSibling,
    time,
    date: time?.nextElementSibling,
    start: now?.previousElementSibling,
    now,
    end: now?.nextElementSibling,
  };
  const fill = [...document.querySelectorAll("div")].find(
    (d) => d.style.width === "34%" && d.style.background,
  );
  for (const [key, el] of Object.entries(targets)) {
    const next = value.texts ? value.texts[key] : null;
    if (el && typeof next === "string") el.textContent = next;
  }
  if (fill && value.pct) fill.style.width = value.pct;
}

/** Nos dois lados: a linha "início · agora · fim" e o trilho da barra, que dependem do agora. */
function clockRects() {
  const out = [];
  const now = [...document.querySelectorAll("span")].find((s) =>
    /^agora \d\d:\d\d$/.test(s.textContent.trim()),
  );
  if (now?.parentElement) {
    const row = now.parentElement.getBoundingClientRect();
    out.push([row.x, row.y, row.width, row.height]);
    const track = now.parentElement.previousElementSibling;
    if (track) {
      const box = track.getBoundingClientRect();
      out.push([box.x, box.y, box.width, box.height]);
    }
  }
  return out.map((rect) => rect.map((v) => Math.round(v)));
}

/** Nos dois lados: o cartão "Passagem do meu turno" (o <h2> fica numa linha filha do cartão). */
function shiftCardRect() {
  const title = [...document.querySelectorAll("h2")].find(
    (h) => h.textContent.trim() === "Passagem do meu turno",
  );
  const card = title?.parentElement?.parentElement;
  if (!card) return null;
  const box = card.getBoundingClientRect();
  return [box.x, box.y, box.width, box.height];
}

const HOME = "/?setor={setor}";
const CARD = { cartao: `(${shiftCardRect})()` };

/**
 * Um par visto pela Ana no Início.
 * @param {string} seed
 * @param {"dark" | "light"} theme
 * @param {string} proto
 * @param {Partial<import("../screen.mjs").StateConfig>} [extra]
 * @returns {import("../screen.mjs").StateConfig}
 */
function pair(seed, theme, proto, extra = {}) {
  return { seed, person: "ana", theme, path: HOME, proto, ...extra };
}

/** @type {import("../screen.mjs").ScreenConfig} */
const inicio = {
  name: "inicio",
  ready: '[data-slot="home-cards"], [data-slot="home-hero-row"]',
  patch: { read: `(${readShift})()`, write: String(writeShift) },
  masks: `(${clockRects})()`,
  states: {
    "admin-escuro": pair("inicio:admin", "dark", "proto-admin-escuro"),
    "admin-claro": pair("inicio:admin", "light", "proto-admin-claro"),
    "primeiro-escuro": pair("inicio:primeiro", "dark", "proto-primeiro-escuro"),
    "primeiro-claro": pair("inicio:primeiro", "light", "proto-primeiro-claro"),
    continuar: pair("inicio:continuar", "dark", "proto-continuar"),
    "sem-turnos": pair("inicio:sem-turnos", "dark", "proto-sem-turnos"),
    // Celular com o menu aberto: só 390, só a janela (844), os dois lados abertos pelos passos.
    menu: pair("inicio:admin", "dark", "proto-admin-escuro", {
      sizes: [390],
      viewportOnly: true,
      steps: {
        app: [
          { kind: "click", target: { role: "button", name: "Alternar menu" } },
          { kind: "wait", ms: 900 },
        ],
        proto: [
          { kind: "click", target: { role: "button", name: "Abrir menu" } },
          { kind: "wait", ms: 900 },
        ],
      },
    }),
    // O pack de correção: a página e o cartão do turno.
    "entregue-escuro-uld": pair(
      "inicio:entregue",
      "dark",
      "proto-entregue-escuro-uld",
      {
        sector: "ULD",
        regions: CARD,
      },
    ),
    "confirmada-escuro-uld": pair(
      "inicio:confirmada",
      "dark",
      "proto-confirmada-escuro-uld",
      {
        sector: "ULD",
        regions: CARD,
      },
    ),
    "entregue-claro-carga": pair(
      "inicio:entregue",
      "light",
      "proto-entregue-claro-carga",
      {
        sector: "Carga",
        sizes: [1440],
        regions: CARD,
      },
    ),
    "confirmada-claro-operacoes": pair(
      "inicio:confirmada",
      "light",
      "proto-confirmada-claro-operacoes",
      { sector: "Operações", sizes: [1440], regions: CARD },
    ),
  },
};

export default inicio;
