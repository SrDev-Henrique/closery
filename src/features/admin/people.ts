import "server-only";

import { and, asc, count, eq, isNull, sql } from "drizzle-orm";

import { session, user } from "@/db/schema/auth";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import type { Role } from "@/lib/roles";
import {
  LAST_ADMIN_MESSAGE,
  notFoundMessage,
  PERSON_SECTOR_INACTIVE_MESSAGE,
  SECTOR_INACTIVE_MESSAGE,
  SECTOR_REQUIRED_MESSAGE,
  SELF_DEACTIVATE_MESSAGE,
  SELF_ROLE_MESSAGE,
} from "./messages";
import { PAGE_SIZE, type Page, resolvePage } from "./pagination";
import { type AdminResult, fail, ok } from "./result";

export type PersonRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  sectorId: string | null;
  sectorName: string | null;
  sectorActive: boolean | null;
  active: boolean;
};

export async function listPeople(
  db: Db,
  input: { page: number },
): Promise<Page<PersonRow>> {
  const [totalRow] = await db.select({ value: count() }).from(user);
  const total = totalRow?.value ?? 0;
  const { page, pageCount, offset } = resolvePage(total, input.page);

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      sectorId: user.sectorId,
      sectorName: sector.name,
      sectorActive: sector.active,
      deactivatedAt: user.deactivatedAt,
    })
    .from(user)
    .leftJoin(sector, eq(user.sectorId, sector.id))
    .orderBy(
      sql`(${user.deactivatedAt} is null) desc`,
      asc(sql`lower(${user.name})`),
      asc(user.id),
    )
    .limit(PAGE_SIZE)
    .offset(offset);

  return {
    rows: rows.map(({ deactivatedAt, ...row }) => ({
      ...row,
      active: deactivatedAt === null,
    })),
    total,
    page,
    pageCount,
    pageSize: PAGE_SIZE,
  };
}

// Trava as linhas dos admins ativos até o fim da transação: dois admins que se
// desativam ao mesmo tempo são serializados e o segundo relê só um admin (F2-15).
async function lockActiveAdmins(
  tx: Pick<Db, "select">,
): Promise<{ id: string }[]> {
  return tx
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.role, "admin"), isNull(user.deactivatedAt)))
    .orderBy(asc(user.id))
    .for("update");
}

export async function updatePerson(
  db: Db,
  input: {
    actorId: string;
    userId: string;
    role: Role;
    sectorId: string | null;
  },
): Promise<AdminResult> {
  return db.transaction(async (tx): Promise<AdminResult> => {
    const [target] = await tx
      .select({
        id: user.id,
        role: user.role,
        deactivatedAt: user.deactivatedAt,
      })
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1);
    if (!target) {
      return fail("NOT_FOUND", notFoundMessage("pessoa"));
    }

    let nextSectorId: string | null = null;
    if (input.role === "operator") {
      if (!input.sectorId) {
        return fail("SECTOR_REQUIRED", SECTOR_REQUIRED_MESSAGE, {
          sectorId: SECTOR_REQUIRED_MESSAGE,
        });
      }
      const [chosen] = await tx
        .select({ id: sector.id, active: sector.active })
        .from(sector)
        .where(eq(sector.id, input.sectorId))
        .limit(1)
        .for("share");
      if (!chosen) {
        return fail("NOT_FOUND", notFoundMessage("setor"));
      }
      if (!chosen.active) {
        return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_MESSAGE, {
          sectorId: SECTOR_INACTIVE_MESSAGE,
        });
      }
      nextSectorId = chosen.id;
    }

    const demotesActiveAdmin =
      target.role === "admin" &&
      target.deactivatedAt === null &&
      input.role === "operator";
    if (demotesActiveAdmin) {
      if (input.actorId === input.userId) {
        return fail("SELF_CHANGE", SELF_ROLE_MESSAGE);
      }
      const admins = await lockActiveAdmins(tx);
      if (admins.length <= 1) {
        return fail("LAST_ADMIN", LAST_ADMIN_MESSAGE);
      }
    }

    await tx
      .update(user)
      .set({ role: input.role, sectorId: nextSectorId })
      .where(eq(user.id, input.userId));
    return ok();
  });
}

export async function setPersonActive(
  db: Db,
  input: { actorId: string; userId: string; active: boolean },
  now: Date,
): Promise<AdminResult> {
  return db.transaction(async (tx): Promise<AdminResult> => {
    const [target] = await tx
      .select({
        id: user.id,
        role: user.role,
        sectorId: user.sectorId,
        deactivatedAt: user.deactivatedAt,
      })
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1);
    if (!target) {
      return fail("NOT_FOUND", notFoundMessage("pessoa"));
    }

    if (!input.active) {
      if (input.actorId === input.userId) {
        return fail("SELF_CHANGE", SELF_DEACTIVATE_MESSAGE);
      }
      if (target.role === "admin" && target.deactivatedAt === null) {
        const admins = await lockActiveAdmins(tx);
        if (admins.length <= 1) {
          return fail("LAST_ADMIN", LAST_ADMIN_MESSAGE);
        }
      }
      await tx
        .update(user)
        .set({ deactivatedAt: now })
        .where(and(eq(user.id, input.userId), isNull(user.deactivatedAt)));
      // P11: sem isto a pessoa desativada seguiria logada até a sessão vencer.
      // Apaga mesmo se ela já estava desativada (sobra de antes da P11).
      await tx.delete(session).where(eq(session.userId, input.userId));
      return ok();
    }

    if (target.deactivatedAt === null) return ok();

    if (target.role === "operator") {
      const [own] = target.sectorId
        ? await tx
            .select({ active: sector.active })
            .from(sector)
            .where(eq(sector.id, target.sectorId))
            .limit(1)
            .for("share")
        : [];
      if (!own?.active) {
        return fail("SECTOR_INACTIVE", PERSON_SECTOR_INACTIVE_MESSAGE);
      }
    }
    await tx
      .update(user)
      .set({ deactivatedAt: null })
      .where(eq(user.id, input.userId));
    return ok();
  });
}
