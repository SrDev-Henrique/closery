"use server";

import { resolveUnit } from "@/features/admin/itemOptions";
import {
  createItem,
  moveItem,
  setItemActive,
  updateItem,
} from "@/features/admin/items";
import {
  type AdminFailure,
  type AdminResult,
  fail,
} from "@/features/admin/result";
import { runAdminAction } from "@/features/admin/runAdminAction";
import {
  createItemSchema,
  moveSchema,
  setActiveSchema,
  updateItemSchema,
} from "@/features/admin/schemas";
import { requireAdmin } from "@/lib/auth/session";

// Os schemas já recusam unidade inválida; isto mantém a action segura sozinha.
function unitOf(data: {
  unitChoice: string;
  unitOther: string;
}): { ok: true; unit: string } | { ok: false; failure: AdminFailure } {
  const resolved = resolveUnit(data.unitChoice, data.unitOther);
  if (resolved.ok) return resolved;
  return {
    ok: false,
    failure: fail("INVALID_INPUT", resolved.message, {
      [resolved.field]: resolved.message,
    }),
  };
}

export async function createItemAction(
  input: unknown,
): Promise<AdminResult<{ id: string }>> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: createItemSchema,
    input,
    run: async ({ db, input: data }) => {
      const unit = unitOf(data);
      if (!unit.ok) return unit.failure;
      return createItem(db, {
        sectorId: data.sectorId,
        name: data.name,
        unit: unit.unit,
        kind: data.kind,
      });
    },
  });
}

export async function updateItemAction(input: unknown): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: updateItemSchema,
    input,
    run: async ({ db, input: data }) => {
      const unit = unitOf(data);
      if (!unit.ok) return unit.failure;
      return updateItem(db, {
        id: data.id,
        name: data.name,
        unit: unit.unit,
        kind: data.kind,
      });
    },
  });
}

export async function setItemActiveAction(
  input: unknown,
): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: setActiveSchema,
    input,
    run: ({ db, input: data }) => setItemActive(db, data),
  });
}

export async function moveItemAction(input: unknown): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: moveSchema,
    input,
    run: ({ db, input: data }) => moveItem(db, data),
  });
}
