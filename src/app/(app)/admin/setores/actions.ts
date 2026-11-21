"use server";

import type { AdminResult } from "@/features/admin/result";
import { runAdminAction } from "@/features/admin/runAdminAction";
import {
  createSectorSchema,
  renameSectorSchema,
  setActiveSchema,
} from "@/features/admin/schemas";
import {
  createSector,
  renameSector,
  setSectorActive,
} from "@/features/admin/sectors";
import { requireAdmin } from "@/lib/auth/session";

export async function createSectorAction(
  input: unknown,
): Promise<AdminResult<{ id: string }>> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: createSectorSchema,
    input,
    run: ({ db, input: data }) => createSector(db, data),
  });
}

export async function renameSectorAction(input: unknown): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: renameSectorSchema,
    input,
    run: ({ db, input: data }) => renameSector(db, data),
  });
}

export async function setSectorActiveAction(
  input: unknown,
): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: setActiveSchema,
    input,
    run: ({ db, now, input: data }) => setSectorActive(db, data, now),
  });
}
