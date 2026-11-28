// Motor das cópias do protótipo (spec §5.6). A configuração da branch fica fora do git (tem os
// originais do protótipo) e devolve as trocas; o motor aplica as trocas na ordem, ajusta os padrões
// das props do data-props por cópia, procura em cada cópia todos os termos de nomes-proibidos.txt
// (o mesmo names.mjs do check-names) e os `leftovers`, e só então grava as cópias e os arquivos de
// apoio. Os erros dizem o NÚMERO da troca ou da linha da lista, nunca o texto (que é o original).
//   node scripts/visual/proto.mjs --config=<caminho relativo a .git/sdd>
import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { parseCliArgs } from "./config.mjs";
import { findForbidden, loadNamesList, namesListPath } from "./names.mjs";
import { sddPath, writeInsideSdd } from "./paths.mjs";
import { readAvatars } from "./screen.mjs";
import {
  VISUAL_DESTINATIONS,
  VISUAL_ITEMS,
  VISUAL_PEOPLE,
  VISUAL_SECTORS,
  VISUAL_SHIFTS,
  VISUAL_TEXTS,
} from "./vocabulary.mjs";

/** @typedef {import("./names.mjs").NamesList} NamesList */
/** @typedef {[string, string]} Replacement */
/**
 * O que a configuração recebe em `replacements(ctx)` (e em `extra(ctx)`, quando é função).
 * @typedef {Object} ProtoContext
 * @property {Record<string, string>} avatars  data URI por pessoa (avatars.json)
 * @property {typeof VISUAL_PEOPLE} people
 * @property {{ sectors: typeof VISUAL_SECTORS, shifts: typeof VISUAL_SHIFTS, items: typeof VISUAL_ITEMS, destinations: typeof VISUAL_DESTINATIONS, texts: typeof VISUAL_TEXTS }} vocabulary
 * @property {Date} now
 */
/** @typedef {{ kind: "lista", listLine: number, line: number } | { kind: "extra", index: number }} Leftover */

const PROPS_ATTR = /data-props="([^"]*)"/g;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const USAGE =
  "uso: node scripts/visual/proto.mjs --config=<caminho relativo a .git/sdd>";

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {unknown} error */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Aplica as trocas [original, troca] na ordem, cada uma em todas as ocorrências. Uma troca cujo
 * original não existe é erro "troca nº N não encontrada" (pelo número, nunca pelo texto).
 * @param {string} html
 * @param {unknown} pairs
 * @returns {string}
 */
export function applyReplacements(html, pairs) {
  if (!Array.isArray(pairs))
    throw new Error("as trocas não são uma lista de [original, troca]");
  let out = html;
  for (const [index, pair] of pairs.entries()) {
    const n = index + 1;
    if (
      !Array.isArray(pair) ||
      pair.length !== 2 ||
      typeof pair[0] !== "string" ||
      pair[0] === "" ||
      typeof pair[1] !== "string"
    ) {
      throw new Error(
        `troca nº ${n} inválida (use [original, troca], dois textos)`,
      );
    }
    if (!out.includes(pair[0])) throw new Error(`troca nº ${n} não encontrada`);
    out = out.split(pair[0]).join(pair[1]);
  }
  return out;
}

/** @param {string} value */
function decodeAttribute(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

/** @param {string} value */
function encodeAttribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

/** @param {string} html */
function propsMatch(html) {
  const matches = [...html.matchAll(PROPS_ATTR)];
  const [first] = matches;
  if (!first) throw new Error("a cópia não tem data-props");
  if (matches.length > 1)
    throw new Error(`a cópia tem ${matches.length} data-props (esperado 1)`);
  return first;
}

/**
 * As props do `data-props` do `.dc.html` (o JSON do atributo, já decodificado).
 * @param {string} html
 * @returns {Record<string, any>}
 */
export function readProps(html) {
  const match = propsMatch(html);
  let props;
  try {
    props = JSON.parse(decodeAttribute(match[1] ?? ""));
  } catch {
    throw new Error("data-props não é um JSON válido");
  }
  if (!isPlainObject(props)) throw new Error("data-props não é um objeto");
  return props;
}

/**
 * Muda o `default` das props dadas. Lança "prop desconhecida: <nome>", e no valor fora das
 * `options` ou de tipo diferente do padrão (booleano).
 * @param {string} html
 * @param {Record<string, unknown>} values
 * @returns {string}
 */
export function setPropDefaults(html, values) {
  const props = readProps(html);
  for (const [name, value] of Object.entries(values)) {
    if (!Object.hasOwn(props, name))
      throw new Error(`prop desconhecida: ${name}`);
    const prop = isPlainObject(props[name]) ? props[name] : {};
    if (Array.isArray(prop.options) && !prop.options.includes(value)) {
      throw new Error(`valor fora das opções da prop ${name}`);
    }
    if (typeof prop.default === "boolean" && typeof value !== "boolean") {
      throw new Error(`a prop ${name} é booleana`);
    }
    props[name] = { ...prop, default: value };
  }
  const match = propsMatch(html);
  const start = match.index ?? 0;
  return `${html.slice(0, start)}data-props="${encodeAttribute(JSON.stringify(props))}"${html.slice(start + match[0].length)}`;
}

/**
 * O que sobrou no texto: os termos da lista (pela linha da lista) e os `extra` da configuração
 * (pelo número, sem caixa).
 * @param {string} text
 * @param {NamesList} list
 * @param {readonly string[]} [extra]
 * @returns {Leftover[]}
 */
export function findLeftovers(text, list, extra = []) {
  /** @type {Leftover[]} */
  const hits = findForbidden(text, list).map((hit) => ({
    kind: "lista",
    listLine: hit.listLine,
    line: hit.line,
  }));
  const lower = text.toLowerCase();
  for (const [index, term] of extra.entries()) {
    if (
      typeof term === "string" &&
      term !== "" &&
      lower.includes(term.toLowerCase())
    ) {
      hits.push({ kind: "extra", index: index + 1 });
    }
  }
  return hits;
}

/**
 * @param {string} label
 * @param {string} text
 * @param {NamesList} list
 * @param {readonly string[]} extra
 */
function assertClean(label, text, list, extra) {
  const hits = findLeftovers(text, list, extra);
  if (hits.length === 0) return;
  const lines = hits
    .slice(0, 10)
    .map((hit) =>
      hit.kind === "lista"
        ? `${label}: sobrou o termo da linha ${hit.listLine} da lista (linha ${hit.line} da cópia)`
        : `${label}: sobrou o termo extra nº ${hit.index} dos leftovers`,
    );
  if (hits.length > 10) lines.push(`… e mais ${hits.length - 10}`);
  throw new Error(lines.join("\n"));
}

/** @param {unknown} value */
function isRelativeInside(value) {
  return (
    typeof value === "string" &&
    value !== "" &&
    !value.startsWith("/") &&
    !/^[a-zA-Z]:/.test(value) &&
    !value.split(/[\\/]/).includes("..")
  );
}

/**
 * @param {unknown} config
 * @returns {string[]}
 */
function validateProtoConfig(config) {
  if (!isPlainObject(config))
    return ["a configuração não é um objeto (export default)"];
  /** @type {string[]} */
  const errors = [];
  const extraKeys = Object.keys(config).filter(
    (k) => !["out", "sources", "leftovers"].includes(k),
  );
  if (extraKeys.length > 0)
    errors.push(`campo desconhecido: ${extraKeys.join(", ")}`);
  if (!isRelativeInside(config.out))
    errors.push("out: pasta relativa a .git/sdd, sem ..");
  if (
    config.leftovers !== undefined &&
    (!Array.isArray(config.leftovers) ||
      config.leftovers.some((t) => typeof t !== "string" || t === ""))
  ) {
    errors.push("leftovers: lista de textos");
  }
  if (!Array.isArray(config.sources) || config.sources.length === 0) {
    errors.push("sources: lista com pelo menos uma fonte");
    return errors;
  }
  for (const [index, source] of config.sources.entries()) {
    const at = `fonte ${index + 1}`;
    if (!isPlainObject(source)) {
      errors.push(`${at}: não é um objeto`);
      continue;
    }
    if (!isRelativeInside(source.file))
      errors.push(`${at}: file relativo a .git/sdd, sem ..`);
    if (
      source.support !== undefined &&
      (!Array.isArray(source.support) ||
        source.support.some((s) => !isRelativeInside(s)))
    ) {
      errors.push(`${at}: support é uma lista de arquivos ao lado do file`);
    }
    if (typeof source.replacements !== "function")
      errors.push(`${at}: replacements(ctx) é uma função`);
    if (
      !isPlainObject(source.copies) ||
      Object.keys(source.copies).length === 0
    ) {
      errors.push(`${at}: copies com pelo menos uma cópia`);
      continue;
    }
    for (const [name, copy] of Object.entries(source.copies)) {
      if (!SLUG.test(name)) errors.push(`${at}: cópia ${name}: nome inválido`);
      if (!isPlainObject(copy)) {
        errors.push(`${at}: cópia ${name}: não é um objeto`);
        continue;
      }
      if (copy.props !== undefined && !isPlainObject(copy.props)) {
        errors.push(`${at}: cópia ${name}: props é um objeto`);
      }
      if (
        copy.extra !== undefined &&
        !Array.isArray(copy.extra) &&
        typeof copy.extra !== "function"
      ) {
        errors.push(
          `${at}: cópia ${name}: extra é uma lista de trocas ou uma função(ctx)`,
        );
      }
    }
  }
  return errors;
}

/**
 * Gera as cópias da configuração (um caminho relativo a .git/sdd). Nada é gravado se uma cópia
 * falhar. Devolve os arquivos gravados.
 * @param {string} configRelPath
 * @returns {Promise<string[]>}
 */
export async function buildProtoCopies(configRelPath) {
  if (typeof configRelPath !== "string" || configRelPath === "")
    throw new Error(USAGE);
  const configFile = sddPath(configRelPath);
  let config;
  try {
    config = (await import(pathToFileURL(configFile).href)).default;
  } catch (error) {
    throw new Error(
      `não consegui carregar ${configRelPath}: ${messageOf(error)}`,
    );
  }
  const errors = validateProtoConfig(config);
  if (errors.length > 0) {
    throw new Error(
      `configuração inválida (${configRelPath}):\n- ${errors.join("\n- ")}`,
    );
  }
  const list = loadNamesList();
  if (list === null) {
    throw new Error(
      `lista de nomes ausente: ${namesListPath()} (grave antes de gerar as cópias)`,
    );
  }
  if (list.terms.length === 0)
    throw new Error(`lista de nomes vazia: ${namesListPath()}`);

  /** @type {ProtoContext} */
  const ctx = {
    avatars: readAvatars(),
    people: VISUAL_PEOPLE,
    vocabulary: {
      sectors: VISUAL_SECTORS,
      shifts: VISUAL_SHIFTS,
      items: VISUAL_ITEMS,
      destinations: VISUAL_DESTINATIONS,
      texts: VISUAL_TEXTS,
    },
    now: new Date(),
  };
  const outDir = sddPath(config.out);
  /** @type {readonly string[]} */
  const leftovers = config.leftovers ?? [];
  /** @type {Map<string, Buffer | string>} */
  const writes = new Map();

  for (const [index, source] of config.sources.entries()) {
    const label = `fonte ${index + 1}`;
    const original = readFileSync(sddPath(source.file), "utf8");
    let base;
    try {
      base = applyReplacements(original, source.replacements(ctx));
    } catch (error) {
      throw new Error(`${label}: ${messageOf(error)}`);
    }
    for (const [name, copy] of Object.entries(source.copies)) {
      const file = join(outDir, `${name}.html`);
      if (writes.has(file)) throw new Error(`cópia repetida: ${name}`);
      let html;
      try {
        html = copy.props ? setPropDefaults(base, copy.props) : base;
        const extra =
          typeof copy.extra === "function"
            ? copy.extra(ctx)
            : (copy.extra ?? []);
        html = applyReplacements(html, extra);
      } catch (error) {
        throw new Error(`${label}, cópia ${name}: ${messageOf(error)}`);
      }
      assertClean(`cópia ${name}`, html, list, leftovers);
      writes.set(file, html);
    }
    for (const support of source.support ?? []) {
      const content = readFileSync(sddPath(dirname(source.file), support));
      assertClean(
        `apoio ${basename(support)}`,
        content.toString("utf8"),
        list,
        leftovers,
      );
      const file = join(outDir, basename(support));
      const previous = writes.get(file);
      if (Buffer.isBuffer(previous) && !previous.equals(content)) {
        throw new Error(
          `apoio ${basename(support)} diferente entre as fontes: use um out para cada`,
        );
      }
      writes.set(file, content);
    }
  }

  for (const [file, content] of writes) writeInsideSdd(file, content);
  return [...writes.keys()];
}

async function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter((name) => name !== "config");
  if (
    unknown.length > 0 ||
    positional.length > 0 ||
    typeof flags.config !== "string"
  ) {
    throw new Error(USAGE);
  }
  const files = await buildProtoCopies(flags.config);
  const copies = files
    .filter((file) => file.endsWith(".html"))
    .map((file) => basename(file, ".html"));
  console.log(
    `cópias: ${copies.length} (${copies.join(", ")}), sem sobra de nenhum termo da lista`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(`visual:proto: ${messageOf(error)}`);
    process.exitCode = 1;
  });
}
