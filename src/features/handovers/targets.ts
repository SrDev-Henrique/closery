import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { shift } from "@/db/schema/catalog";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import { CHOICE_LIST_LIMIT } from "@/features/admin/pagination";
import { fromDbTime } from "@/features/admin/timeOfDay";

import type { ShiftChoice } from "./types";

/**
 * Turnos ativos de um setor ativo, na ordem da lista (`sort_order`,
 * `created_at`, `id`), com horário "HH:mm". Setor inativo ou inexistente → [].
 */
export async function listActiveShifts(
  db: Db,
  sectorId: string,
): Promise<ShiftChoice[]> {
  const rows = await db
    .select({
      id: shift.id,
      name: shift.name,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
    })
    .from(shift)
    .innerJoin(sector, eq(sector.id, shift.sectorId))
    .where(
      and(
        eq(shift.sectorId, sectorId),
        eq(shift.active, true),
        eq(sector.active, true),
      ),
    )
    .orderBy(asc(shift.sortOrder), asc(shift.createdAt), asc(shift.id))
    .limit(CHOICE_LIST_LIMIT);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    startsAt: fromDbTime(row.startsAt),
    endsAt: fromDbTime(row.endsAt),
  }));
}
