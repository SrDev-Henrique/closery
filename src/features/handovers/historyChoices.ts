import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { item, shift } from "@/db/schema/catalog";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import { CHOICE_LIST_LIMIT } from "@/features/admin/pagination";
import { fromDbTime } from "@/features/admin/timeOfDay";

import { listActiveShifts } from "./targets";
import type { HistoryItemChoice, HistoryShiftChoice } from "./types";

// Escolhas dos selects do histórico. Os ativos sempre; o turno ou o item
// ESCOLHIDO pela URL entra no fim mesmo desativado (o select nunca diz "Todos
// os turnos" com o filtro aplicado). Só do MESMO setor, e só com o setor ativo.

/** Turnos ativos do setor + o `selectedShiftId` quando é um turno inativo do mesmo setor. */
export async function listHistoryShifts(
  db: Db,
  sectorId: string,
  selectedShiftId: string | null,
): Promise<HistoryShiftChoice[]> {
  const active = (await listActiveShifts(db, sectorId)).map((entry) => ({
    ...entry,
    active: true,
  }));
  if (
    selectedShiftId === null ||
    active.some((entry) => entry.id === selectedShiftId)
  ) {
    return active;
  }

  const [selected] = await db
    .select({
      id: shift.id,
      name: shift.name,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      active: shift.active,
    })
    .from(shift)
    .innerJoin(sector, eq(sector.id, shift.sectorId))
    .where(
      and(
        eq(shift.id, selectedShiftId),
        eq(shift.sectorId, sectorId),
        eq(sector.active, true),
      ),
    )
    .limit(1);
  if (!selected) return active;
  return [
    ...active,
    {
      id: selected.id,
      name: selected.name,
      startsAt: fromDbTime(selected.startsAt),
      endsAt: fromDbTime(selected.endsAt),
      active: selected.active,
    },
  ];
}

/**
 * Itens ativos do setor (controle e estoque), com o nome e a unidade do
 * cadastro, + o `selectedItemId` quando é do mesmo setor e não está na lista
 * (um item inativo, ou um ativo além do teto de CHOICE_LIST_LIMIT).
 */
export async function listHistoryItems(
  db: Db,
  sectorId: string,
  selectedItemId: string | null,
): Promise<HistoryItemChoice[]> {
  const active: HistoryItemChoice[] = await db
    .select({
      id: item.id,
      name: item.name,
      unit: item.unit,
      active: item.active,
    })
    .from(item)
    .innerJoin(sector, eq(sector.id, item.sectorId))
    .where(
      and(
        eq(item.sectorId, sectorId),
        eq(item.active, true),
        eq(sector.active, true),
      ),
    )
    .orderBy(asc(item.sortOrder), asc(item.createdAt), asc(item.id))
    .limit(CHOICE_LIST_LIMIT);
  if (
    selectedItemId === null ||
    active.some((entry) => entry.id === selectedItemId)
  ) {
    return active;
  }

  const [selected] = await db
    .select({
      id: item.id,
      name: item.name,
      unit: item.unit,
      active: item.active,
    })
    .from(item)
    .innerJoin(sector, eq(sector.id, item.sectorId))
    .where(
      and(
        eq(item.id, selectedItemId),
        eq(item.sectorId, sectorId),
        eq(sector.active, true),
      ),
    )
    .limit(1);
  return selected ? [...active, selected] : active;
}
