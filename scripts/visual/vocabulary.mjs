// O mundo visual inventado (spec §5.4): as pessoas, a senha de teste e os textos que o seed grava e
// que as cópias do protótipo recebem no lugar dos originais. É a única fonte: com o mesmo texto dos
// dois lados, o pixel compara igual com igual. Nada aqui vem de protótipo nem de screenshot.

/** @typedef {"ana" | "bruno" | "carla" | "diego"} VisualPersonKey */
/** @typedef {{ name: string, email: string, role: "admin" | "operator" }} VisualPerson */
/** @typedef {"lilac" | "peach" | "sky" | "green" | "pink"} VisualSectorColor */
/** @typedef {{ name: string, color: VisualSectorColor }} VisualSector */
/** @typedef {{ name: string, startsAt: string, endsAt: string }} VisualShift */
/** @typedef {{ destination: string, description: string }} VisualRequestText */
/** @typedef {{ destination: string, description: string, status: "delivered" | "cancelled" | "in_transit" }} VisualHistoryRequest */
/**
 * @typedef {Object} VisualTexts
 * @property {string} pendingNextShift
 * @property {readonly VisualRequestText[]} staleRequests
 * @property {{ destination: string, descriptionPrefix: string }} recentRequests
 * @property {{ occurrences: string, nextShift: string, note: string, correctionOld: string, correctionReason: string }} history
 * @property {readonly VisualHistoryRequest[]} historyRequests
 * @property {string} cancelReason
 */

/**
 * Congela o objeto e tudo dentro dele.
 * @template T
 * @param {T} value
 * @returns {T}
 */
function freeze(value) {
  if (value && typeof value === "object") {
    for (const inner of Object.values(value)) freeze(inner);
    Object.freeze(value);
  }
  return value;
}

/** @type {Readonly<Record<VisualPersonKey, Readonly<VisualPerson>>>} */
export const VISUAL_PEOPLE = freeze({
  ana: { name: "Ana Teste", email: "ana.teste@example.com", role: "admin" },
  bruno: {
    name: "Bruno Teste",
    email: "bruno.teste@example.com",
    role: "operator",
  },
  carla: {
    name: "Carla Teste",
    email: "carla.teste@example.com",
    role: "operator",
  },
  diego: {
    name: "Diego Teste",
    email: "diego.teste@example.com",
    role: "operator",
  },
});

/** A senha das quatro pessoas: a mesma do E2E (e2e/helpers.ts). */
export const VISUAL_PASSWORD = "senha-de-teste-123";

/** @type {readonly Readonly<VisualSector>[]} */
export const VISUAL_SECTORS = freeze([
  { name: "ULD", color: "lilac" },
  { name: "Carga", color: "peach" },
  { name: "Operações", color: "sky" },
  { name: "Rampa", color: "green" },
]);

/** Os mesmos três turnos em cada setor. @type {readonly Readonly<VisualShift>[]} */
export const VISUAL_SHIFTS = freeze([
  { name: "Turno 1", startsAt: "06:00", endsAt: "14:00" },
  { name: "Turno 2", startsAt: "14:00", endsAt: "22:00" },
  { name: "Turno 3", startsAt: "22:00", endsAt: "06:00" },
]);

/** Itens por setor: todos `control`, unidade `unidade` (no estado rico o Stretch vira `stock` em `rolo`). @type {Readonly<Record<string, readonly string[]>>} */
export const VISUAL_ITEMS = freeze({
  ULD: ["Rede de proteção", "Stretch", "Cinta azul"],
  Carga: ["Palete", "Capa plástica"],
  Operações: ["Cone", "Rádio"],
  Rampa: ["Calço", "Etiqueta"],
});

/** @type {readonly string[]} */
export const VISUAL_DESTINATIONS = freeze([
  "Doca Norte",
  "Doca Sul",
  "Armazém 3",
  "Terminal B",
  "Box 7",
]);

/** @type {Readonly<VisualTexts>} */
export const VISUAL_TEXTS = freeze({
  pendingNextShift:
    "Conferir as duas ULDs da doca norte no começo do turno.\nCapa da posição 6 separada para troca.",
  // Na ordem do seed: solicitada há 4 dias e 2 h; em trânsito (criada há 5 dias, mudou há 3 dias e
  // 5 h); solicitada há 3 dias e 1 h.
  staleRequests: [
    { destination: "Doca Norte", description: "Capas novas para a doca norte" },
    { destination: "Doca Sul", description: "Reposição de cintas azuis" },
    { destination: "Armazém 3", description: "Calços de borracha, 2 caixas" },
  ],
  // "Pedido recente 1" a "Pedido recente 4", criadas há 1 a 4 h.
  recentRequests: {
    destination: "Terminal B",
    descriptionPrefix: "Pedido recente",
  },
  history: {
    occurrences: "Rampa parada por 40 minutos por causa do vento.",
    nextShift: "Conferir as capas da posição 6.\nRepor stretch no box 2.",
    note: "Uma com defeito",
    correctionOld: "Rampa parada.",
    correctionReason: "Faltou o tempo de parada",
  },
  historyRequests: [
    {
      destination: "Doca Norte",
      description: "Cintas azuis, 3 caixas",
      status: "delivered",
    },
    {
      destination: "Doca Sul",
      description: "Capas novas para o box 1",
      status: "delivered",
    },
    {
      destination: "Box 7",
      description: "Calços extras (duplicado)",
      status: "cancelled",
    },
    {
      destination: "Armazém 3",
      description: "Etiquetas de teste",
      status: "in_transit",
    },
    {
      destination: "Terminal B",
      description: "Sacos de teste, 1 fardo",
      status: "delivered",
    },
  ],
  cancelReason: "Pedido duplicado",
});
