import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { type ItemKind, item } from "@/db/schema/catalog";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";

import { isUniqueViolation } from "./dbErrors";
import { UNIT_MAX_LENGTH } from "./itemOptions";
import { nameTakenMessage, notFoundMessage } from "./messages";
import { normalizeName, validateName } from "./names";
import { PAGE_SIZE, type Page, resolvePage } from "./pagination";
import { moveId, planSortUpdates, type SortDirection } from "./reorder";
import {
  type AdminFailure,
  type AdminResult,
  type FieldErrors,
  fail,
  INVALID_INPUT_MESSAGE,
  ok,
} from "./result";

export type ItemRow = {
  id: string;
  sectorId: string;
  name: string;
  unit: string;
  kind: ItemKind;
  sortOrder: number;
  active: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

const SECTOR_INACTIVE_FOR_ITEMS =
  "Este setor está inativo. Reative-o para cadastrar itens.";

const READ_ORDER = [asc(item.sortOrder), asc(item.createdAt), asc(item.id)];

export async function listItems(
  db: Db,
  input: { sectorId: string; page: number },
): Promise<Page<ItemRow>> {
  const inSector = eq(item.sectorId, input.sectorId);
  const [counted] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(item)
    .where(inSector);
  const total = counted?.total ?? 0;
  const { page, pageCount, offset } = resolvePage(total, input.page);

  const [rows, firstRow, lastRow] = await Promise.all([
    db
      .select()
      .from(item)
      .where(inSector)
      .orderBy(...READ_ORDER)
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ id: item.id })
      .from(item)
      .where(inSector)
      .orderBy(...READ_ORDER)
      .limit(1),
    db
      .select({ id: item.id })
      .from(item)
      .where(inSector)
      .orderBy(desc(item.sortOrder), desc(item.createdAt), desc(item.id))
      .limit(1),
  ]);
  const firstId = firstRow[0]?.id;
  const lastId = lastRow[0]?.id;

  return {
    rows: rows.map((row) => ({
      id: row.id,
      sectorId: row.sectorId,
      name: row.name,
      unit: row.unit,
      kind: row.kind,
      sortOrder: row.sortOrder,
      active: row.active,
      canMoveUp: row.id !== firstId,
      canMoveDown: row.id !== lastId,
    })),
    total,
    page,
    pageCount,
    pageSize: PAGE_SIZE,
  };
}

type ItemFields = { name: string; unit: string };

// O domínio revalida o que a action já resolveu: nunca confia na tela.
function validateFields(
  input: ItemFields,
):
  | { ok: true; name: string; unit: string }
  | { ok: false; message: string; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};
  const name = validateName(input.name);
  if (!name.ok) fieldErrors.name = name.message;
  const unit = normalizeName(input.unit);
  if (unit === "") {
    fieldErrors.unitOther = "Informe a unidade.";
  } else if ([...unit].length > UNIT_MAX_LENGTH) {
    fieldErrors.unitOther = `A unidade pode ter no máximo ${UNIT_MAX_LENGTH} caracteres.`;
  }
  if (name.ok && Object.keys(fieldErrors).length === 0) {
    return { ok: true, name: name.name, unit };
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
    .select({ active: item.active })
    .from(item)
    .where(
      and(
        eq(item.sectorId, sectorId),
        sql`lower(${item.name}) = lower(${name})`,
      ),
    )
    .limit(1);
  const message = nameTakenMessage("item", existing?.active === false);
  return fail("NAME_TAKEN", message, { name: message });
}

export async function createItem(
  db: Db,
  input: { sectorId: string; name: string; unit: string; kind: ItemKind },
): Promise<AdminResult<{ id: string }>> {
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
        return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_FOR_ITEMS);
      }
      const [created] = await tx
        .insert(item)
        .values({
          sectorId: input.sectorId,
          name: checked.name,
          unit: checked.unit,
          kind: input.kind,
          sortOrder: sql`(select coalesce(max(${item.sortOrder}), 0) + 1 from ${item} where ${item.sectorId} = ${input.sectorId})`,
        })
        .returning({ id: item.id });
      if (!created) throw new Error("Falha ao criar o item.");
      return ok({ id: created.id });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return nameTakenFailure(db, input.sectorId, checked.name);
    }
    throw error;
  }
}

export async function updateItem(
  db: Db,
  input: { id: string; name: string; unit: string; kind: ItemKind },
): Promise<AdminResult> {
  const checked = validateFields(input);
  if (!checked.ok) {
    return fail("INVALID_INPUT", checked.message, checked.fieldErrors);
  }
  const [current] = await db
    .select({ sectorId: item.sectorId })
    .from(item)
    .where(eq(item.id, input.id));
  if (!current) return fail("NOT_FOUND", notFoundMessage("item"));

  try {
    await db
      .update(item)
      .set({ name: checked.name, unit: checked.unit, kind: input.kind })
      .where(eq(item.id, input.id));
    return ok();
  } catch (error) {
    if (isUniqueViolation(error)) {
      return nameTakenFailure(db, current.sectorId, checked.name);
    }
    throw error;
  }
}

export async function setItemActive(
  db: Db,
  input: { id: string; active: boolean },
): Promise<AdminResult> {
  const [updated] = await db
    .update(item)
    .set({ active: input.active })
    .where(eq(item.id, input.id))
    .returning({ id: item.id });
  if (!updated) return fail("NOT_FOUND", notFoundMessage("item"));
  return ok();
}

export async function moveItem(
  db: Db,
  input: { id: string; direction: SortDirection },
): Promise<AdminResult> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ sectorId: item.sectorId })
      .from(item)
      .where(eq(item.id, input.id));
    if (!target) return fail("NOT_FOUND", notFoundMessage("item"));

    // FOR UPDATE serializa dois cliques seguidos (ou duas abas) no mesmo setor.
    const rows = await tx
      .select({ id: item.id, sortOrder: item.sortOrder })
      .from(item)
      .where(eq(item.sectorId, target.sectorId))
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
        .update(item)
        .set({ sortOrder: update.sortOrder })
        .where(eq(item.id, update.id));
    }
    return ok();
  });
}
