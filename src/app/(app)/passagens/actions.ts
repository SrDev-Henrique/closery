"use server";

import type { AdminResult } from "@/features/admin/result";
import { type Confirmed, confirmHandover } from "@/features/handovers/confirm";
import type { Delivered } from "@/features/handovers/deliver";
import { deliverHandover } from "@/features/handovers/deliver";
import type { SavedField } from "@/features/handovers/draft";
import { saveHandoverField } from "@/features/handovers/draft";
import { runHandoverAction } from "@/features/handovers/runHandoverAction";
import {
  confirmHandoverSchema,
  deliverHandoverSchema,
  saveFieldSchema,
} from "@/features/handovers/schemas";
import { requireUser } from "@/lib/auth/session";

// Salvamento automático: nunca revalida (re-renderizaria a tela enquanto a
// pessoa digita).
export async function saveHandoverFieldAction(
  input: unknown,
): Promise<AdminResult<SavedField>> {
  const actor = await requireUser();
  return runHandoverAction({
    actor,
    schema: saveFieldSchema,
    input,
    revalidate: false,
    run: ({ db, now, actor: who, input: data }) =>
      saveHandoverField(db, who, data, now),
  });
}

export async function deliverHandoverAction(
  input: unknown,
): Promise<AdminResult<Delivered>> {
  const actor = await requireUser();
  return runHandoverAction({
    actor,
    schema: deliverHandoverSchema,
    input,
    revalidate: true,
    run: ({ db, now, actor: who, input: data }) =>
      deliverHandover(db, who, data, now),
  });
}

export async function confirmHandoverAction(
  input: unknown,
): Promise<AdminResult<Confirmed>> {
  const actor = await requireUser();
  return runHandoverAction({
    actor,
    schema: confirmHandoverSchema,
    input,
    revalidate: true,
    run: ({ db, now, actor, input }) => confirmHandover(db, actor, input, now),
  });
}
