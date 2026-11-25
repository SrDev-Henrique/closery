// Search params como o Next entrega à página (depois do `await searchParams`).
export type SearchParams = Record<string, string | string[] | undefined>;

// Valor de um search param do Next (`string | string[] | undefined`): parâmetro
// repetido (`?a=1&a=2`) vale o primeiro; lista vazia, nenhum.
export function firstValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Os filtros que a Pagination preserva: os parâmetros do href que o
// buildXxxHref monta, como objeto.
export function paginationParams(href: string): Record<string, string> {
  return Object.fromEntries(new URL(href, "http://closery.local").searchParams);
}

// O query de uma URL (com ou sem o "?" inicial) como objeto: parâmetro repetido
// vale o primeiro, como em `firstValue`. É o formato que os `parseXxx` dos
// filtros leem.
export function queryRecord(query: string): Record<string, string> {
  const text = query.startsWith("?") ? query.slice(1) : query;
  const first = new Map<string, string>();
  for (const [key, value] of new URLSearchParams(text)) {
    if (!first.has(key)) first.set(key, value);
  }
  return Object.fromEntries(first);
}

// O que vem depois do "?" de um href ("" quando não há query).
export function hrefQuery(href: string): string {
  const mark = href.indexOf("?");
  return mark < 0 ? "" : href.slice(mark + 1);
}
