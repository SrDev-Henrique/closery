// Edita uma entrada do .context/ui-registry.md sem tocar nas outras (spec §5.3):
//   node scripts/visual/registry.mjs <Componente> historico "<frase>"
//   node scripts/visual/registry.mjs <Componente> troca "<de>" "<para>"
// Grava só <raiz do repositório>/.context/ui-registry.md: é a exceção declarada
// à regra do .git/sdd (spec §5.1). As regras moram em docs.mjs.
// Código 0: editado. 1: a edição foi recusada (nada gravado). 2: uso errado.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { editRegistryEntry } from "./docs.mjs";
import { repoRoot } from "./paths.mjs";

const USAGE =
  'Uso: node scripts/visual/registry.mjs <Componente> historico "<frase>" | <Componente> troca "<de>" "<para>"';

/**
 * @param {string[]} argv
 * @returns {0 | 1 | 2}
 */
function main(argv) {
  const [name, op, a, b] = argv;
  const arity = op === "historico" ? 3 : op === "troca" ? 4 : 0;
  if (!name || arity === 0 || argv.length !== arity) {
    console.error(USAGE);
    return 2;
  }
  const file = join(repoRoot(), ".context", "ui-registry.md");
  const text = readFileSync(file, "utf8");
  const out = editRegistryEntry(
    text,
    name,
    /** @type {"historico" | "troca"} */ (op),
    a ?? "",
    b,
  );
  writeFileSync(file, out);
  console.log(`ok: ${name} (${op})`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(
    `registry: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
