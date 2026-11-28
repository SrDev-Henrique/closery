// Instala o pre-commit que roda o check-names (spec §7):
//   node scripts/visual/install-hooks.mjs           instala ou regrava o nosso
//   node scripts/visual/install-hooks.mjs --remove  apaga só o nosso
// Grava só o arquivo de `git rev-parse --git-path hooks/pre-commit` (respeita o
// core.hooksPath; fora da árvore de trabalho): é a exceção declarada à regra do
// .git/sdd. Um pre-commit que não é deste projeto nunca é tocado (código 1).
// Numa branch sem scripts/visual/check-names.mjs (uma branch antiga, ou a main
// antes do merge do PR B) o hook deixa o commit passar com um aviso.
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseCliArgs } from "./config.mjs";

export const HOOK_MARKER = "# closery:check-names";

/** O script que o hook roda, relativo à raiz da árvore (o cwd de um hook do git). */
export const CHECK_NAMES_SCRIPT = "scripts/visual/check-names.mjs";

/** O aviso do hook numa branch que não tem o {@link CHECK_NAMES_SCRIPT}. */
export const MISSING_SCRIPT_WARNING = `aviso (closery:check-names): esta branch não tem ${CHECK_NAMES_SCRIPT}; o commit segue sem a conferência da lista de nomes.`;

const USAGE = "Uso: node scripts/visual/install-hooks.mjs [--remove]";

/**
 * O pre-commit, com LF (o sh do Git para Windows não aceita CRLF). Sem o
 * check-names na branch, avisa e sai com 0; com ele, o código é o do check-names.
 * @returns {string}
 */
export function hookScript() {
  return [
    "#!/bin/sh",
    `${HOOK_MARKER} (instalado por scripts/visual/install-hooks.mjs)`,
    `if [ ! -f ${CHECK_NAMES_SCRIPT} ]; then`,
    `  echo "${MISSING_SCRIPT_WARNING}" >&2`,
    "  exit 0",
    "fi",
    `exec node ${CHECK_NAMES_SCRIPT} --staged`,
    "",
  ].join("\n");
}

/**
 * É o nosso quando uma linha começa pela marca (seguida de espaço ou do fim).
 * @param {string} content
 * @returns {boolean}
 */
export function isOurHook(content) {
  return content
    .split(/\r?\n/)
    .some((line) => line === HOOK_MARKER || line.startsWith(`${HOOK_MARKER} `));
}

/** @returns {string} */
function hookPath() {
  return execFileSync(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-path", "hooks/pre-commit"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}

/**
 * @param {string[]} argv
 * @returns {0 | 1 | 2}
 */
function main(argv) {
  const { flags, positional } = parseCliArgs(argv);
  const unknown = Object.keys(flags).filter((name) => name !== "remove");
  if (
    positional.length > 0 ||
    unknown.length > 0 ||
    (flags.remove !== undefined && flags.remove !== true)
  ) {
    console.error(USAGE);
    return 2;
  }
  const file = hookPath();
  const current = existsSync(file) ? readFileSync(file, "utf8") : null;
  if (flags.remove === true) {
    if (current === null) {
      console.log(`nenhum pre-commit em ${file}: nada a remover.`);
      return 0;
    }
    if (!isOurHook(current)) {
      console.error(
        `o pre-commit em ${file} não é deste projeto: nada foi removido.`,
      );
      return 1;
    }
    rmSync(file);
    console.log(`hook removido: ${file}`);
    return 0;
  }
  if (current !== null && !isOurHook(current)) {
    console.error(
      `já existe um pre-commit que não é deste projeto em ${file}; nada foi gravado. Junte à mão: acrescente a linha "[ ! -f ${CHECK_NAMES_SCRIPT} ] || node ${CHECK_NAMES_SCRIPT} --staged || exit 1" ao hook que existe.`,
    );
    return 1;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, hookScript());
  chmodSync(file, 0o755);
  console.log(
    `${current === null ? "hook instalado" : "hook regravado"}: ${file}`,
  );
  return 0;
}

/** Só roda como script (`node scripts/visual/install-hooks.mjs`); importado pelo teste, não faz nada. */
function runsAsScript() {
  const entry = process.argv[1];
  if (!entry) return false;
  const a = resolve(entry);
  const b = fileURLToPath(import.meta.url);
  return process.platform === "win32"
    ? a.toLowerCase() === b.toLowerCase()
    : a === b;
}

if (runsAsScript()) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(
      `install-hooks: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
