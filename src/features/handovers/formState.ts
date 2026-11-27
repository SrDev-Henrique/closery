import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { item, shift } from "@/db/schema/catalog";
import type { HandoverStatus } from "@/db/schema/handovers";
import { handoverItem } from "@/db/schema/handovers";
import type { Db } from "@/db/types";
import { notFoundMessage } from "@/features/admin/messages";
import { CHOICE_LIST_LIMIT } from "@/features/admin/pagination";
import { type AdminResult, fail, ok } from "@/features/admin/result";
import type { Authz } from "@/features/authz/authz";
import type { ItemKind } from "@/lib/itemKinds";

import { formModeOf, handoverCapabilities } from "./access";
import { creationRefusal } from "./ensureHandover";
import {
  findHandoverById,
  findHandoverByRef,
  type HandoverRow,
  loadSector,
  type SectorRow,
  userNames,
} from "./loaders";
import {
  DATE_OUT_OF_RANGE_MESSAGE,
  HANDOVER_NOT_FOUND_MESSAGE,
  SECTOR_INACTIVE_HANDOVER_MESSAGE,
} from "./messages";
import { isIsoDate } from "./saoPaulo";
import type { FormMode, HandoverRef, ItemLine, SavedMark } from "./types";

export type HandoverFormState = {
  ref: HandoverRef;
  /** null = ainda não existe rascunho (nada salvo). */
  handoverId: string | null;
  /** null junto com handoverId null. */
  status: HandoverStatus | null;
  sectorName: string;
  shiftName: string;
  occurrencesText: string;
  nextShiftText: string;
  controls: ItemLine[];
  stock: ItemLine[];
  saved: SavedMark | null;
  deliveredByName: string | null;
  deliveredAt: Date | null;
  /** null = a pessoa não pode editar (a página mostra o resumo). */
  mode: FormMode | null;
};

type ShiftRow = { id: string; name: string; active: boolean };

const ITEM_ORDER = [
  asc(item.sortOrder),
  asc(item.createdAt),
  asc(item.id),
] as const;

// Rascunho ou ainda sem linha: os itens ATIVOS do setor, com o valor salvo (se
// houver) ou 0 / "". Item desativado depois de salvo some do formulário.
async function liveLines(
  db: Db,
  sectorId: string,
  handoverId: string | null,
): Promise<ItemLine[]> {
  const rows = await db
    .select({
      itemId: item.id,
      name: item.name,
      unit: item.unit,
      kind: item.kind,
      quantity: sql<number>`coalesce(${handoverItem.quantity}, 0)`,
      note: handoverItem.note,
    })
    .from(item)
    .leftJoin(
      handoverItem,
      and(
        eq(handoverItem.itemId, item.id),
        // Sem rascunho nenhum id casa: o LEFT JOIN devolve só os itens.
        eq(
          handoverItem.handoverId,
          handoverId ?? "00000000-0000-0000-0000-000000000000",
        ),
      ),
    )
    .where(and(eq(item.sectorId, sectorId), eq(item.active, true)))
    .orderBy(...ITEM_ORDER)
    .limit(CHOICE_LIST_LIMIT);
  return rows.map((row) => ({ ...row, note: row.note ?? "" }));
}

// Entregue ou confirmada: as LINHAS da passagem, com o snapshot da entrega
// (o cadastro vivo só entra se o snapshot faltar).
async function snapshotLines(db: Db, handoverId: string): Promise<ItemLine[]> {
  const rows = await db
    .select({
      itemId: handoverItem.itemId,
      name: sql<string>`coalesce(${handoverItem.itemNameSnapshot}, ${item.name})`,
      unit: sql<string>`coalesce(${handoverItem.itemUnitSnapshot}, ${item.unit})`,
      kind: sql<ItemKind>`coalesce(${handoverItem.itemKindSnapshot}, ${item.kind})`,
      quantity: handoverItem.quantity,
      note: handoverItem.note,
    })
    .from(handoverItem)
    .innerJoin(item, eq(item.id, handoverItem.itemId))
    .where(eq(handoverItem.handoverId, handoverId))
    .orderBy(...ITEM_ORDER)
    .limit(CHOICE_LIST_LIMIT);
  return rows.map((row) => ({ ...row, note: row.note ?? "" }));
}

// Corpo comum de getHandoverFormState e getHandoverFormStateById. Só lê.
async function buildState(
  db: Db,
  actor: Authz,
  owner: SectorRow,
  target: ShiftRow,
  ref: HandoverRef,
  row: HandoverRow | null,
): Promise<HandoverFormState> {
  const lines =
    row !== null && row.status !== "draft"
      ? await snapshotLines(db, row.id)
      : await liveLines(db, owner.id, row?.id ?? null);

  const capabilities = handoverCapabilities(actor, {
    status: row?.status ?? "draft",
    sectorId: owner.id,
    deliveredBy: row?.deliveredBy ?? null,
  });

  const nameIds = [row?.updatedBy, row?.deliveredBy].filter(
    (id): id is string => typeof id === "string",
  );
  const names = await userNames(db, nameIds);
  const savedByName = row?.updatedBy ? names.get(row.updatedBy) : undefined;

  return {
    ref,
    handoverId: row?.id ?? null,
    status: row?.status ?? null,
    sectorName: owner.name,
    shiftName: row?.shiftNameSnapshot ?? target.name,
    occurrencesText: row?.occurrencesText ?? "",
    nextShiftText: row?.nextShiftText ?? "",
    controls: lines.filter((line) => line.kind === "control"),
    stock: lines.filter((line) => line.kind === "stock"),
    saved:
      row?.updatedBy && savedByName !== undefined
        ? { at: row.updatedAt, byName: savedByName, byId: row.updatedBy }
        : null,
    deliveredByName: row?.deliveredBy
      ? (names.get(row.deliveredBy) ?? null)
      : null,
    deliveredAt: row?.deliveredAt ?? null,
    mode: formModeOf(row?.status ?? null, capabilities),
  };
}

async function loadShift(
  db: Db,
  sectorId: string,
  shiftId: string,
): Promise<ShiftRow | null> {
  const [row] = await db
    .select({ id: shift.id, name: shift.name, active: shift.active })
    .from(shift)
    .where(and(eq(shift.id, shiftId), eq(shift.sectorId, sectorId)));
  return row ?? null;
}

/**
 * Estado do formulário de uma combinação setor + turno + dia. NUNCA escreve
 * (F3-2): sem linha, devolve os valores padrão (`0`, `""`) e `mode: "draft"`;
 * o rascunho só nasce no primeiro salvamento. Sem linha, a combinação precisa
 * poder ser criada (turno ativo, data na janela): senão `SHIFT_INACTIVE` /
 * `DATE_OUT_OF_RANGE`, os mesmos códigos que o salvamento devolveria.
 */
export async function getHandoverFormState(
  db: Db,
  actor: Authz,
  ref: HandoverRef,
  now: Date,
): Promise<AdminResult<{ state: HandoverFormState }>> {
  const owner = await loadSector(db, actor, ref.sectorId);
  if (!owner) return fail("NOT_FOUND", notFoundMessage("setor"));
  if (!owner.active) {
    return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_HANDOVER_MESSAGE);
  }
  if (!isIsoDate(ref.operationalDate)) {
    return fail("DATE_OUT_OF_RANGE", DATE_OUT_OF_RANGE_MESSAGE);
  }
  const target = await loadShift(db, owner.id, ref.shiftId);
  if (!target) return fail("NOT_FOUND", notFoundMessage("turno"));

  const row = await findHandoverByRef(db, ref);
  if (row === null) {
    const refusal = creationRefusal(target, ref, now);
    if (refusal) return refusal;
  }
  return ok({ state: await buildState(db, actor, owner, target, ref, row) });
}

/** Mesmo corpo, a partir do id da passagem (`/passagens/[id]?editar=1`). */
export async function getHandoverFormStateById(
  db: Db,
  actor: Authz,
  id: string,
): Promise<AdminResult<{ state: HandoverFormState }>> {
  const row = await findHandoverById(db, actor, id);
  if (!row) return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);
  const owner = await loadSector(db, actor, row.sectorId);
  if (!owner) return fail("NOT_FOUND", notFoundMessage("setor"));
  if (!owner.active) {
    return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_HANDOVER_MESSAGE);
  }
  const target = await loadShift(db, owner.id, row.shiftId);
  if (!target) return fail("NOT_FOUND", notFoundMessage("turno"));

  const ref: HandoverRef = {
    sectorId: row.sectorId,
    shiftId: row.shiftId,
    operationalDate: row.operationalDate,
  };
  return ok({ state: await buildState(db, actor, owner, target, ref, row) });
}
