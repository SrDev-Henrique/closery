import "server-only";

import { and, eq } from "drizzle-orm";

import { shift } from "@/db/schema/catalog";
import { handover } from "@/db/schema/handovers";
import type { Db } from "@/db/types";
import { notFoundMessage } from "@/features/admin/messages";
import {
  type AdminFailure,
  type AdminResult,
  fail,
  ok,
} from "@/features/admin/result";
import type { Authz } from "@/features/authz/authz";

import { type HandoverRow, loadSector, sameRef } from "./loaders";
import {
  DATE_OUT_OF_RANGE_MESSAGE,
  SECTOR_INACTIVE_HANDOVER_MESSAGE,
  SHIFT_INACTIVE_MESSAGE,
} from "./messages";
import { isIsoDate, isOperationalDateAllowed } from "./saoPaulo";
import type { HandoverRef } from "./types";

/**
 * Por que uma combinação setor + turno + dia SEM linha ainda não pode virar
 * rascunho, ou `null` se pode: turno que não existe no setor → `NOT_FOUND`;
 * turno inativo → `SHIFT_INACTIVE`; data fora da janela → `DATE_OUT_OF_RANGE`
 * (nessa ordem). Usada por `ensureHandover` (linha nova) e por
 * `getHandoverFormState` (sem linha): as duas dizem a mesma coisa.
 */
export function creationRefusal(
  target: { active: boolean } | null,
  ref: HandoverRef,
  now: Date,
): AdminFailure | null {
  if (target === null) return fail("NOT_FOUND", notFoundMessage("turno"));
  if (!target.active) return fail("SHIFT_INACTIVE", SHIFT_INACTIVE_MESSAGE);
  if (!isOperationalDateAllowed(ref.operationalDate, now)) {
    return fail("DATE_OUT_OF_RANGE", DATE_OUT_OF_RANGE_MESSAGE);
  }
  return null;
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
  const refusal = creationRefusal(target ?? null, ref, now);
  if (refusal) return refusal;

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
