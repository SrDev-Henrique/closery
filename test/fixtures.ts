import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { session, user } from "@/db/schema/auth";
import { destination, type ItemKind, item, shift } from "@/db/schema/catalog";
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
  options: { active?: boolean } = {},
): Promise<{ id: string; name: string }> {
  const [created] = await db
    .insert(sector)
    .values({ name, active: options.active ?? true })
    .returning({ id: sector.id, name: sector.name });
  if (!created) throw new Error("fixture: setor não criado");
  return created;
}

// Turno do setor. Padrões: nome único, 06:00–14:00, ordem = maior do setor + 1.
export async function insertShift(
  db: Db,
  input: {
    sectorId: string;
    name?: string;
    startsAt?: string;
    endsAt?: string;
    sortOrder?: number;
    active?: boolean;
  },
): Promise<{ id: string; name: string }> {
  const [created] = await db
    .insert(shift)
    .values({
      sectorId: input.sectorId,
      name: input.name ?? `Turno ${randomUUID().slice(0, 8)}`,
      startsAt: input.startsAt ?? "06:00",
      endsAt: input.endsAt ?? "14:00",
      sortOrder:
        input.sortOrder ??
        sql`(select coalesce(max(${shift.sortOrder}), 0) + 1 from ${shift} where ${shift.sectorId} = ${input.sectorId})`,
      active: input.active ?? true,
    })
    .returning({ id: shift.id, name: shift.name });
  if (!created) throw new Error("fixture: turno não criado");
  return created;
}

// Item do setor. Padrões: nome único, "unidade", "control", ordem = maior + 1.
export async function insertItem(
  db: Db,
  input: {
    sectorId: string;
    name?: string;
    unit?: string;
    kind?: ItemKind;
    sortOrder?: number;
    active?: boolean;
  },
): Promise<{ id: string; name: string }> {
  const [created] = await db
    .insert(item)
    .values({
      sectorId: input.sectorId,
      name: input.name ?? `Item ${randomUUID().slice(0, 8)}`,
      unit: input.unit ?? "unidade",
      kind: input.kind ?? "control",
      sortOrder:
        input.sortOrder ??
        sql`(select coalesce(max(${item.sortOrder}), 0) + 1 from ${item} where ${item.sectorId} = ${input.sectorId})`,
      active: input.active ?? true,
    })
    .returning({ id: item.id, name: item.name });
  if (!created) throw new Error("fixture: item não criado");
  return created;
}

export async function insertDestination(
  db: Db,
  input: { name?: string; active?: boolean } = {},
): Promise<{ id: string; name: string }> {
  const [created] = await db
    .insert(destination)
    .values({
      name: input.name ?? `Destino ${randomUUID().slice(0, 8)}`,
      active: input.active ?? true,
    })
    .returning({ id: destination.id, name: destination.name });
  if (!created) throw new Error("fixture: destino não criado");
  return created;
}

// session.updatedAt é notNull sem default: a fixture preenche.
// expiresAt padrão = daqui a 7 dias.
export async function insertSession(
  db: Db,
  input: { userId: string; expiresAt?: Date },
): Promise<{ id: string; token: string }> {
  const id = randomUUID().replaceAll("-", "");
  const token = randomUUID().replaceAll("-", "");
  const now = new Date();
  const [created] = await db
    .insert(session)
    .values({
      id,
      token,
      userId: input.userId,
      expiresAt:
        input.expiresAt ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      updatedAt: now,
    })
    .returning({ id: session.id, token: session.token });
  if (!created) throw new Error("fixture: sessão não criada");
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
