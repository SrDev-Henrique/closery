import { firstValue } from "@/lib/searchParams";

import { COMMENTS_MAX_LIMIT, COMMENTS_PAGE_SIZE } from "./limits";

export const REQUESTS_PATH = "/solicitacoes";

/** `/solicitacoes/{id}`; `?comentarios=N` só quando N pede mais que a primeira página de comentários. */
export function requestHref(
  id: string,
  options: { comments?: number } = {},
): string {
  const base = `${REQUESTS_PATH}/${id}`;
  const comments = options.comments;
  return comments !== undefined && comments > COMMENTS_PAGE_SIZE
    ? `${base}?comentarios=${Math.floor(comments)}`
    : base;
}

/** A lista de solicitações; o admin leva o setor escolhido (id ou "todos"). */
export function requestsHref(sector?: string | null): string {
  if (sector === undefined || sector === null || sector === "") {
    return REQUESTS_PATH;
  }
  return `${REQUESTS_PATH}?${new URLSearchParams({ setor: sector }).toString()}`;
}

/** ?comentarios=: múltiplo de 50 entre 50 e 500 (arredonda para baixo); lixo, zero ou ausente → 50. */
export function parseCommentsLimit(raw: string | string[] | undefined): number {
  const value = firstValue(raw);
  if (value === undefined || !/^\d+$/.test(value)) return COMMENTS_PAGE_SIZE;
  const rounded =
    Math.floor(Number(value) / COMMENTS_PAGE_SIZE) * COMMENTS_PAGE_SIZE;
  return Math.min(Math.max(rounded, COMMENTS_PAGE_SIZE), COMMENTS_MAX_LIMIT);
}
