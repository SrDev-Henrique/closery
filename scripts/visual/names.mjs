// Regras da guarda de nomes (spec §7): ler a lista de nomes, e-mails e textos dos
// protótipos, procurar os termos dela num texto e tirar as linhas acrescentadas
// de um diff. A lista mora fora do git (.git/sdd/nomes-proibidos.txt, achada pelo
// paths.mjs); aqui ninguém imprime um termo: quem acha devolve só o número da
// linha do texto e o da linha da lista (PB-D7). Testado em test/visual/names.test.ts.
import { existsSync, readFileSync } from "node:fs";

import { sddPath } from "./paths.mjs";

export const NAMES_LIST_FILE = "nomes-proibidos.txt";

/** @typedef {{ listLine: number, kind: "palavra" | "frase" | "email", value: string }} NameTerm */
/** @typedef {{ terms: NameTerm[], allowed: string[] }} NamesList */
/** @typedef {{ line: number, listLine: number }} NameHit */
/** @typedef {{ file: string, line: number, text: string }} AddedLine */

// Letra, dígito ou sublinhado: o que não pode encostar numa palavra ou frase.
const WORD_CHAR = String.raw`[\p{L}\p{N}_]`;
// O trecho permitido sai do texto trocado por um caractere que não é letra nem
// espaço: as palavras dos dois lados nunca se juntam numa frase proibida.
const ALLOWED_GAP = "\u0000";

/** @type {WeakMap<NamesList, { terms: { listLine: number, test: RegExp }[], allowed: RegExp[] }>} */
const compiled = new WeakMap();

/**
 * Sem acento e em minúsculas: "Ação" e "acao" casam.
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** @param {string} value */
function collapse(value) {
  return normalizeText(value).trim().replace(/\s+/g, " ");
}

/**
 * @param {string} value já normalizado
 * @returns {NameTerm["kind"]}
 */
function kindOf(value) {
  if (value.includes("@")) return "email";
  return value.includes(" ") ? "frase" : "palavra";
}

/**
 * Uma entrada por linha. Linha vazia e linha com "#" não contam; "!<frase>" é
 * permitida (sai do texto antes da busca). `listLine` é a linha no arquivo.
 * @param {string} text
 * @returns {NamesList}
 */
export function parseNamesList(text) {
  /** @type {NameTerm[]} */
  const terms = [];
  /** @type {string[]} */
  const allowed = [];
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = (lines[index] ?? "").trim();
    if (line === "" || line.startsWith("#")) continue;
    if (line.startsWith("!")) {
      const value = collapse(line.slice(1));
      if (value !== "") allowed.push(value);
      continue;
    }
    const value = collapse(line);
    terms.push({ listLine: index + 1, kind: kindOf(value), value });
  }
  return { terms, allowed };
}

/**
 * E-mail casa como trecho; palavra e frase, só inteiras (sem letra, dígito ou
 * "_" encostado), com qualquer espaço entre as palavras.
 * @param {string} value normalizado
 * @param {string} flags
 * @returns {RegExp}
 */
function matcherOf(value, flags) {
  const body = value
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/ /g, String.raw`\s+`);
  if (value.includes("@")) return new RegExp(body, flags);
  return new RegExp(`(?<!${WORD_CHAR})${body}(?!${WORD_CHAR})`, flags);
}

/** @param {NamesList} list */
function compile(list) {
  const cached = compiled.get(list);
  if (cached) return cached;
  const result = {
    terms: list.terms.map((term) => ({
      listLine: term.listLine,
      test: matcherOf(term.value, "u"),
    })),
    allowed: list.allowed.map((value) => matcherOf(value, "gu")),
  };
  compiled.set(list, result);
  return result;
}

/**
 * Procura os termos da lista, linha a linha, sem caixa e sem acento.
 * @param {string} text
 * @param {NamesList} list
 * @returns {NameHit[]} um por termo achado em cada linha, na ordem das linhas
 */
export function findForbidden(text, list) {
  const { terms, allowed } = compile(list);
  /** @type {NameHit[]} */
  const hits = [];
  if (terms.length === 0 || text === "") return hits;
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    let line = normalizeText(lines[index] ?? "");
    for (const matcher of allowed) line = line.replace(matcher, ALLOWED_GAP);
    for (const term of terms) {
      if (term.test.test(line)) {
        hits.push({ line: index + 1, listLine: term.listLine });
      }
    }
  }
  return hits;
}

/** @type {Readonly<Record<string, number>>} */
const GIT_ESCAPES = {
  a: 7,
  b: 8,
  t: 9,
  n: 10,
  v: 11,
  f: 12,
  r: 13,
  '"': 34,
  "\\": 92,
};

/**
 * Caminho entre aspas do git ("b/a\303\247\303\243o.md"): escapes do C e bytes
 * em octal, lidos como UTF-8.
 * @param {string} quoted
 * @returns {string}
 */
function unquoteGitPath(quoted) {
  const body = quoted.slice(1, -1);
  const encoder = new TextEncoder();
  /** @type {number[]} */
  const bytes = [];
  let i = 0;
  while (i < body.length) {
    if (body[i] === "\\") {
      const octal = /^[0-7]{3}/.exec(body.slice(i + 1, i + 4));
      if (octal) {
        bytes.push(Number.parseInt(octal[0], 8));
        i += 4;
        continue;
      }
      const escaped = body[i + 1] ?? "";
      bytes.push(GIT_ESCAPES[escaped] ?? escaped.charCodeAt(0));
      i += 2;
      continue;
    }
    const char = String.fromCodePoint(body.codePointAt(i) ?? 0);
    bytes.push(...encoder.encode(char));
    i += char.length;
  }
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

/**
 * O caminho do cabeçalho "+++ b/<caminho>" (com o TAB que o git põe no fim
 * quando o caminho tem espaço, e as aspas quando tem caractere especial).
 * @param {string} rest o que vem depois de "+++ "
 * @returns {string | null} null para "/dev/null" (arquivo apagado)
 */
function pathOfHeader(rest) {
  let path = rest.endsWith("\t") ? rest.slice(0, -1) : rest;
  if (path === "/dev/null") return null;
  if (path.startsWith('"') && path.endsWith('"')) path = unquoteGitPath(path);
  return path.startsWith("b/") ? path.slice(2) : path;
}

/**
 * As linhas acrescentadas de um `git diff` (feito para `-U0`; linhas de
 * contexto também são contadas). Os contadores do cabeçalho do hunk decidem o
 * que é linha do hunk: uma linha acrescentada "++ x" aparece como "+++ x" e
 * não é confundida com o cabeçalho do arquivo.
 * @param {string} diff
 * @returns {AddedLine[]}
 */
export function addedLinesFromDiff(diff) {
  /** @type {AddedLine[]} */
  const added = [];
  /** @type {string | null} */
  let file = null;
  let oldLeft = 0;
  let newLeft = 0;
  let next = 0;
  for (const raw of diff.split("\n")) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (oldLeft > 0 || newLeft > 0) {
      if (line.startsWith("\\")) continue;
      if (line.startsWith("+")) {
        if (file !== null)
          added.push({ file, line: next, text: line.slice(1) });
        next++;
        newLeft--;
        continue;
      }
      if (line.startsWith("-")) {
        oldLeft--;
        continue;
      }
      if (line.startsWith(" ")) {
        oldLeft--;
        newLeft--;
        next++;
        continue;
      }
      oldLeft = 0;
      newLeft = 0;
    }
    if (line.startsWith("diff --git ")) {
      file = null;
      continue;
    }
    if (line.startsWith("+++ ")) {
      file = pathOfHeader(line.slice(4));
      continue;
    }
    const hunk = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk) {
      oldLeft = hunk[1] === undefined ? 1 : Number(hunk[1]);
      next = Number(hunk[2]);
      newLeft = hunk[3] === undefined ? 1 : Number(hunk[3]);
    }
  }
  return added;
}

/**
 * Onde a lista mora: `<git-common-dir>/sdd/nomes-proibidos.txt` (vale para
 * worktree, onde `.git` é um arquivo).
 * @returns {string}
 */
export function namesListPath() {
  return sddPath(NAMES_LIST_FILE);
}

/**
 * A lista lida e interpretada, ou `null` quando o arquivo não existe (no CI ele
 * nunca existe: quem depende dele usa `it.skipIf`).
 * @returns {NamesList | null}
 */
export function loadNamesList() {
  const file = namesListPath();
  if (!existsSync(file)) return null;
  return parseNamesList(readFileSync(file, "utf8"));
}
