import "server-only";

import type { Db } from "@/db/types";

import type { AdminFailure, AdminResult } from "./result";

// Sinal interno: desfaz a transação quando o trabalho termina em falha esperada.
class RollbackSignal extends Error {
  constructor(readonly failure: AdminFailure) {
    super("rollback");
  }
}

/**
 * `db.transaction()` em que uma falha esperada (`ok: false`) DESFAZ tudo:
 * um rascunho criado por `ensureHandover` não sobrevive a um salvamento
 * recusado (o rascunho só nasce no primeiro salvamento que dá certo).
 * Exceção inesperada segue adiante, também com rollback.
 */
export async function runInTransaction<T extends object>(
  db: Db,
  work: (tx: Db) => Promise<AdminResult<T>>,
): Promise<AdminResult<T>> {
  try {
    return await db.transaction(async (tx) => {
      const result = await work(tx);
      if (!result.ok) throw new RollbackSignal(result);
      return result;
    });
  } catch (error) {
    if (error instanceof RollbackSignal) return error.failure;
    throw error;
  }
}
