import { pluralize } from "@/lib/plural";

import { DAY_MS, STALE_AFTER_MS } from "./limits";
import { isOpenStatus } from "./status";
import type { RequestStatus } from "./types";

// Dias inteiros completos no status (floor), nunca negativo (relógio adiantado).
// Espelho de daysInStatusSql (src/features/requests/sql.ts); o teste de
// paridade da Tarefa 9 compara os dois.
export function daysInStatus(statusChangedAt: Date, now: Date): number {
  return Math.max(
    0,
    Math.floor((now.getTime() - statusChangedAt.getTime()) / DAY_MS),
  );
}

// "Parada": aberta e há MAIS de 72 h (intervalo, sem fuso) no mesmo status.
// 72 h exatas ainda não é parada. Espelho de staleSql.
export function isStale(
  status: RequestStatus,
  statusChangedAt: Date,
  now: Date,
): boolean {
  return (
    isOpenStatus(status) &&
    now.getTime() - statusChangedAt.getTime() > STALE_AFTER_MS
  );
}

/** "Parada há 1 dia", "Parada há 5 dias". */
export function staleLabel(days: number): string {
  return `Parada há ${pluralize(days, "dia", "dias")}`;
}
