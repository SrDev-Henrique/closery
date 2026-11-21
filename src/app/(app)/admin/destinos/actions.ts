"use server";

import {
  createDestination,
  renameDestination,
  setDestinationActive,
} from "@/features/admin/destinations";
import type { AdminResult } from "@/features/admin/result";
import { runAdminAction } from "@/features/admin/runAdminAction";
import {
  createDestinationSchema,
  renameDestinationSchema,
  setActiveSchema,
} from "@/features/admin/schemas";
import { requireAdmin } from "@/lib/auth/session";

export async function createDestinationAction(
  input: unknown,
): Promise<AdminResult<{ id: string }>> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: createDestinationSchema,
    input,
    run: ({ db, input: data }) => createDestination(db, data),
  });
}

export async function renameDestinationAction(
  input: unknown,
): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: renameDestinationSchema,
    input,
    run: ({ db, input: data }) => renameDestination(db, data),
  });
}

export async function setDestinationActiveAction(
  input: unknown,
): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: setActiveSchema,
    input,
    run: ({ db, input: data }) => setDestinationActive(db, data),
  });
}
