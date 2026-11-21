export type SortDirection = "up" | "down";

/** Nova ordem dos ids com `id` um passo para cima/baixo; null se ausente ou já na borda. */
export function moveId(
  ids: readonly string[],
  id: string,
  direction: SortDirection,
): string[] | null {
  const from = ids.indexOf(id);
  if (from === -1) return null;
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= ids.length) return null;
  const next = [...ids];
  next[from] = ids[to] ?? id;
  next[to] = id;
  return next;
}

/** Renumera 1..n e devolve só quem muda (empates de sort_order se desfazem). */
export function planSortUpdates(
  current: readonly { id: string; sortOrder: number }[],
  nextIds: readonly string[],
): { id: string; sortOrder: number }[] {
  const currentOrder = new Map(current.map((row) => [row.id, row.sortOrder]));
  return nextIds
    .map((id, index) => ({ id, sortOrder: index + 1 }))
    .filter((update) => currentOrder.get(update.id) !== update.sortOrder);
}
