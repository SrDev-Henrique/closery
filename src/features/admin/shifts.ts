import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { shift } from "@/db/schema/catalog";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";

import { isUniqueViolation } from "./dbErrors";
import { nameTakenMessage, notFoundMessage } from "./messages";
import { validateName } from "./names";
import {
  CHOICE_LIST_LIMIT,
  PAGE_SIZE,
  type Page,
  resolvePage,
} from "./pagination";
import { moveId, planSortUpdates, type SortDirection } from "./reorder";
import {
  type AdminFailure,
  type AdminResult,
  type FieldErrors,
  fail,
  INVALID_INPUT_MESSAGE,
  ok,
} from "./result";
import {
  crossesMidnight,
  findOverlaps,
  type NamedShiftRange,
  type OverlapWarning,
  suggestShiftName,
  suggestShiftTimes,
} from "./shiftRules";
import {
  fromDbTime,
  parseTimeOfDay,
  TIME_INPUT_PATTERN,
  toDbTime,
} from "./timeOfDay";

export type ShiftRow = {
  id: string;
  sectorId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  crossesMidnight: boolean;
  sortOrder: number;
  active: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  overlaps: OverlapWarning[];
};

export type ShiftFormDefaults = {
  name: string;
  startsAt: string;
  endsAt: string;
};

const SECTOR_INACTIVE_FOR_SHIFTS =
  "Este setor está inativo. Reative-o para cadastrar turnos.";
const TIME_MESSAGE = "Informe um horário válido, como 06:00.";
const SAME_TIME_MESSAGE = "O início e o fim não podem ser iguais.";

const READ_ORDER = [asc(shift.sortOrder), asc(shift.createdAt), asc(shift.id)];

// Turnos ativos do setor, na ordem da lista, já com horário "HH:mm".
async function activeRanges(
  db: Db,
  sectorId: string,
): Promise<NamedShiftRange[]> {
  const rows = await db
    .select({
      id: shift.id,
      name: shift.name,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
    })
    .from(shift)
    .where(and(eq(shift.sectorId, sectorId), eq(shift.active, true)))
    .orderBy(...READ_ORDER)
    .limit(CHOICE_LIST_LIMIT);
  return rows.map((row) => ({
    ...row,
    startsAt: fromDbTime(row.startsAt),
    endsAt: fromDbTime(row.endsAt),
  }));
}

export async function listShifts(
  db: Db,
  input: { sectorId: string; page: number },
): Promise<Page<ShiftRow>> {
  const inSector = eq(shift.sectorId, input.sectorId);
  const [counted] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(shift)
    .where(inSector);
  const total = counted?.total ?? 0;
  const { page, pageCount, offset } = resolvePage(total, input.page);

  const [rows, ranges, firstRow, lastRow] = await Promise.all([
    db
      .select()
      .from(shift)
      .where(inSector)
      .orderBy(...READ_ORDER)
      .limit(PAGE_SIZE)
      .offset(offset),
    activeRanges(db, input.sectorId),
    db
      .select({ id: shift.id })
      .from(shift)
      .where(inSector)
      .orderBy(...READ_ORDER)
      .limit(1),
    db
      .select({ id: shift.id })
      .from(shift)
      .where(inSector)
      .orderBy(desc(shift.sortOrder), desc(shift.createdAt), desc(shift.id))
      .limit(1),
  ]);
  const firstId = firstRow[0]?.id;
  const lastId = lastRow[0]?.id;

  return {
    rows: rows.map((row) => {
      const range = {
        startsAt: fromDbTime(row.startsAt),
        endsAt: fromDbTime(row.endsAt),
      };
      return {
        id: row.id,
        sectorId: row.sectorId,
        name: row.name,
        ...range,
        crossesMidnight: crossesMidnight(range),
        sortOrder: row.sortOrder,
        active: row.active,
        canMoveUp: row.id !== firstId,
        canMoveDown: row.id !== lastId,
        overlaps: row.active
          ? findOverlaps({ id: row.id, ...range }, ranges)
          : [],
      };
    }),
    total,
    page,
    pageCount,
    pageSize: PAGE_SIZE,
  };
}

export async function getShiftFormDefaults(
  db: Db,
  sectorId: string,
): Promise<ShiftFormDefaults> {
  const [ranges, names] = await Promise.all([
    activeRanges(db, sectorId),
    db
      .select({ name: shift.name })
      .from(shift)
      .where(eq(shift.sectorId, sectorId))
      .limit(CHOICE_LIST_LIMIT),
  ]);
  const times = suggestShiftTimes(ranges);
  return {
    name: suggestShiftName(names.map((row) => row.name)),
    ...times,
  };
}

type ShiftFields = { name: string; startsAt: string; endsAt: string };

function minutesOrNull(value: string): number | null {
  return TIME_INPUT_PATTERN.test(value) ? parseTimeOfDay(value) : null;
}

// O domínio revalida o que a tela já validou: nunca confia no cliente.
function validateFields(
  input: ShiftFields,
):
  | { ok: true; name: string }
  | { ok: false; message: string; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};
  const name = validateName(input.name);
  if (!name.ok) fieldErrors.name = name.message;
  const start = minutesOrNull(input.startsAt);
  const end = minutesOrNull(input.endsAt);
  if (start === null) fieldErrors.startsAt = TIME_MESSAGE;
  if (end === null) fieldErrors.endsAt = TIME_MESSAGE;
  else if (start === end) fieldErrors.endsAt = SAME_TIME_MESSAGE;
  if (name.ok && Object.keys(fieldErrors).length === 0) {
    return { ok: true, name: name.name };
  }
  return {
    ok: false,
    message: Object.values(fieldErrors)[0] ?? INVALID_INPUT_MESSAGE,
    fieldErrors,
  };
}

async function nameTakenFailure(
  db: Db,
  sectorId: string,
  name: string,
): Promise<AdminFailure> {
  const [existing] = await db
    .select({ active: shift.active })
    .from(shift)
    .where(
      and(
        eq(shift.sectorId, sectorId),
        sql`lower(${shift.name}) = lower(${name})`,
      ),
    )
    .limit(1);
  const message = nameTakenMessage("turno", existing?.active === false);
  return fail("NAME_TAKEN", message, { name: message });
}

export async function createShift(
  db: Db,
  input: { sectorId: string; name: string; startsAt: string; endsAt: string },
): Promise<AdminResult<{ id: string; warnings: OverlapWarning[] }>> {
  const checked = validateFields(input);
  if (!checked.ok) {
    return fail("INVALID_INPUT", checked.message, checked.fieldErrors);
  }
  try {
    // Leitura do setor e INSERT na mesma transação: o FOR SHARE segura o setor
    // até o INSERT e serializa com o FOR UPDATE de setSectorActive (F2-23).
    return await db.transaction(async (tx) => {
      const [owner] = await tx
        .select({ active: sector.active })
        .from(sector)
        .where(eq(sector.id, input.sectorId))
        .for("share");
      if (!owner) return fail("NOT_FOUND", notFoundMessage("setor"));
      if (!owner.active) {
        return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_FOR_SHIFTS);
      }
      const [created] = await tx
        .insert(shift)
        .values({
          sectorId: input.sectorId,
          name: checked.name,
          startsAt: toDbTime(input.startsAt),
          endsAt: toDbTime(input.endsAt),
          sortOrder: sql`(select coalesce(max(${shift.sortOrder}), 0) + 1 from ${shift} where ${shift.sectorId} = ${input.sectorId})`,
        })
        .returning({ id: shift.id });
      if (!created) throw new Error("Falha ao criar o turno.");
      const warnings = findOverlaps(
        { id: created.id, startsAt: input.startsAt, endsAt: input.endsAt },
        await activeRanges(tx, input.sectorId),
      );
      return ok({ id: created.id, warnings });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return nameTakenFailure(db, input.sectorId, checked.name);
    }
    throw error;
  }
}

export async function updateShift(
  db: Db,
  input: { id: string; name: string; startsAt: string; endsAt: string },
): Promise<AdminResult<{ warnings: OverlapWarning[] }>> {
  const checked = validateFields(input);
  if (!checked.ok) {
    return fail("INVALID_INPUT", checked.message, checked.fieldErrors);
  }
  const [current] = await db
    .select({ sectorId: shift.sectorId, active: shift.active })
    .from(shift)
    .where(eq(shift.id, input.id));
  if (!current) return fail("NOT_FOUND", notFoundMessage("turno"));

  try {
    await db
      .update(shift)
      .set({
        name: checked.name,
        startsAt: toDbTime(input.startsAt),
        endsAt: toDbTime(input.endsAt),
      })
      .where(eq(shift.id, input.id));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return nameTakenFailure(db, current.sectorId, checked.name);
    }
    throw error;
  }
  if (!current.active) return ok({ warnings: [] });
  const warnings = findOverlaps(
    { id: input.id, startsAt: input.startsAt, endsAt: input.endsAt },
    await activeRanges(db, current.sectorId),
  );
  return ok({ warnings });
}

export async function setShiftActive(
  db: Db,
  input: { id: string; active: boolean },
): Promise<AdminResult<{ warnings: OverlapWarning[] }>> {
  const [updated] = await db
    .update(shift)
    .set({ active: input.active })
    .where(eq(shift.id, input.id))
    .returning({
      sectorId: shift.sectorId,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
    });
  if (!updated) return fail("NOT_FOUND", notFoundMessage("turno"));
  if (!input.active) return ok({ warnings: [] });
  const warnings = findOverlaps(
    {
      id: input.id,
      startsAt: fromDbTime(updated.startsAt),
      endsAt: fromDbTime(updated.endsAt),
    },
    await activeRanges(db, updated.sectorId),
  );
  return ok({ warnings });
}

export async function moveShift(
  db: Db,
  input: { id: string; direction: SortDirection },
): Promise<AdminResult> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ sectorId: shift.sectorId })
      .from(shift)
      .where(eq(shift.id, input.id));
    if (!target) return fail("NOT_FOUND", notFoundMessage("turno"));

    // FOR UPDATE serializa dois cliques seguidos (ou duas abas) no mesmo setor.
    const rows = await tx
      .select({ id: shift.id, sortOrder: shift.sortOrder })
      .from(shift)
      .where(eq(shift.sectorId, target.sectorId))
      .orderBy(...READ_ORDER)
      .for("update");
    const next = moveId(
      rows.map((row) => row.id),
      input.id,
      input.direction,
    );
    if (next === null) return ok();

    for (const update of planSortUpdates(rows, next)) {
      await tx
        .update(shift)
        .set({ sortOrder: update.sortOrder })
        .where(eq(shift.id, update.id));
    }
    return ok();
  });
}
