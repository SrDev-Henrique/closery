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
