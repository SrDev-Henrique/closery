import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { user } from "@/db/schema/auth";
import { handover } from "@/db/schema/handovers";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import { type Authz, canAccessSector } from "@/features/authz/authz";

import type { HandoverRef } from "./types";

export type SectorRow = { id: string; name: string; active: boolean };
export type HandoverRow = typeof handover.$inferSelect;

export const sameRef = (ref: HandoverRef) =>
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
