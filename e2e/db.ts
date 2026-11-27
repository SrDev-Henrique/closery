import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";
import type { Pool } from "pg";

import { createDb, createPool } from "@/db/client";
import {
  type HandoverStatus,
  handover,
  handoverCorrection,
  invite,
  type RequestStatus,
  request,
  requestComment,
  requestStatusEvent,
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
  insertDestination,
  insertHandover,
  insertHandoverItem,
  insertInvite,
  insertItem,
  insertRequest,
  insertRequestComment,
  insertRequestEvent,
  insertRequestItem,
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

// Deixa o banco como o primeiro acesso do admin exige (`people === 1` e
// `pendingInvites === 0`): desativa as pessoas ativas e cancela os convites
// pendentes, sem apagar nada. Chame ANTES de cadastrar o admin do teste.
// Devolve `restore`, que reativa EXATAMENTE as pessoas que esta chamada
// desativou e descancela EXATAMENTE os convites que ela cancelou (pelos ids
// guardados; o que outra parte do teste mudou depois fica como está). Guarde o
// `restore` e chame no `test.afterAll` do arquivo (em ordem inversa, se houver
// mais de um), para os specs seguintes acharem o banco como antes.
export async function isolateFirstAccess(
  db: Db,
  now: Date = new Date(),
): Promise<() => Promise<void>> {
  const changed = await db.transaction(async (tx) => {
    const people = await tx
      .update(user)
      .set({ deactivatedAt: now })
      .where(isNull(user.deactivatedAt))
      .returning({ id: user.id });
    const invites = await tx
      .update(invite)
      .set({ cancelledAt: now })
      .where(and(isNull(invite.usedAt), isNull(invite.cancelledAt)))
      .returning({ id: invite.id });
    return {
      userIds: people.map((row) => row.id),
      inviteIds: invites.map((row) => row.id),
    };
  });

  return async () => {
    await db.transaction(async (tx) => {
      if (changed.userIds.length > 0) {
        await tx
          .update(user)
          .set({ deactivatedAt: null })
          .where(inArray(user.id, changed.userIds));
      }
      if (changed.inviteIds.length > 0) {
        await tx
          .update(invite)
          .set({ cancelledAt: null })
          .where(inArray(invite.id, changed.inviteIds));
      }
    });
  };
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

// A solicitação como o banco a guarda (conferir o resultado de uma tela).
export async function requestOf(
  db: Db,
  id: string,
): Promise<{
  id: string;
  status: RequestStatus;
  sectorId: string;
  originHandoverId: string | null;
  description: string;
} | null> {
  const [row] = await db
    .select({
      id: request.id,
      status: request.status,
      sectorId: request.sectorId,
      originHandoverId: request.originHandoverId,
      description: request.description,
    })
    .from(request)
    .where(eq(request.id, id));
  return row ?? null;
}

// A solicitação mais recente com a descrição exata (o E2E cria com texto único).
export async function requestByDescription(
  db: Db,
  description: string,
): Promise<{
  id: string;
  status: RequestStatus;
  originHandoverId: string | null;
} | null> {
  const [row] = await db
    .select({
      id: request.id,
      status: request.status,
      originHandoverId: request.originHandoverId,
    })
    .from(request)
    .where(eq(request.description, description))
    .orderBy(desc(request.createdAt), desc(request.id))
    .limit(1);
  return row ?? null;
}

// Quantos eventos de status a solicitação tem (criar = 1, cada mudança +1).
export async function countRequestEvents(
  db: Db,
  requestId: string,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(requestStatusEvent)
    .where(eq(requestStatusEvent.requestId, requestId));
  return row?.total ?? 0;
}

// Comentários da solicitação, do mais antigo ao mais novo, com os apagados e o
// motivo de cancelamento marcados.
export async function commentsOf(
  db: Db,
  requestId: string,
): Promise<{ body: string; deleted: boolean; isReason: boolean }[]> {
  const rows = await db
    .select({
      body: requestComment.body,
      deletedAt: requestComment.deletedAt,
      statusEventId: requestComment.statusEventId,
    })
    .from(requestComment)
    .where(eq(requestComment.requestId, requestId))
    .orderBy(asc(requestComment.createdAt), asc(requestComment.id));
  return rows.map((row) => ({
    body: row.body,
    deleted: row.deletedAt !== null,
    isReason: row.statusEventId !== null,
  }));
}
