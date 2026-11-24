import "server-only";

import { desc, eq } from "drizzle-orm";

import { user } from "@/db/schema/auth";
import { request, requestStatusEvent } from "@/db/schema/requests";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import { type Authz, canAccessSector } from "@/features/authz/authz";
import type { SectorRow } from "@/features/handovers/loaders";
import type { RequestStatus } from "@/lib/requestStatuses";

export type RequestRow = typeof request.$inferSelect;

/** null se não existe OU está fora do escopo do operador (a mesma resposta: não revela o que existe). */
export async function findRequestById(
  db: Db,
  actor: Authz,
  id: string,
): Promise<RequestRow | null> {
  const [row] = await db.select().from(request).where(eq(request.id, id));
  if (!row || !canAccessSector(actor, row.sectorId)) return null;
  return row;
}

/** `SELECT … FOR UPDATE`: use dentro da transação, antes de decidir a mensagem. */
export async function lockRequest(
  tx: Db,
  id: string,
): Promise<RequestRow | null> {
  const [row] = await tx
    .select()
    .from(request)
    .where(eq(request.id, id))
    .for("update");
  return row ?? null;
}

/** O último evento de status (changed_at desc, seq desc) com o nome de quem mudou. */
export async function lastChange(
  db: Db,
  requestId: string,
): Promise<{ status: RequestStatus; byName: string; at: Date } | null> {
  const [row] = await db
    .select({
      status: requestStatusEvent.toStatus,
      byName: user.name,
      at: requestStatusEvent.changedAt,
    })
    .from(requestStatusEvent)
    .innerJoin(user, eq(user.id, requestStatusEvent.changedBy))
    .where(eq(requestStatusEvent.requestId, requestId))
    .orderBy(desc(requestStatusEvent.changedAt), desc(requestStatusEvent.seq))
    .limit(1);
  return row ?? null;
}

/**
 * `loadSector` com `FOR SHARE` (só dentro de transação): serializa com o
 * `FOR UPDATE` de `setSectorActive`, então um setor desativado no meio não
 * recebe escrita. null se não existe ou está fora do escopo do operador.
 */
export async function lockSectorShare(
  tx: Db,
  actor: Authz,
  sectorId: string,
): Promise<SectorRow | null> {
  const [row] = await tx
    .select({ id: sector.id, name: sector.name, active: sector.active })
    .from(sector)
    .where(eq(sector.id, sectorId))
    .for("share");
  if (!row || !canAccessSector(actor, row.id)) return null;
  return row;
}
