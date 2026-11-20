import { randomUUID } from "node:crypto";

import { user } from "@/db/schema/auth";
import { invite } from "@/db/schema/invites";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import type { CreateInviteInput } from "@/features/invites/inviteQueries";
import { INVITE_TTL_MS } from "@/features/invites/inviteState";
import { generateInviteToken } from "@/features/invites/token";
import type { Role } from "@/lib/roles";

export async function insertSector(
  db: Db,
  name = `Setor ${randomUUID().slice(0, 8)}`,
): Promise<{ id: string; name: string }> {
  const [created] = await db
    .insert(sector)
    .values({ name })
    .returning({ id: sector.id, name: sector.name });
  if (!created) throw new Error("fixture: setor não criado");
  return created;
}

export async function insertUser(
  db: Db,
  input: {
    role: Role;
    sectorId: string | null;
    name?: string;
    email?: string;
    deactivatedAt?: Date | null;
  },
): Promise<{ id: string }> {
  const id = randomUUID().replaceAll("-", "");
  const [created] = await db
    .insert(user)
    .values({
      id,
      name: input.name ?? "Pessoa Teste",
      email: input.email ?? `${id}@example.test`,
      role: input.role,
      sectorId: input.sectorId,
      deactivatedAt: input.deactivatedAt ?? null,
    })
    .returning({ id: user.id });
  if (!created) throw new Error("fixture: usuário não criado");
  return created;
}

// Insere direto na tabela (sem passar por createInvite) para poder montar
// estados que o domínio não produz sozinho: usado, cancelado, expirado.
// Defaults explícitos: admin, sem setor, válido por 7 dias a partir de `now`.
export async function insertInvite(
  db: Db,
  input: Partial<CreateInviteInput> & {
    usedAt?: Date | null;
    cancelledAt?: Date | null;
    expiresAt?: Date;
  } = {},
): Promise<{ id: string; token: string }> {
  const { token, tokenHash } = generateInviteToken();
  const now = input.now ?? new Date();
  const [created] = await db
    .insert(invite)
    .values({
      tokenHash,
      role: input.role ?? "admin",
      sectorId: input.sectorId ?? null,
      inviteeLabel: input.inviteeLabel ?? null,
      invitedBy: input.invitedBy ?? null,
      expiresAt: input.expiresAt ?? new Date(now.getTime() + INVITE_TTL_MS),
      usedAt: input.usedAt ?? null,
      cancelledAt: input.cancelledAt ?? null,
    })
    .returning({ id: invite.id });
  if (!created) throw new Error("fixture: convite não criado");
  return { id: created.id, token };
}
