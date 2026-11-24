import { and, count, eq } from "drizzle-orm";
import type { Pool } from "pg";

import { createDb, createPool } from "@/db/client";
import {
  type HandoverStatus,
  handover,
  handoverCorrection,
  session,
  user,
} from "@/db/schema";
import type { Db } from "@/db/types";
import type { HandoverRef } from "@/features/handovers/types";

// Portas e URLs fixas do E2E: o banco (PGlite via socket) e o app (next start).
export const E2E_DB_PORT = 54329;
export const E2E_APP_PORT = 3200;
export const E2E_DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${E2E_DB_PORT}/postgres`;
export const E2E_BASE_URL = `http://localhost:${E2E_APP_PORT}`;

export { buildInviteUrl } from "@/features/invites/inviteUrl";
export {
  insertHandover,
  insertHandoverItem,
  insertInvite,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../test/fixtures";

export function openE2eDb(): { pool: Pool; db: Db } {
  const pool = createPool(E2E_DATABASE_URL);
  return { pool, db: createDb(pool) };
}

export async function deactivateUserByEmail(
  db: Db,
  email: string,
  now: Date = new Date(),
): Promise<void> {
  const rows = await db
    .update(user)
    .set({ deactivatedAt: now })
    .where(eq(user.email, email))
    .returning({ id: user.id });
  if (rows.length !== 1) {
    throw new Error(`Usuário ${email} não encontrado para desativar.`);
  }
}

// Quantas sessões abertas a pessoa tem: desativar apaga todas (P11).
export async function countSessionsByEmail(
  db: Db,
  email: string,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(session)
    .innerJoin(user, eq(session.userId, user.id))
    .where(eq(user.email, email));
  return row?.total ?? 0;
}

// Id da pessoa pelo e-mail (quem entregou ou confirmou uma passagem).
export async function userIdByEmail(db: Db, email: string): Promise<string> {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  if (!row) throw new Error(`Pessoa ${email} não encontrada.`);
  return row.id;
}

// A passagem da tripla setor + turno + dia, como o banco a guarda.
export async function handoverOf(
  db: Db,
  ref: HandoverRef,
): Promise<{
  id: string;
  status: HandoverStatus;
  deliveredBy: string | null;
  confirmedBy: string | null;
  occurrencesText: string;
  nextShiftText: string;
} | null> {
  const [row] = await db
    .select({
      id: handover.id,
      status: handover.status,
      deliveredBy: handover.deliveredBy,
      confirmedBy: handover.confirmedBy,
      occurrencesText: handover.occurrencesText,
      nextShiftText: handover.nextShiftText,
    })
    .from(handover)
    .where(
      and(
        eq(handover.sectorId, ref.sectorId),
        eq(handover.shiftId, ref.shiftId),
        eq(handover.operationalDate, ref.operationalDate),
      ),
    );
  return row ?? null;
}

export async function countCorrections(
  db: Db,
  handoverId: string,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(handoverCorrection)
    .where(eq(handoverCorrection.handoverId, handoverId));
  return row?.total ?? 0;
}
