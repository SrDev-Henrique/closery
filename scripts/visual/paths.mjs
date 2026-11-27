// Caminhos das ferramentas do processo visual (spec §5.1 e §5.2). Toda saída vai para
// <git-common-dir>/sdd, achado pelo próprio git: numa worktree o `.git` é um arquivo, então nada
// aqui monta caminho com um ".git/" fixo nem com new URL("../.."). isInside e resolveInside são
// puras (não tocam no disco); as outras chamam o git uma vez por pasta e guardam o resultado.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const VISUAL_DB_DIR = "visual-db";

/** Arquivos do banco visual, dentro de `<sdd>/visual-db/`. */
export const VISUAL_DB_FILES = Object.freeze({
  world: "world.json",
  state: "state.json",
  avatars: "avatars.json",
  secret: "secret",
  data: "pgdata",
});

// Caminho do Windows: "C:\…", "C:/…" (o que o git devolve) ou "\\servidor\…".
const WINDOWS_PATH = /^[a-zA-Z]:[\\/]|^\\\\/;

/**
 * O `path` que entende o caminho: o do Windows compara sem caixa e aceita as duas barras. Escolher
 * pela forma (e não pelo sistema) deixa o teste do Windows rodar no CI Linux.
 * @param {string} sample
 */
function flavorOf(sample) {
  return WINDOWS_PATH.test(sample) ? path.win32 : path.posix;
}

/**
 * `child` está dentro de `parent` (ou é ele)? Puro. No Windows, sem caixa (`C:\A` = `c:\a`).
 * @param {string} parent
 * @param {string} child
 * @returns {boolean}
 */
export function isInside(parent, child) {
  const p = flavorOf(parent);
  const rel = p.relative(p.resolve(parent), p.resolve(parent, child));
  if (rel === "") return true;
  if (p.isAbsolute(rel)) return false;
  return rel !== ".." && !rel.startsWith(`..${p.sep}`);
}

/**
 * Resolve `relative` a partir de `base` e recusa o que escapa dela (`..`, absoluto fora). Puro.
 * @param {string} base
 * @param {string} relative
 * @returns {string} caminho absoluto
 */
export function resolveInside(base, relative) {
  const p = flavorOf(base);
  const resolved = p.resolve(base, relative);
  if (!isInside(base, resolved)) {
    throw new Error(`fora de ${base}: ${relative}`);
  }
  return resolved;
}

/** @type {Map<string, string>} */
const gitCache = new Map();

/**
 * @param {string[]} args
 * @param {string} cwd
 * @returns {string}
 */
function git(args, cwd) {
  const key = `${cwd}\n${args.join(" ")}`;
  const cached = gitCache.get(key);
  if (cached !== undefined) return cached;
  let out;
  try {
    out = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    throw new Error(`não é um repositório git: ${cwd}`);
  }
  gitCache.set(key, out);
  return out;
}

/**
 * `git rev-parse --path-format=absolute --git-common-dir`: o `.git` de verdade, o mesmo em todas as
 * worktrees.
 * @param {string} [cwd]
 * @returns {string}
 */
export function gitCommonDir(cwd = process.cwd()) {
  return path.resolve(
    git(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd),
  );
}

/**
 * `git rev-parse --show-toplevel`: a raiz da árvore de trabalho (a da worktree, numa worktree).
 * @param {string} [cwd]
 * @returns {string}
 */
export function repoRoot(cwd = process.cwd()) {
  return path.resolve(git(["rev-parse", "--show-toplevel"], cwd));
}

/**
 * `<gitCommonDir>/sdd`: a pasta de tudo o que fica fora do git.
 * @param {string} [cwd]
 * @returns {string}
 */
export function sddDir(cwd = process.cwd()) {
  return path.join(gitCommonDir(cwd), "sdd");
}

/**
 * Um caminho dentro de `.git/sdd` (relativo a ela); lança se escapar.
 * @param {...string} parts
 * @returns {string}
 */
export function sddPath(...parts) {
  return resolveInside(sddDir(), path.join(...parts));
}

/**
 * Confere que o arquivo (absoluto, ou relativo à pasta atual) fica dentro de `.git/sdd`.
 * @param {string} file
 * @returns {string} o caminho absoluto
 */
export function assertInsideSdd(file) {
  const resolved = path.resolve(file);
  if (!isInside(sddDir(), resolved)) {
    throw new Error(`fora de .git/sdd: ${file}`);
  }
  return resolved;
}

/** @returns {string} `<sdd>/visual-db` */
export function visualDbDir() {
  return sddPath(VISUAL_DB_DIR);
}

/**
 * Grava dentro de `.git/sdd`, criando as pastas; fora dela lança e nada é gravado.
 * @param {string} file
 * @param {string | Uint8Array} content
 */
export function writeInsideSdd(file, content) {
  const target = assertInsideSdd(file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

/**
 * Lê um JSON de dentro de `.git/sdd`.
 * @param {string} file
 * @returns {unknown}
 */
export function readJsonInsideSdd(file) {
  const target = assertInsideSdd(file);
  let text;
  try {
    text = readFileSync(target, "utf8");
  } catch {
    throw new Error(`arquivo ausente: ${target}`);
  }
  return JSON.parse(text);
}
