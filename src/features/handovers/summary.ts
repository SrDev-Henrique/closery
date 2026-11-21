import "server-only";

import { and, asc, eq, gt, inArray, or, sql } from "drizzle-orm";

import { user } from "@/db/schema/auth";
import { item, shift } from "@/db/schema/catalog";
import {
  type CorrectionField,
  type HandoverStatus,
  handover,
  handoverCorrection,
  handoverItem,
} from "@/db/schema/handovers";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import { type AdminResult, fail, ok } from "@/features/admin/result";
import type { Authz } from "@/features/authz/authz";
import type { ItemKind } from "@/lib/itemKinds";

import { type HandoverCapabilities, handoverCapabilities } from "./access";
import { findHandoverById, type HandoverRow, userNames } from "./loaders";
import { HANDOVER_NOT_FOUND_MESSAGE } from "./messages";
import type { HandoverRef } from "./types";

export type SummaryItem = {
  itemId: string;
  name: string;
  unit: string;
  kind: ItemKind;
  quantity: number;
  note: string | null;
};
export type SummaryCorrection = {
  id: string;
  field: CorrectionField;
  itemName: string | null;
  oldValue: string;
  newValue: string;
  reason: string;
  correctedByName: string;
  correctedAt: Date;
};
export type HandoverSummary = {
  id: string;
  ref: HandoverRef;
  status: HandoverStatus;
  situation: "awaiting" | "confirmed" | "unconfirmed" | null;
  corrected: boolean;
  sectorName: string;
  shiftName: string;
  nextShiftText: string;
  occurrencesText: string;
  highlighted: { controls: SummaryItem[]; stock: SummaryItem[] };
  zeroed: { count: number; names: string[] };
  deliveredByName: string | null;
  deliveredAt: Date | null;
  confirmedByName: string | null;
  confirmedAt: Date | null;
  confirmationNote: string | null;
  corrections: SummaryCorrection[];
  capabilities: HandoverCapabilities;
};

// "awaiting" é a entregue mais recente do setor entre as entregues e as
// confirmadas (a do cartão do Início); uma entregue com outra entregue ou
// confirmada mais nova no mesmo setor é "unconfirmed".
async function situationOf(
  db: Db,
  row: HandoverRow,
): Promise<HandoverSummary["situation"]> {
  if (row.status === "draft") return null;
  if (row.status === "confirmed") return "confirmed";
  if (row.deliveredAt === null) return "awaiting";
  const [newer] = await db
    .select({ id: handover.id })
    .from(handover)
    .where(
      and(
        eq(handover.sectorId, row.sectorId),
        inArray(handover.status, ["delivered", "confirmed"]),
        or(
          gt(handover.deliveredAt, row.deliveredAt),
          and(
            eq(handover.deliveredAt, row.deliveredAt),
            gt(handover.id, row.id),
          ),
        ),
      ),
    )
    .limit(1);
  return newer ? "unconfirmed" : "awaiting";
}

async function loadLines(db: Db, handoverId: string): Promise<SummaryItem[]> {
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
    .orderBy(asc(item.sortOrder), asc(item.id));
  return rows.map((row) => ({
    ...row,
    note: row.note === null || row.note === "" ? null : row.note,
  }));
}

async function loadCorrections(
  db: Db,
  handoverId: string,
): Promise<SummaryCorrection[]> {
  return db
    .select({
      id: handoverCorrection.id,
      field: handoverCorrection.field,
      itemName: sql<
        string | null
      >`coalesce(${handoverItem.itemNameSnapshot}, ${item.name})`,
      oldValue: handoverCorrection.oldValue,
      newValue: handoverCorrection.newValue,
      reason: handoverCorrection.reason,
      correctedByName: user.name,
      correctedAt: handoverCorrection.correctedAt,
    })
    .from(handoverCorrection)
    .innerJoin(user, eq(user.id, handoverCorrection.correctedBy))
    .leftJoin(item, eq(item.id, handoverCorrection.itemId))
    .leftJoin(
      handoverItem,
      and(
        eq(handoverItem.handoverId, handoverCorrection.handoverId),
        eq(handoverItem.itemId, handoverCorrection.itemId),
      ),
    )
    .where(eq(handoverCorrection.handoverId, handoverId))
    .orderBy(asc(handoverCorrection.correctedAt), asc(handoverCorrection.id));
}

export async function getHandoverSummary(
  db: Db,
  actor: Authz,
  id: string,
): Promise<AdminResult<{ summary: HandoverSummary }>> {
  const row = await findHandoverById(db, actor, id);
  if (!row) return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);

  const [names] = await db
    .select({ sectorName: sector.name, shiftName: shift.name })
    .from(sector)
    .innerJoin(shift, eq(shift.id, row.shiftId))
    .where(eq(sector.id, row.sectorId));
  if (!names) return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);

  const [lines, corrections, situation, people] = await Promise.all([
    loadLines(db, row.id),
    loadCorrections(db, row.id),
    situationOf(db, row),
    userNames(
      db,
      [row.deliveredBy, row.confirmedBy].filter(
        (value): value is string => value !== null,
      ),
    ),
  ]);

  const shown = (line: SummaryItem) =>
    line.quantity !== 0 || line.note !== null;
  const highlighted = lines.filter(shown);
  const zeroed = lines.filter((line) => !shown(line));

  return ok({
    summary: {
      id: row.id,
      ref: {
        sectorId: row.sectorId,
        shiftId: row.shiftId,
        operationalDate: row.operationalDate,
      },
      status: row.status,
      situation,
      corrected: corrections.length > 0,
      sectorName: names.sectorName,
      shiftName: row.shiftNameSnapshot ?? names.shiftName,
      nextShiftText: row.nextShiftText,
      occurrencesText: row.occurrencesText,
      highlighted: {
        controls: highlighted.filter((line) => line.kind === "control"),
        stock: highlighted.filter((line) => line.kind === "stock"),
      },
      zeroed: { count: zeroed.length, names: zeroed.map((line) => line.name) },
      deliveredByName:
        row.deliveredBy === null ? null : (people.get(row.deliveredBy) ?? null),
      deliveredAt: row.deliveredAt,
      confirmedByName:
        row.confirmedBy === null ? null : (people.get(row.confirmedBy) ?? null),
      confirmedAt: row.confirmedAt,
      confirmationNote: row.confirmationNote,
      corrections,
      capabilities: handoverCapabilities(actor, row),
    },
  });
}
