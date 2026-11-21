import { and, eq, gt, isNull } from "drizzle-orm";

import { user } from "@/db/schema/auth";
import { invite } from "@/db/schema/invites";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import type { Role } from "@/lib/roles";

import { INVITE_TTL_MS, type InviteState, inviteState } from "./inviteState";
import {
  generateInviteToken,
  hashInviteToken,
  isWellFormedInviteToken,
} from "./token";

export type CreateInviteInput = {
  role: Role;
  sectorId: string | null;
  inviteeLabel: string | null;
  invitedBy: string | null;
  now: Date;
};

export async function createInvite(
  db: Db,
  input: CreateInviteInput,
): Promise<{ id: string; token: string; expiresAt: Date }> {
  if (input.role === "operator" && !input.sectorId) {
    throw new Error("Convite de operador exige um setor.");
  }

  const { token, tokenHash } = generateInviteToken();
  const expiresAt = new Date(input.now.getTime() + INVITE_TTL_MS);

  const [created] = await db
    .insert(invite)
    .values({
      tokenHash,
      role: input.role,
      sectorId: input.sectorId,
      inviteeLabel: input.inviteeLabel,
      invitedBy: input.invitedBy,
      expiresAt,
    })
    .returning({ id: invite.id });

  if (!created) {
    throw new Error("Falha ao criar o convite.");
  }

  return { id: created.id, token, expiresAt };
}

export type InviteDetails = {
  state: InviteState;
  role: Role;
  sectorName: string | null;
  inviterName: string | null;
  inviteeLabel: string | null;
  expiresAt: Date;
};

// null = token malformado (sem consultar o banco) ou inexistente.
export async function findInviteByToken(
  db: Db,
  token: string,
  now: Date,
): Promise<InviteDetails | null> {
  if (!isWellFormedInviteToken(token)) return null;

  const [row] = await db
    .select({
      role: invite.role,
      inviteeLabel: invite.inviteeLabel,
      expiresAt: invite.expiresAt,
      usedAt: invite.usedAt,
      cancelledAt: invite.cancelledAt,
      sectorName: sector.name,
      inviterName: user.name,
    })
    .from(invite)
    .leftJoin(sector, eq(invite.sectorId, sector.id))
    .leftJoin(user, eq(invite.invitedBy, user.id))
    .where(eq(invite.tokenHash, hashInviteToken(token)))
    .limit(1);

  if (!row) return null;

  return {
    state: inviteState(row, now),
    role: row.role,
    sectorName: row.sectorName,
    inviterName: row.inviterName,
    inviteeLabel: row.inviteeLabel,
    expiresAt: row.expiresAt,
  };
}

// Consumo atômico: um único UPDATE condicional. A validade e a marcação de uso
// acontecem na mesma instrução, então duas tentativas simultâneas não passam
// as duas. Nunca troque por SELECT seguido de UPDATE.
export async function consumeInvite(
  db: Db,
  token: string,
  now: Date,
): Promise<{ role: Role; sectorId: string | null } | null> {
  if (!isWellFormedInviteToken(token)) return null;

  const [consumed] = await db
    .update(invite)
    .set({ usedAt: now })
    .where(
      and(
        eq(invite.tokenHash, hashInviteToken(token)),
        isNull(invite.usedAt),
        isNull(invite.cancelledAt),
        gt(invite.expiresAt, now),
      ),
    )
    .returning({ role: invite.role, sectorId: invite.sectorId });

  return consumed ?? null;
}

// Grava quem usou o convite. Só preenche uma vez (used_by IS NULL).
export async function recordInviteUser(
  db: Db,
  token: string,
  userId: string,
): Promise<void> {
  if (!isWellFormedInviteToken(token)) return;

  await db
    .update(invite)
    .set({ usedBy: userId })
    .where(
      and(eq(invite.tokenHash, hashInviteToken(token)), isNull(invite.usedBy)),
    );
}
