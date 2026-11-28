// Compara os cabeçalhos do .context/ui-registry.md (###) e do
// .context/pendencias.md (####) entre dois commits (spec §5.3; a conferência
// da revisão por tarefa):
//   node scripts/visual/registry-diff.mjs <base> [head=HEAD]
// Código 0: nenhum cabeçalho sumiu. 1: algum sumiu. 2: uso errado ou revisão
// desconhecida. Só lê (git show); não grava nada.
import { execFileSync } from "node:child_process";

import { compareHeadings, DOC_HEADING_LEVELS } from "./docs.mjs";

const USAGE = "Uso: node scripts/visual/registry-diff.mjs <base> [head=HEAD]";

/**
 * @param {string[]} args
 * @returns {string}
 */
function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** @param {string} rev */
function isCommit(rev) {
  try {
    git(["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * O arquivo naquela revisão; vazio quando ele não existe lá.
 * @param {string} rev
 * @param {string} file caminho da raiz
 */
function fileAt(rev, file) {
  try {
    return git(["show", `${rev}:${file}`]);
  } catch {
    return "";
  }
}

/**
 * @param {string[]} argv
 * @returns {0 | 1 | 2}
 */
function main(argv) {
  if (
    argv.length < 1 ||
    argv.length > 2 ||
    argv.some((arg) => arg.startsWith("-"))
  ) {
    console.error(USAGE);
    return 2;
  }
  const [base = "", head = "HEAD"] = argv;
  for (const rev of [base, head]) {
    if (!isCommit(rev)) {
      console.error(`registry-diff: revisão desconhecida: ${rev}`);
      return 2;
    }
  }
  let removedTotal = 0;
  for (const [file, level] of Object.entries(DOC_HEADING_LEVELS)) {
    const { removed, added } = compareHeadings(
      fileAt(base, file),
      fileAt(head, file),
      level,
    );
    removedTotal += removed.length;
    console.log(
      `${file}: ${removed.length} cabeçalho(s) ${"#".repeat(level)} sumiu(ram), ${added.length} novo(s)`,
    );
    for (const heading of removed) console.log(`  SUMIU  ${heading}`);
    for (const heading of added) console.log(`  NOVO   ${heading}`);
  }
  if (removedTotal > 0) {
    console.error(
      "registry-diff: algum cabeçalho sumiu. Um título renomeado aparece como SUMIU e NOVO: confira antes de aceitar.",
    );
    return 1;
  }
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(
    `registry-diff: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 2;
}
