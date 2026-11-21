import "server-only";

import { asc, count, desc, eq, sql } from "drizzle-orm";

import { destination } from "@/db/schema/catalog";
import type { Db } from "@/db/types";
import { isUniqueViolation } from "./dbErrors";
import { nameTakenMessage, notFoundMessage } from "./messages";
import { validateName } from "./names";
import { PAGE_SIZE, type Page, resolvePage } from "./pagination";
import { type AdminResult, fail, ok } from "./result";

export type DestinationRow = { id: string; name: string; active: boolean };

export async function listDestinations(
  db: Db,
  input: { page: number },
): Promise<Page<DestinationRow>> {
  const [totals] = await db.select({ total: count() }).from(destination);
  const total = totals?.total ?? 0;
  const { page, pageCount, offset } = resolvePage(total, input.page);

  const rows = await db
    .select({
      id: destination.id,
      name: destination.name,
      active: destination.active,
    })
    .from(destination)
    .orderBy(
      desc(destination.active),
      sql`lower(${destination.name})`,
      asc(destination.id),
    )
    .limit(PAGE_SIZE)
    .offset(offset);

  return { rows, total, page, pageCount, pageSize: PAGE_SIZE };
}

async function nameTakenFailure(db: Db, name: string) {
  const [existing] = await db
    .select({ active: destination.active })
    .from(destination)
    .where(sql`lower(${destination.name}) = lower(${name})`)
    .limit(1);
  const message = nameTakenMessage("destino", existing?.active === false);
  return fail("NAME_TAKEN", message, { name: message });
}

export async function createDestination(
  db: Db,
  input: { name: string },
): Promise<AdminResult<{ id: string }>> {
  const checked = validateName(input.name);
  if (!checked.ok) {
    return fail("INVALID_INPUT", checked.message, { name: checked.message });
  }
  try {
    const [created] = await db
      .insert(destination)
      .values({ name: checked.name })
      .returning({ id: destination.id });
    if (!created) throw new Error("destino não criado");
    return ok({ id: created.id });
  } catch (error) {
    if (isUniqueViolation(error)) return nameTakenFailure(db, checked.name);
    throw error;
  }
}

export async function renameDestination(
  db: Db,
  input: { id: string; name: string },
): Promise<AdminResult> {
  const checked = validateName(input.name);
  if (!checked.ok) {
    return fail("INVALID_INPUT", checked.message, { name: checked.message });
  }
  try {
    const updated = await db
      .update(destination)
      .set({ name: checked.name })
      .where(eq(destination.id, input.id))
      .returning({ id: destination.id });
    if (updated.length === 0) {
      return fail("NOT_FOUND", notFoundMessage("destino"));
    }
    return ok();
  } catch (error) {
    if (isUniqueViolation(error)) return nameTakenFailure(db, checked.name);
    throw error;
  }
}

// Idempotente: já estar no estado pedido é sucesso (clique duplo, duas abas).
export async function setDestinationActive(
  db: Db,
  input: { id: string; active: boolean },
): Promise<AdminResult> {
  const updated = await db
    .update(destination)
    .set({ active: input.active })
    .where(eq(destination.id, input.id))
    .returning({ id: destination.id });
  if (updated.length === 0) {
    return fail("NOT_FOUND", notFoundMessage("destino"));
  }
  return ok();
}
