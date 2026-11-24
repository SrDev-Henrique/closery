import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { user } from "@/db/schema/auth";
import { shift } from "@/db/schema/catalog";
import { handover } from "@/db/schema/handovers";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import { notFoundMessage } from "@/features/admin/messages";
import {
  type AdminFailure,
  type AdminResult,
  fail,
  ok,
} from "@/features/admin/result";
import { type Authz, canAccessSector } from "@/features/authz/authz";

import {
  DATE_OUT_OF_RANGE_MESSAGE,
  SECTOR_INACTIVE_HANDOVER_MESSAGE,
  SHIFT_INACTIVE_MESSAGE,
} from "./messages";
import { isIsoDate, isOperationalDateAllowed } from "./saoPaulo";
import type { HandoverRef } from "./types";

export type SectorRow = { id: string; name: string; active: boolean };
export type HandoverRow = typeof handover.$inferSelect;

const sameRef = (ref: HandoverRef) =>
  and(
    eq(handover.sectorId, ref.sectorId),
    eq(handover.shiftId, ref.shiftId),
    eq(handover.operationalDate, ref.operationalDate),
  );

/** null se o setor não existe OU o operador não pode acessá-lo (a mesma resposta: não revela o que existe). */
export async function loadSector(
  db: Db,
  actor: Authz,
  sectorId: string,
): Promise<SectorRow | null> {
  const [row] = await db
    .select({ id: sector.id, name: sector.name, active: sector.active })
    .from(sector)
    .where(eq(sector.id, sectorId));
  if (!row || !canAccessSector(actor, row.id)) return null;
  return row;
}

export async function findHandoverByRef(
  db: Db,
  ref: HandoverRef,
): Promise<HandoverRow | null> {
  const [row] = await db.select().from(handover).where(sameRef(ref));
  return row ?? null;
}

/** null se não existe ou está fora do escopo do operador. */
export async function findHandoverById(
  db: Db,
  actor: Authz,
  id: string,
): Promise<HandoverRow | null> {
  const [row] = await db.select().from(handover).where(eq(handover.id, id));
  if (!row || !canAccessSector(actor, row.sectorId)) return null;
  return row;
}

/** `SELECT … FOR UPDATE`: use dentro da transação, antes de decidir a mensagem. */
export async function lockHandover(
  tx: Db,
  id: string,
): Promise<HandoverRow | null> {
  const [row] = await tx
    .select()
    .from(handover)
    .where(eq(handover.id, id))
    .for("update");
  return row ?? null;
}

/** id → nome. Sem ids, nem consulta. */
export async function userNames(
  db: Db,
  ids: readonly string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(inArray(user.id, [...new Set(ids)]));
  return new Map(rows.map((row) => [row.id, row.name]));
}

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

/**
 * Dentro da transação do chamador. Setor inativo é só leitura (P26): recusa
 * com `SECTOR_INACTIVE` mesmo que a linha já exista. Linha já existente: trava
 * e devolve sem revalidar turno nem data (um rascunho antigo continua editável
 * e entregável). Linha nova: exige turno do setor e ativo, data dentro da janela;
 * `INSERT … ON CONFLICT DO NOTHING` e, se outra pessoa chegou antes, trava a dela.
 */
export async function ensureHandover(
  tx: Db,
  actor: Authz,
  ref: HandoverRef,
  now: Date,
): Promise<AdminResult<{ row: HandoverRow; created: boolean }>> {
  const owner = await loadSector(tx, actor, ref.sectorId);
  if (!owner) return fail("NOT_FOUND", notFoundMessage("setor"));
  if (!owner.active) {
    return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_HANDOVER_MESSAGE);
  }
  if (!isIsoDate(ref.operationalDate)) {
    return fail("DATE_OUT_OF_RANGE", DATE_OUT_OF_RANGE_MESSAGE);
  }

  const lockByRef = async () => {
    const [row] = await tx
      .select()
      .from(handover)
      .where(sameRef(ref))
      .for("update");
    return row ?? null;
  };

  const existing = await lockByRef();
  if (existing) return ok({ row: existing, created: false });

  const [target] = await tx
    .select({ active: shift.active })
    .from(shift)
    .where(and(eq(shift.id, ref.shiftId), eq(shift.sectorId, ref.sectorId)));
  if (!target) return fail("NOT_FOUND", notFoundMessage("turno"));
  if (!target.active) return fail("SHIFT_INACTIVE", SHIFT_INACTIVE_MESSAGE);
  if (!isOperationalDateAllowed(ref.operationalDate, now)) {
    return fail("DATE_OUT_OF_RANGE", DATE_OUT_OF_RANGE_MESSAGE);
  }

  const [inserted] = await tx
    .insert(handover)
    .values({
      sectorId: ref.sectorId,
      shiftId: ref.shiftId,
      operationalDate: ref.operationalDate,
    })
    .onConflictDoNothing()
    .returning();
  if (inserted) return ok({ row: inserted, created: true });

  const raced = await lockByRef();
  if (!raced) throw new Error("ensureHandover: a linha sumiu após o conflito");
  return ok({ row: raced, created: false });
}
