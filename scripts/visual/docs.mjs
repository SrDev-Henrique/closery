// Regras puras dos dois documentos que as ferramentas editam e comparam (spec
// §5.3): uma entrada do .context/ui-registry.md e os cabeçalhos do registro
// (###) e das pendências (####). Os CLIs (registry.mjs, registry-diff.mjs) só
// leem e gravam. Linhas dentro de bloco de código (```) não contam como
// cabeçalho nem como entrada: o modelo dos dois arquivos mora num bloco.

/** O nível dos cabeçalhos que não podem sumir, por arquivo (caminho da raiz). */
export const DOC_HEADING_LEVELS = Object.freeze({
  ".context/ui-registry.md": 3,
  ".context/pendencias.md": 4,
});

/**
 * @param {string[]} lines
 * @returns {boolean[]} true onde a linha está dentro de um bloco de código (as cercas contam como dentro)
 */
function fenceMap(lines) {
  let inFence = false;
  return lines.map((line) => {
    if (line.startsWith("```")) {
      inFence = !inFence;
      return true;
    }
    return inFence;
  });
}

/**
 * Os cabeçalhos de um nível ("### Button"), na ordem, fora dos blocos de código.
 * @param {string} text
 * @param {number} level de 1 a 6
 * @returns {string[]}
 */
export function headingsOf(text, level) {
  if (!Number.isInteger(level) || level < 1 || level > 6) {
    throw new Error(`nível de cabeçalho inválido: ${level}`);
  }
  const prefix = `${"#".repeat(level)} `;
  const lines = text.split(/\r?\n/);
  const fenced = fenceMap(lines);
  return lines
    .filter((line, index) => !fenced[index] && line.startsWith(prefix))
    .map((line) => line.trimEnd());
}

/**
 * Edita só a entrada `### <name>` do ui-registry.md: "historico" acrescenta a
 * frase ao fim do parágrafo do Histórico; "troca" troca um trecho que aparece
 * uma vez só na entrada. Nenhum cabeçalho ### some nem aparece.
 * @param {string} text
 * @param {string} name
 * @param {"historico" | "troca"} op
 * @param {string} a a frase (historico) ou o trecho de origem (troca)
 * @param {string} [b] o trecho novo (troca)
 * @returns {string}
 */
export function editRegistryEntry(text, name, op, a, b) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const fenced = fenceMap(lines);
  const start = lines.findIndex(
    (line, index) => !fenced[index] && line === `### ${name}`,
  );
  if (start < 0) throw new Error(`sem a entrada ### ${name}`);
  let end = lines.findIndex(
    (line, index) =>
      index > start &&
      !fenced[index] &&
      (line.startsWith("### ") || line.startsWith("## ")),
  );
  if (end < 0) end = lines.length;
  const entry = lines.slice(start, end);
  /** @type {string[]} */
  let next;
  if (op === "historico") {
    if (!a) throw new Error("historico: falta a frase");
    const at = entry.findIndex((line) => line.startsWith("- **Histórico:**"));
    if (at < 0) throw new Error("entrada sem Histórico");
    // O parágrafo do Histórico vai até a linha vazia ou o próximo "- **".
    let last = at;
    while (
      last + 1 < entry.length &&
      (entry[last + 1] ?? "").trim() !== "" &&
      !(entry[last + 1] ?? "").startsWith("- **")
    ) {
      last++;
    }
    next = [...entry];
    next[last] = `${entry[last]} ${a}`;
  } else if (op === "troca") {
    if (!a || b === undefined)
      throw new Error("troca: falta o trecho de origem ou o novo");
    const joined = entry.join("\n");
    const count = joined.split(a).length - 1;
    if (count !== 1) {
      throw new Error(`"${a.slice(0, 60)}" aparece ${count} vezes na entrada`);
    }
    // Função no lugar da string: "$&" e "$1" no texto novo ficam literais.
    next = joined.replace(a, () => b).split("\n");
  } else {
    throw new Error("op: historico | troca");
  }
  const out = [...lines.slice(0, start), ...next, ...lines.slice(end)].join(
    eol,
  );
  const before = headingsOf(text, 3).length;
  const after = headingsOf(out, 3).length;
  if (after < before) throw new Error("um cabeçalho ### sumiu");
  if (after > before) throw new Error("a troca criou um cabeçalho ###");
  return out;
}

/**
 * @param {string[]} from
 * @param {string[]} minus
 * @returns {string[]} o que está em `from` e não em `minus`, contando repetidos
 */
function difference(from, minus) {
  /** @type {Map<string, number>} */
  const left = new Map();
  for (const item of minus) left.set(item, (left.get(item) ?? 0) + 1);
  /** @type {string[]} */
  const out = [];
  for (const item of from) {
    const count = left.get(item) ?? 0;
    if (count > 0) left.set(item, count - 1);
    else out.push(item);
  }
  return out;
}

/**
 * Os cabeçalhos de um nível que sumiram e que apareceram entre dois textos. Um
 * título renomeado aparece nas duas listas.
 * @param {string} base
 * @param {string} head
 * @param {number} level
 * @returns {{ removed: string[], added: string[] }}
 */
export function compareHeadings(base, head, level) {
  const before = headingsOf(base, level);
  const after = headingsOf(head, level);
  return {
    removed: difference(before, after),
    added: difference(after, before),
  };
}
