"use server";

import { redirect } from "next/navigation";

import { db } from "@/db";
import { notFoundMessage } from "@/features/admin/messages";
import {
  type AdminResult,
  fail,
  INVALID_INPUT_MESSAGE,
} from "@/features/admin/result";
import { ALL_SECTORS } from "@/features/handovers/limits";
import { loadSector } from "@/features/handovers/loaders";
import { SECTOR_INACTIVE_HANDOVER_MESSAGE } from "@/features/handovers/messages";
import { chooseSectorSchema } from "@/features/handovers/schemas";
import { rememberSector } from "@/features/handovers/sectorCookie";
import { chooseSectorPath } from "@/features/handovers/urls";
import { requireAdmin } from "@/lib/auth/session";

// Escolha de setor do admin (D-F3-3, F3-15): grava o cookie e navega para o
// mesmo caminho com ?setor=. Só devolve falha; o sucesso é o redirect.
export async function chooseSectorAction(input: unknown): Promise<AdminResult> {
  const actor = await requireAdmin();
  const parsed = chooseSectorSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", INVALID_INPUT_MESSAGE);
  const { sectorId, path } = parsed.data;

  if (sectorId !== ALL_SECTORS) {
    const found = await loadSector(db, actor, sectorId);
    if (!found) return fail("NOT_FOUND", notFoundMessage("setor"));
    if (!found.active) {
      return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_HANDOVER_MESSAGE);
    }
    await rememberSector(sectorId);
  }

  // Fora de try/catch: redirect() lança de propósito.
  redirect(chooseSectorPath(path, sectorId));
}
