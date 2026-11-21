"use server";

import type { AdminResult } from "@/features/admin/result";
import { runAdminAction } from "@/features/admin/runAdminAction";
import {
  createShiftSchema,
  moveSchema,
  setActiveSchema,
  updateShiftSchema,
} from "@/features/admin/schemas";
import type { OverlapWarning } from "@/features/admin/shiftRules";
import {
  createShift,
  moveShift,
  setShiftActive,
  updateShift,
} from "@/features/admin/shifts";
import { requireAdmin } from "@/lib/auth/session";

export async function createShiftAction(
  input: unknown,
): Promise<AdminResult<{ id: string; warnings: OverlapWarning[] }>> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: createShiftSchema,
    input,
    run: ({ db, input: data }) => createShift(db, data),
  });
}

export async function updateShiftAction(
  input: unknown,
): Promise<AdminResult<{ warnings: OverlapWarning[] }>> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: updateShiftSchema,
    input,
    run: ({ db, input: data }) => updateShift(db, data),
  });
}

export async function setShiftActiveAction(
  input: unknown,
): Promise<AdminResult<{ warnings: OverlapWarning[] }>> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: setActiveSchema,
    input,
    run: ({ db, input: data }) => setShiftActive(db, data),
  });
}

export async function moveShiftAction(input: unknown): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: moveSchema,
    input,
    run: ({ db, input: data }) => moveShift(db, data),
  });
}
