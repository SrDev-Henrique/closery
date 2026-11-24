import { isOpenStatus } from "./status";
import type {
  RequestCardView,
  RequestGroup,
  RequestGroupView,
  RequestStatus,
} from "./types";

// Movimento otimista do Quadro e da Lista: o reducer de useOptimistic. Puro:
// nunca muta a entrada e só usa o instante de `intent.at`.
export type MoveIntent = { id: string; to: RequestStatus; at: Date };

function isKey<K extends string>(
  record: Readonly<Record<K, unknown>>,
  key: string,
): key is K {
  return key in record;
}

function keysOf<K extends string>(record: Readonly<Record<K, unknown>>): K[] {
  return Object.keys(record).filter((key): key is K => isKey(record, key));
}

function isComplete<K extends string, V>(
  partial: Partial<Record<K, V>>,
  keys: readonly K[],
): partial is Record<K, V> {
  return keys.every((key) => key in partial);
}

// Mesmas chaves, valores trocados (sem `as`: a conferência é um type guard).
function mapGroups<K extends RequestStatus, V, W>(
  record: Readonly<Record<K, V>>,
  change: (value: V, key: K) => W,
): Record<K, W> {
  const keys = keysOf(record);
  const result: Partial<Record<K, W>> = {};
  for (const key of keys) result[key] = change(record[key], key);
  if (!isComplete(result, keys)) {
    throw new Error("mapGroups: grupo perdido");
  }
  return result;
}

/** Os grupos do servidor como a tela os mostra: nenhum cartão em voo. */
export function toGroupView<K extends RequestStatus>(
  groups: Readonly<Record<K, RequestGroup>>,
): Record<K, RequestGroupView> {
  return mapGroups(groups, (group) => ({
    ...group,
    rows: group.rows.map((row) => ({ ...row, pending: false })),
  }));
}

/**
 * Move o cartão de grupo: sai da origem (total − 1, nunca < 0) e entra no
 * destino (total + 1) com `pending`. Entregue e Cancelada entram no topo (a
 * mais recente primeiro); uma coluna aberta só ganha o cartão no fim se
 * mostrava tudo (sem "Carregar mais" pendente). Não achou o cartão ou ele já
 * está em `to` → devolve o MESMO objeto. Destino ausente (Cancelada no
 * Quadro) → só sai da origem.
 */
export function applyMove<K extends RequestStatus>(
  groups: Readonly<Record<K, RequestGroupView>>,
  intent: MoveIntent,
): Record<K, RequestGroupView> {
  const keys = keysOf(groups);
  const origin = keys.find((key) =>
    groups[key].rows.some((row) => row.id === intent.id),
  );
  if (origin === undefined) return groups;
  const card = groups[origin].rows.find((row) => row.id === intent.id);
  if (card === undefined || card.status === intent.to) return groups;

  const moved: RequestCardView = {
    ...card,
    status: intent.to,
    statusChangedAt: intent.at,
    daysInStatus: 0,
    stale: false,
    pending: true,
  };

  return mapGroups(groups, (group, key) => {
    if (key === origin) {
      return {
        ...group,
        total: Math.max(0, group.total - 1),
        rows: group.rows.filter((row) => row.id !== intent.id),
      };
    }
    if (key === intent.to) {
      const complete = group.rows.length >= group.total;
      const rows = isOpenStatus(intent.to)
        ? complete
          ? [...group.rows, moved]
          : group.rows
        : [moved, ...group.rows];
      return { ...group, total: group.total + 1, rows };
    }
    return group;
  });
}
