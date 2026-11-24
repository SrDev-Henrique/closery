import { codePointLength } from "@/features/handovers/fieldRules";

import { SEARCH_MAX_LENGTH } from "./limits";

// Dobra de acento sem extensão do Postgres: translate(lower(x), FROM, TO) no
// SQL e foldForSearch aqui têm de dar o mesmo resultado (as duas strings têm
// 24 caracteres, mesma posição; o teste de paridade da Tarefa 9 confere).
export const SEARCH_FOLD_FROM = "áàâãäéèêëíìîïóòôõöúùûüçñ";
export const SEARCH_FOLD_TO = "aaaaaeeeeiiiiooooouuuucn";

const FOLD_MAP = new Map<string, string>(
  Array.from(SEARCH_FOLD_FROM, (char, index): [string, string] => [
    char,
    SEARCH_FOLD_TO.charAt(index),
  ]),
);

/** NFC, qualquer sequência de espaços/quebras vira um espaço, trim, corta em 80 pontos de código. */
export function normalizeSearch(raw: string): string {
  const text = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (codePointLength(text) <= SEARCH_MAX_LENGTH) return text;
  return Array.from(text).slice(0, SEARCH_MAX_LENGTH).join("").trim();
}

/** NFC + minúsculas + troca das letras acentuadas: espelho de translate(lower(x), FROM, TO). */
export function foldForSearch(value: string): string {
  return Array.from(value.normalize("NFC").toLowerCase(), (char) => {
    return FOLD_MAP.get(char) ?? char;
  }).join("");
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Padrão do ILIKE (escape padrão `\`): `%`, `_` e `\` da busca valem como
 * texto. Sem busca (ou só espaços) → null: sem filtro.
 */
export function searchPattern(search: string): string | null {
  if (search.trim() === "") return null;
  return `%${escapeLike(foldForSearch(search))}%`;
}
