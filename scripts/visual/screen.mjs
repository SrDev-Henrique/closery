// Configuração de tela do processo visual (spec §5.5): carrega scripts/visual/screens/<tela>.mjs
// (versionada, sem nome de pessoa) ou um arquivo de .git/sdd (--config, fora do git), valida e
// resolve o que o estado precisa (caminho, altura mínima, cópia do protótipo, os arquivos do banco
// visual, o comando do seed). validateScreen é puro.
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { MOBILE_MAX_WIDTH } from "./config.mjs";
import {
  readJsonInsideSdd,
  repoRoot,
  sddPath,
  VISUAL_DB_FILES,
  visualDbDir,
} from "./paths.mjs";
import { validateSteps } from "./steps.mjs";
import { VISUAL_PEOPLE } from "./vocabulary.mjs";

/** @typedef {"ana" | "bruno" | "carla" | "diego"} PersonKey */
/** @typedef {{ role: string, name: string, exact?: boolean } | { css: string } | { text: string }} Target */
/** @typedef {{ url?: string, method?: string, header?: string }} RequestMatch */
/**
 * Um passo do roteiro (spec §6), com `kind` em STEP_KINDS: click/hover/focus { target }, tab { times },
 * press { key }, fill { target, value }, drag { from, to }, wait { ms }, waitFor { target },
 * failRequests { match, times? }, restoreRequests {}, sample { target, read, every, for }.
 * @typedef {{ kind: string, [field: string]: unknown }} Step
 */
/**
 * @typedef {Object} StateConfig
 * @property {string} seed            nome em STATES ("<tela>:<estado>")
 * @property {string} [sector]        nome do setor (padrão ULD)
 * @property {PersonKey} person
 * @property {"dark" | "light"} theme
 * @property {string} path            caminho do app, com {setor}
 * @property {number[]} [sizes]       padrão [1440, 390]
 * @property {boolean} [viewportOnly] só a janela, sem igualar a altura
 * @property {string | null} proto    nome da cópia, sem .html; null = só o app
 * @property {{ app?: Step[], proto?: Step[] }} [steps]
 * @property {string} [css]           simulação de medida, nunca correção
 * @property {Record<string, string>} [regions] expressão que devolve [x, y, w, h]
 * @property {{ failedRequests?: number }} [expect]
 */
/**
 * @typedef {Object} AuditScreen
 * @property {string} name
 * @property {string} path            com {setor}, {pendente}, {corrigida}, {solicitacao}
 * @property {PersonKey | null} person
 * @property {number[]} [extraWidths]
 * @property {Step[]} [steps]
 * @property {boolean} [viewportOnly]
 */
/**
 * @typedef {Object} ScreenConfig
 * @property {string} name
 * @property {string} [ready]         seletor que diz que a página do app carregou
 * @property {string} [protoDir]      padrão "proto", relativo ao --out
 * @property {Record<string, StateConfig>} states
 * @property {{ read: string, write: string }} [patch]
 * @property {string} [masks]
 * @property {AuditScreen[]} [audit]
 */
/** @typedef {{ state: string, sector: string, sectorId: string, sectors: Record<string, string>, users: Record<PersonKey, string>, at: string }} StateFile */

const PEOPLE = Object.freeze(Object.keys(VISUAL_PEOPLE));
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEED_NAME = /^[a-z0-9-]+:[a-z0-9-]+$/;
const SCREEN_FIELDS = [
  "name",
  "ready",
  "protoDir",
  "states",
  "patch",
  "masks",
  "audit",
];
const STATE_FIELDS = [
  "seed",
  "sector",
  "person",
  "theme",
  "path",
  "sizes",
  "viewportOnly",
  "proto",
  "steps",
  "css",
  "regions",
  "expect",
];
const AUDIT_FIELDS = [
  "name",
  "path",
  "person",
  "extraWidths",
  "steps",
  "viewportOnly",
];
const MIN_WIDTH = 320;
const MAX_WIDTH = 3840;

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {unknown} value */
function isText(value) {
  return typeof value === "string" && value.trim() !== "";
}

/** @param {unknown} value */
function isSlug(value) {
  return typeof value === "string" && SLUG.test(value);
}

/**
 * @param {Record<string, unknown>} value
 * @param {readonly string[]} allowed
 * @param {string} at
 * @param {string[]} errors
 */
function unknownFields(value, allowed, at, errors) {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length > 0)
    errors.push(`${at}: campo desconhecido: ${extra.join(", ")}`);
}

/**
 * @param {unknown} path
 * @param {string} at
 * @param {string[]} errors
 */
function pathErrors(path, at, errors) {
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("://")
  ) {
    errors.push(`${at}: path é um caminho do app começando com /`);
  }
}

/**
 * @param {unknown} widths
 * @param {string} at
 * @param {string[]} errors
 */
function widthErrors(widths, at, errors) {
  if (!Array.isArray(widths) || widths.length === 0) {
    errors.push(`${at}: lista de larguras vazia`);
    return;
  }
  for (const width of widths) {
    if (!Number.isInteger(width) || width < MIN_WIDTH || width > MAX_WIDTH) {
      errors.push(
        `${at}: largura inválida: ${String(width)} (${MIN_WIDTH} a ${MAX_WIDTH})`,
      );
    }
  }
  if (new Set(widths).size !== widths.length)
    errors.push(`${at}: largura repetida`);
}

/**
 * @param {string} name
 * @param {unknown} state
 * @param {string[]} errors
 */
function validateState(name, state, errors) {
  const at = `estado ${name}`;
  if (!isSlug(name))
    errors.push(`${at}: nome com letras minúsculas, números e hífen`);
  if (!isPlainObject(state)) {
    errors.push(`${at}: não é um objeto`);
    return;
  }
  unknownFields(state, STATE_FIELDS, at, errors);
  if (typeof state.seed !== "string" || !SEED_NAME.test(state.seed)) {
    errors.push(`${at}: seed no formato <tela>:<estado>`);
  }
  if (state.sector !== undefined && !isText(state.sector))
    errors.push(`${at}: sector vazio`);
  if (!PEOPLE.includes(state.person)) {
    errors.push(
      `${at}: person desconhecida: ${String(state.person)} (${PEOPLE.join(", ")})`,
    );
  }
  if (state.theme !== "dark" && state.theme !== "light") {
    errors.push(`${at}: theme é dark ou light`);
  }
  pathErrors(state.path, at, errors);
  if (state.sizes !== undefined)
    widthErrors(state.sizes, `${at}: sizes`, errors);
  if (
    state.viewportOnly !== undefined &&
    typeof state.viewportOnly !== "boolean"
  ) {
    errors.push(`${at}: viewportOnly é booleano`);
  }
  if (!("proto" in state)) {
    errors.push(`${at}: falta proto (o nome da cópia, ou null para só o app)`);
  } else if (state.proto !== null && !isSlug(state.proto)) {
    errors.push(`${at}: proto é o nome da cópia sem .html, ou null`);
  }
  if (state.steps !== undefined) {
    if (!isPlainObject(state.steps)) {
      errors.push(`${at}: steps é { app?, proto? }`);
    } else {
      unknownFields(state.steps, ["app", "proto"], `${at}: steps`, errors);
      for (const side of ["app", "proto"]) {
        if (state.steps[side] === undefined) continue;
        for (const error of validateSteps(state.steps[side])) {
          errors.push(`${at}: steps.${side}: ${error}`);
        }
      }
      if (state.proto === null && state.steps.proto !== undefined) {
        errors.push(`${at}: steps.proto sem cópia do protótipo`);
      }
    }
  }
  if (state.css !== undefined && typeof state.css !== "string")
    errors.push(`${at}: css é texto`);
  if (state.regions !== undefined) {
    if (!isPlainObject(state.regions)) {
      errors.push(`${at}: regions é { <nome>: <expressão> }`);
    } else {
      if (state.proto === null)
        errors.push(`${at}: região sem cópia do protótipo`);
      for (const [region, expr] of Object.entries(state.regions)) {
        if (!isSlug(region))
          errors.push(`${at}: região ${region}: nome inválido`);
        if (!isText(expr)) {
          errors.push(
            `${at}: região ${region}: a expressão que devolve [x, y, w, h]`,
          );
        }
      }
    }
  }
  if (state.expect !== undefined) {
    if (!isPlainObject(state.expect)) {
      errors.push(`${at}: expect é { failedRequests? }`);
      return;
    }
    unknownFields(state.expect, ["failedRequests"], `${at}: expect`, errors);
    const wanted = state.expect.failedRequests;
    if (wanted !== undefined) {
      if (!Number.isInteger(wanted) || wanted < 1) {
        errors.push(
          `${at}: expect.failedRequests inválido: ${String(wanted)} (inteiro ≥ 1)`,
        );
      }
      const app = isPlainObject(state.steps) ? state.steps.app : undefined;
      const failing =
        Array.isArray(app) &&
        app.some((step) => isPlainObject(step) && step.kind === "failRequests");
      if (!failing)
        errors.push(
          `${at}: expect.failedRequests sem um passo failRequests no app`,
        );
    }
  }
}

/**
 * @param {unknown} audit
 * @param {string[]} errors
 */
function validateAudit(audit, errors) {
  if (!Array.isArray(audit)) {
    errors.push("audit: não é uma lista");
    return;
  }
  /** @type {Set<string>} */
  const names = new Set();
  for (const [index, entry] of audit.entries()) {
    const at = `audit ${index + 1}`;
    if (!isPlainObject(entry)) {
      errors.push(`${at}: não é um objeto`);
      continue;
    }
    unknownFields(entry, AUDIT_FIELDS, at, errors);
    if (!isSlug(entry.name))
      errors.push(`${at}: name com letras minúsculas, números e hífen`);
    else if (names.has(entry.name))
      errors.push(`${at}: name repetido: ${entry.name}`);
    else names.add(entry.name);
    pathErrors(entry.path, at, errors);
    if (entry.person !== null && !PEOPLE.includes(entry.person)) {
      errors.push(
        `${at}: person desconhecida: ${String(entry.person)} (ou null, sem sessão)`,
      );
    }
    if (entry.extraWidths !== undefined)
      widthErrors(entry.extraWidths, `${at}: extraWidths`, errors);
    if (entry.steps !== undefined) {
      for (const error of validateSteps(entry.steps))
        errors.push(`${at}: ${error}`);
    }
    if (
      entry.viewportOnly !== undefined &&
      typeof entry.viewportOnly !== "boolean"
    ) {
      errors.push(`${at}: viewportOnly é booleano`);
    }
  }
}

/**
 * Valida a configuração de tela. Devolve a lista de erros (vazia = válida).
 * @param {unknown} screen
 * @returns {string[]}
 */
export function validateScreen(screen) {
  if (!isPlainObject(screen)) return ["a configuração não é um objeto"];
  /** @type {string[]} */
  const errors = [];
  unknownFields(screen, SCREEN_FIELDS, "tela", errors);
  if (!isSlug(screen.name))
    errors.push("name: letras minúsculas, números e hífen");
  if (
    screen.protoDir !== undefined &&
    (typeof screen.protoDir !== "string" ||
      screen.protoDir === "" ||
      screen.protoDir.startsWith("/") ||
      screen.protoDir.split(/[\\/]/).includes(".."))
  ) {
    errors.push("protoDir: pasta relativa ao --out, sem ..");
  }
  const states = isPlainObject(screen.states) ? screen.states : null;
  if (!states) errors.push("states: não é um objeto");
  const stateNames = states ? Object.keys(states) : [];
  const hasAudit = Array.isArray(screen.audit) && screen.audit.length > 0;
  if (stateNames.length === 0 && !hasAudit)
    errors.push("a tela precisa de states ou de audit");
  if (stateNames.length > 0 && !isText(screen.ready)) {
    errors.push("ready: o seletor que diz que a página do app carregou");
  }
  for (const name of stateNames) validateState(name, states?.[name], errors);
  if (screen.patch !== undefined) {
    if (
      !isPlainObject(screen.patch) ||
      !isText(screen.patch.read) ||
      !isText(screen.patch.write)
    ) {
      errors.push("patch: { read, write }, as duas expressões");
    } else {
      unknownFields(screen.patch, ["read", "write"], "patch", errors);
    }
  }
  if (screen.masks !== undefined && !isText(screen.masks)) {
    errors.push("masks: a expressão que devolve os retângulos");
  }
  if (screen.audit !== undefined) validateAudit(screen.audit, errors);
  return errors;
}

/**
 * Carrega a configuração: `screen` → scripts/visual/screens/<nome>.mjs; `config` → um caminho
 * relativo a .git/sdd. Um dos dois. Lança com a lista de erros da validação.
 * @param {{ screen?: string, config?: string }} opts
 * @returns {Promise<ScreenConfig>}
 */
export async function loadScreen(opts) {
  const { screen, config } = opts;
  if ((screen === undefined) === (config === undefined)) {
    throw new Error(
      "use --screen=<nome> ou --config=<caminho relativo a .git/sdd> (um dos dois)",
    );
  }
  let file;
  let label;
  if (screen !== undefined) {
    if (!isSlug(screen))
      throw new Error(`nome de tela inválido: ${String(screen)}`);
    file = join(repoRoot(), "scripts", "visual", "screens", `${screen}.mjs`);
    label = `screens/${screen}.mjs`;
  } else {
    if (!isText(config)) throw new Error("--config vazio");
    file = sddPath(String(config));
    label = String(config);
  }
  let loaded;
  try {
    loaded = await import(pathToFileURL(file).href);
  } catch (error) {
    throw new Error(
      `não consegui carregar ${label}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const errors = validateScreen(loaded.default);
  if (errors.length > 0) {
    throw new Error(
      `configuração inválida (${label}):\n- ${errors.join("\n- ")}`,
    );
  }
  return loaded.default;
}

/**
 * O estado da tela pelo nome; lança com os nomes que existem.
 * @param {ScreenConfig} screen
 * @param {unknown} name
 * @returns {StateConfig}
 */
export function pickState(screen, name) {
  if (typeof name !== "string" || !Object.hasOwn(screen.states, name)) {
    throw new Error(
      `estado desconhecido na tela ${screen.name}: ${String(name)} (estados: ${Object.keys(screen.states).join(", ")})`,
    );
  }
  return screen.states[name];
}

/**
 * Troca os marcadores do caminho: `{setor}` pelo `sectorId`; qualquer outro `{nome}` pelo valor de
 * mesmo nome no segundo argumento (a auditoria passa `pendente`, `corrigida` e `solicitacao`).
 * Marcador sem valor lança "marcador sem valor: {nome}".
 * @param {string} template
 * @param {{ sectorId: string } & Record<string, unknown>} state
 * @returns {string}
 */
export function resolvePath(template, state) {
  return template.replace(/\{([a-z]+)\}/g, (_, key) => {
    const value = key === "setor" ? state.sectorId : state[key];
    if (typeof value !== "string" || value === "") {
      throw new Error(`marcador sem valor: {${key}}`);
    }
    return encodeURIComponent(value);
  });
}

/**
 * A altura mínima da captura: 844 no celular (abaixo de 860), 900 acima.
 * @param {number} width
 * @returns {number}
 */
export function minHeight(width) {
  return width <= MOBILE_MAX_WIDTH ? 844 : 900;
}

/**
 * Os argumentos do `bun` que semeiam o estado (o pairs, o measure, o probe e o interact usam).
 * @param {Pick<StateConfig, "seed" | "sector">} state
 * @returns {string[]}
 */
export function seedArgs(state) {
  return [
    "scripts/visual/seed/index.ts",
    "state",
    state.seed,
    ...(state.sector ? [`--setor=${state.sector}`] : []),
  ];
}

/**
 * Semeia o estado no banco visual (bun, na raiz do repositório), mostrando a saída do seed.
 * @param {Pick<StateConfig, "seed" | "sector">} state
 */
export function runSeed(state) {
  execFileSync("bun", seedArgs(state), { cwd: repoRoot(), stdio: "inherit" });
}

/** @returns {StateFile} o .git/sdd/visual-db/state.json do último `visual:seed state` */
export function readState() {
  const state = readJsonInsideSdd(join(visualDbDir(), VISUAL_DB_FILES.state));
  if (
    !isPlainObject(state) ||
    typeof state.sectorId !== "string" ||
    !isPlainObject(state.users)
  ) {
    throw new Error(
      "state.json inválido: rode bun run visual:seed state <tela>:<estado>",
    );
  }
  return /** @type {StateFile} */ (state);
}

/** @returns {Record<PersonKey, string>} o .git/sdd/visual-db/avatars.json */
export function readAvatars() {
  const avatars = readJsonInsideSdd(
    join(visualDbDir(), VISUAL_DB_FILES.avatars),
  );
  if (
    !isPlainObject(avatars) ||
    PEOPLE.some((key) => typeof avatars[key] !== "string")
  ) {
    throw new Error("avatars.json inválido: rode bun run visual:seed avatars");
  }
  return /** @type {Record<PersonKey, string>} */ (avatars);
}

/**
 * O arquivo da cópia do protótipo: <sdd>/<out>/<protoDir>/<stem>.html.
 * @param {string} out pasta relativa a .git/sdd
 * @param {Pick<ScreenConfig, "protoDir">} screen
 * @param {string} stem
 * @returns {string}
 */
export function protoFile(out, screen, stem) {
  if (!isSlug(stem))
    throw new Error(`cópia do protótipo inválida: ${String(stem)}`);
  return sddPath(out, screen.protoDir ?? "proto", `${stem}.html`);
}
