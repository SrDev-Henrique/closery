"use server";

import { setPersonActive, updatePerson } from "@/features/admin/people";
import type { AdminResult } from "@/features/admin/result";
import { runAdminAction } from "@/features/admin/runAdminAction";
import {
  setPersonActiveSchema,
  updatePersonSchema,
} from "@/features/admin/schemas";
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
