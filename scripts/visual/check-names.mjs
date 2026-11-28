// Guarda de nomes (spec §7): nada da lista .git/sdd/nomes-proibidos.txt (nomes,
// e-mails e textos dos protótipos, fora do git) entra num commit.
//   node scripts/visual/check-names.mjs --staged             o pre-commit
//   node scripts/visual/check-names.mjs --range=main...HEAD  o portão (diff e mensagens)
//   node scripts/visual/check-names.mjs --file=<caminho>     conferência avulsa
// Código 0: limpo. 1: achou. 2: lista ausente ou vazia, ou uso errado.
// O relatório nunca leva o termo (PB-D7): só o número dele e a linha da lista.
// As regras moram em names.mjs (testadas); aqui só se lê o git e se imprime.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { parseCliArgs } from "./config.mjs";
import {
  addedLinesFromDiff,
  findForbidden,
  loadNamesList,
  namesListPath,
} from "./names.mjs";

const USAGE =
  "Uso: node scripts/visual/check-names.mjs --staged | --range=<a>...<b> | --file=<caminho>";
const MODES = ["staged", "range", "file"];
// Diff estável qualquer que seja a configuração de quem roda: sem cor, sem
// diff externo, prefixos a/ e b/, caminho da raiz e só as linhas mudadas.
const DIFF_FLAGS = [
  "--no-color",
  "--no-ext-diff",
  "--no-relative",
  "--src-prefix=a/",
  "--dst-prefix=b/",
  "-U0",
];

class UsageError extends Error {}

/**
 * @param {string[]} args
 * @returns {string}
 */
function git(args) {
  return execFileSync("git", ["-c", "core.quotePath=false", ...args], {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * @typedef {{ mode: "staged" } | { mode: "range", from: string, to: string } | { mode: "file", file: string }} Mode
 * @param {string[]} argv
 * @returns {Mode}
 */
function readMode(argv) {
  const { flags, positional } = parseCliArgs(argv);
  const names = Object.keys(flags);
  const chosen = MODES.filter((mode) => names.includes(mode));
  if (
    positional.length > 0 ||
    chosen.length !== 1 ||
    names.length !== chosen.length
  ) {
    throw new UsageError(USAGE);
  }
  const value = flags[chosen[0] ?? ""];
  if (chosen[0] === "staged") {
    if (value !== true) throw new UsageError(USAGE);
    return { mode: "staged" };
  }
  if (typeof value !== "string" || value === "") throw new UsageError(USAGE);
  if (chosen[0] === "file") return { mode: "file", file: value };
  const parts = value.split("...");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new UsageError(`--range pede <a>...<b> (três pontos). ${USAGE}`);
  }
  return { mode: "range", from: parts[0], to: parts[1] };
}

/**
 * @param {string[]} args
 * @returns {string[]}
 */
function changedPaths(args) {
  return git([
    "diff",
    "--name-only",
    "-z",
    "--no-relative",
    "--diff-filter=d",
    ...args,
  ])
    .split("\0")
    .filter((path) => path !== "");
}

/**
 * @param {string} range "<a>..<b>"
 * @returns {{ sha: string, text: string }[]}
 */
function commitMessages(range) {
  return git(["log", "-z", "--format=%H%n%B", range])
    .split("\0")
    .map((chunk) => chunk.replace(/^\n+/, ""))
    .filter((chunk) => chunk !== "")
    .map((chunk) => {
      const end = chunk.indexOf("\n");
      return end < 0
        ? { sha: chunk, text: "" }
        : { sha: chunk.slice(0, end), text: chunk.slice(end + 1) };
    });
}

/**
 * @param {Mode} mode
 * @returns {{ paths: string[], lines: import("./names.mjs").AddedLine[], messages: { sha: string, text: string }[] }}
 */
function collect(mode) {
  if (mode.mode === "staged") {
    return {
      paths: changedPaths(["--cached"]),
      lines: addedLinesFromDiff(git(["diff", "--cached", ...DIFF_FLAGS])),
      messages: [],
    };
  }
  if (mode.mode === "range") {
    const range = `${mode.from}...${mode.to}`;
    return {
      paths: changedPaths([range]),
      lines: addedLinesFromDiff(git(["diff", ...DIFF_FLAGS, range])),
      messages: commitMessages(`${mode.from}..${mode.to}`),
    };
  }
  if (!existsSync(mode.file)) {
    throw new UsageError(`arquivo não encontrado: ${mode.file}`);
  }
  const text = readFileSync(mode.file, "utf8");
  return {
    paths: [],
    lines: text
      .split(/\r?\n/)
      .map((line, index) => ({ file: mode.file, line: index + 1, text: line })),
    messages: [],
  };
}

/**
 * @param {import("./names.mjs").NamesList} list
 * @param {{ paths: string[], lines: import("./names.mjs").AddedLine[], messages: { sha: string, text: string }[] }} sources
 * @returns {string[]}
 */
function findings(list, sources) {
  /** @param {number} listLine */
  const termRef = (listLine) => {
    const number =
      list.terms.findIndex((term) => term.listLine === listLine) + 1;
    return `termo nº ${number} da lista (linha ${listLine})`;
  };
  // Um caminho que tem um termo nunca é impresso: vira o número dele no diff.
  /** @param {string} file */
  const labelOf = (file) => {
    if (findForbidden(file, list).length === 0) return file;
    const index = sources.paths.indexOf(file);
    return index < 0 ? "o arquivo" : `arquivo nº ${index + 1} do diff`;
  };
  /** @type {string[]} */
  const out = [];
  sources.paths.forEach((path, index) => {
    for (const hit of findForbidden(path, list)) {
      out.push(`caminho nº ${index + 1} do diff — ${termRef(hit.listLine)}`);
    }
  });
  /** @type {Map<string, import("./names.mjs").AddedLine[]>} */
  const byFile = new Map();
  for (const line of sources.lines) {
    byFile.set(line.file, [...(byFile.get(line.file) ?? []), line]);
  }
  for (const [file, lines] of byFile) {
    const text = lines.map((line) => line.text).join("\n");
    for (const hit of findForbidden(text, list)) {
      const where = lines[hit.line - 1]?.line ?? hit.line;
      out.push(`${labelOf(file)}:${where} — ${termRef(hit.listLine)}`);
    }
  }
  for (const message of sources.messages) {
    for (const hit of findForbidden(message.text, list)) {
      out.push(
        `mensagem do commit ${message.sha.slice(0, 7)}, linha ${hit.line} — ${termRef(hit.listLine)}`,
      );
    }
  }
  return out;
}

/**
 * @param {string[]} argv
 * @returns {0 | 1 | 2}
 */
function main(argv) {
  let mode;
  try {
    mode = readMode(argv);
  } catch (error) {
    console.error(
      `check-names: ${error instanceof Error ? error.message : USAGE}`,
    );
    return 2;
  }
  let list;
  let sources;
  try {
    list = loadNamesList();
    if (list === null || list.terms.length === 0) {
      console.error(
        `check-names: a lista ${namesListPath()} não existe ou não tem nenhum termo. Crie a lista (uma entrada por linha; library-docs.md §22) ou tire o hook com "bun run visual:hooks --remove".`,
      );
      return 2;
    }
    sources = collect(mode);
  } catch (error) {
    console.error(
      `check-names: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 2;
  }
  const found = findings(list, sources);
  if (found.length === 0) {
    console.log(
      `check-names: nada da lista em ${sources.lines.length} linha(s), ${sources.paths.length} caminho(s) e ${sources.messages.length} mensagem(ns).`,
    );
    return 0;
  }
  for (const line of found) console.error(line);
  console.error(
    `check-names: ${found.length} achado(s). Troque o texto por um inventado (scripts/visual/vocabulary.mjs); falso positivo vira uma linha "!<frase>" na lista (library-docs.md §22).`,
  );
  return 1;
}

process.exitCode = main(process.argv.slice(2));
