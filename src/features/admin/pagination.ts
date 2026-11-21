export const PAGE_SIZE = 50;
export const CHOICE_LIST_LIMIT = 200;
export const MAX_PAGE = 10_000;

export type Page<T> = {
  rows: T[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

/** Lixo, zero, negativo, decimal, fora do teto ou ausente → 1. */
export function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return page >= 1 && page <= MAX_PAGE ? page : 1;
}

/** Página fora do intervalo é clampada: a lista nunca fica vazia por engano. */
export function resolvePage(
  total: number,
  requested: number,
): { page: number; pageCount: number; offset: number } {
  const safeTotal = Math.max(0, total);
  const pageCount = Math.max(1, Math.ceil(safeTotal / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(requested)), pageCount);
  return { page, pageCount, offset: (page - 1) * PAGE_SIZE };
}

/** Mantém os outros parâmetros (ex.: setor); a página 1 remove o parâmetro. */
export function buildPageHref(
  pathname: string,
  params: Record<string, string | undefined>,
  param: string,
  page: number,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== param && value !== undefined) search.set(key, value);
  }
  if (page > 1) search.set(param, String(Math.floor(page)));
  const query = search.toString();
  return query === "" ? pathname : `${pathname}?${query}`;
}
