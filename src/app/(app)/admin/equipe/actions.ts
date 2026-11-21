"use server";

import { setPersonActive, updatePerson } from "@/features/admin/people";
import type { AdminResult } from "@/features/admin/result";
import { runAdminAction } from "@/features/admin/runAdminAction";
import {
  cancelInviteSchema,
  createInviteSchema,
  setPersonActiveSchema,
  updatePersonSchema,
} from "@/features/admin/schemas";
import {
  cancelPendingInvite,
  createTeamInvite,
} from "@/features/admin/teamInvites";
import { authEnv } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/session";

// `input: unknown` é o objeto do formulário (UpdatePersonInput); o schema Zod
// valida de novo no servidor, então o cliente nunca é a fonte da verdade.
export async function updatePersonAction(input: unknown): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: updatePersonSchema,
    input,
    run: ({ db, actor: current, input: data }) =>
      updatePerson(db, { actorId: current.userId, ...data }),
  });
}

export async function setPersonActiveAction(
  input: unknown,
): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: setPersonActiveSchema,
    input,
    run: ({ db, now, actor: current, input: data }) =>
      setPersonActive(db, { actorId: current.userId, ...data }, now),
  });
}

// O link nasce aqui e volta uma vez só: o banco guarda apenas o hash do token.
export async function createInviteAction(
  input: unknown,
): Promise<AdminResult<{ id: string; url: string; expiresAt: Date }>> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: createInviteSchema,
    input,
    run: ({ db, now, actor: current, input: data }) =>
      createTeamInvite(db, {
        actorId: current.userId,
        inviteeLabel: data.inviteeLabel,
        role: data.role,
        sectorId: data.sectorId,
        baseURL: authEnv.baseURL,
        now,
      }),
  });
}

export async function cancelInviteAction(input: unknown): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: cancelInviteSchema,
    input,
    run: ({ db, now, input: data }) =>
      cancelPendingInvite(db, { id: data.id }, now),
  });
}
