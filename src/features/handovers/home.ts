import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { user } from "@/db/schema/auth";
import { shift } from "@/db/schema/catalog";
import { handover } from "@/db/schema/handovers";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import { notFoundMessage } from "@/features/admin/messages";
import { type AdminResult, fail, ok } from "@/features/admin/result";
import type { Authz } from "@/features/authz/authz";
import type { SectorColor } from "@/features/sectors/colors";

import { codePointLength } from "./fieldRules";
import { NEXT_SHIFT_PREVIEW_LENGTH } from "./limits";
import { findHandoverByRef, loadSector, userNames } from "./loaders";
import { SECTOR_INACTIVE_HANDOVER_MESSAGE } from "./messages";
import { type ShiftProgress, shiftProgress } from "./shiftProgress";
import { suggestShift } from "./shiftSuggestion";
import { listActiveShifts } from "./targets";
import type { HandoverRef, SavedMark, ShiftChoice } from "./types";

export type PendingHandover = {
  id: string;
  sectorName: string;
  shiftName: string;
  operationalDate: string;
  deliveredById: string;
  deliveredByName: string;
  deliveredAt: Date;
  nextShiftPreview: string | null;
};

export type MyShiftState =
  | { kind: "no-shifts" }
  | {
      kind: "start" | "continue";
      ref: HandoverRef;
      shift: ShiftChoice;
      progress: ShiftProgress;
      saved: SavedMark | null;
    }
  | {
      kind: "delivered" | "confirmed";
      handoverId: string;
      ref: HandoverRef;
      shift: ShiftChoice;
      // Ids para o avatar da linha de entrega (semente estável, spec §6.4.1).
      deliveredById: string;
      deliveredByName: string;
      deliveredAt: Date;
      confirmedById: string | null;
      confirmedByName: string | null;
      confirmedAt: Date | null;
    };

export type HomeHandovers = {
  sector: { id: string; name: string; color: SectorColor };
  pending: PendingHandover | null;
  mine: MyShiftState;
};

function previewOf(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (codePointLength(trimmed) <= NEXT_SHIFT_PREVIEW_LENGTH) return trimmed;
  return `${[...trimmed].slice(0, NEXT_SHIFT_PREVIEW_LENGTH).join("")}…`;
}

// A mais recente do setor entre as entregues e as confirmadas. O cartão só
// existe se ela ainda está entregue e não é de quem olha: uma confirmada mais
// nova esconde as entregues antigas (viram "não confirmada" no histórico), e
// ela some para quem a entregou sem cair para outra (F3-6); sem teto de idade
// (P35).
async function loadPending(
  db: Db,
  actor: Authz,
  sectorId: string,
): Promise<PendingHandover | null> {
  const [row] = await db
    .select({
      id: handover.id,
      status: handover.status,
      sectorName: sector.name,
      shiftName: shift.name,
      shiftNameSnapshot: handover.shiftNameSnapshot,
      operationalDate: handover.operationalDate,
      deliveredBy: handover.deliveredBy,
      deliveredByName: user.name,
      deliveredAt: handover.deliveredAt,
      nextShiftText: handover.nextShiftText,
    })
    .from(handover)
    .innerJoin(sector, eq(sector.id, handover.sectorId))
    .innerJoin(shift, eq(shift.id, handover.shiftId))
    .innerJoin(user, eq(user.id, handover.deliveredBy))
    .where(
      and(
        eq(handover.sectorId, sectorId),
        inArray(handover.status, ["delivered", "confirmed"]),
      ),
    )
    .orderBy(desc(handover.deliveredAt), desc(handover.id))
    .limit(1);
  if (
    !row ||
    row.status !== "delivered" ||
    row.deliveredAt === null ||
    row.deliveredBy === null ||
    row.deliveredBy === actor.userId
  ) {
    return null;
  }
  return {
    id: row.id,
    sectorName: row.sectorName,
    shiftName: row.shiftNameSnapshot ?? row.shiftName,
    operationalDate: row.operationalDate,
    deliveredById: row.deliveredBy,
    deliveredByName: row.deliveredByName,
    deliveredAt: row.deliveredAt,
    nextShiftPreview: previewOf(row.nextShiftText),
  };
}

async function loadMine(
  db: Db,
  sectorId: string,
  now: Date,
): Promise<MyShiftState> {
  const shifts = await listActiveShifts(db, sectorId);
  const target = suggestShift(shifts, now);
  const chosen = shifts.find((candidate) => candidate.id === target?.shiftId);
  if (target === null || chosen === undefined) return { kind: "no-shifts" };

  const ref: HandoverRef = {
    sectorId,
    shiftId: target.shiftId,
    operationalDate: target.operationalDate,
  };
  const progress = shiftProgress(chosen, now);
  const row = await findHandoverByRef(db, ref);
  if (!row) {
    return { kind: "start", ref, shift: chosen, progress, saved: null };
  }

  const people = await userNames(
    db,
    [row.deliveredBy, row.confirmedBy, row.updatedBy].filter(
      (id): id is string => id !== null,
    ),
  );
  if (row.status === "draft") {
    const byName =
      row.updatedBy === null ? undefined : people.get(row.updatedBy);
    return {
      kind: "continue",
      ref,
      shift: chosen,
      progress,
      saved:
        byName === undefined || row.updatedBy === null
          ? null
          : { at: row.updatedAt, byName, byId: row.updatedBy },
    };
  }
  return {
    kind: row.status,
    handoverId: row.id,
    ref,
    shift: chosen,
    // O check handover_status_consistent garante quem entregou (e quem
    // confirmou, na confirmada). O "" é o mesmo fallback do nome, para uma
    // linha fora do check; o HomeCards não gera avatar com id vazio.
    deliveredById: row.deliveredBy ?? "",
    deliveredByName:
      (row.deliveredBy === null ? undefined : people.get(row.deliveredBy)) ??
      "",
    deliveredAt: row.deliveredAt ?? row.updatedAt,
    confirmedById: row.confirmedBy,
    confirmedByName:
      row.confirmedBy === null ? null : (people.get(row.confirmedBy) ?? null),
    confirmedAt: row.confirmedAt,
  };
}

export async function getHomeHandovers(
  db: Db,
  actor: Authz,
  sectorId: string,
  now: Date,
): Promise<AdminResult<{ home: HomeHandovers }>> {
  const found = await loadSector(db, actor, sectorId);
  if (!found) return fail("NOT_FOUND", notFoundMessage("setor"));
  if (!found.active) {
    return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_HANDOVER_MESSAGE);
  }
  const [pending, mine] = await Promise.all([
    loadPending(db, actor, sectorId),
    loadMine(db, sectorId, now),
  ]);
  return ok({
    home: {
      sector: { id: found.id, name: found.name, color: found.color },
      pending,
      mine,
    },
  });
}
