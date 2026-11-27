"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { rememberInviteCardDismissed } from "@/features/admin/firstAccess";
import { notFoundMessage } from "@/features/admin/messages";
import {
  type AdminResult,
  fail,
  INVALID_INPUT_MESSAGE,
} from "@/features/admin/result";
import { ALL_SECTORS } from "@/features/handovers/limits";
import { loadSector } from "@/features/handovers/loaders";
import { SECTOR_INACTIVE_HANDOVER_MESSAGE } from "@/features/handovers/messages";
import { todayInSaoPaulo } from "@/features/handovers/saoPaulo";
import { chooseSectorSchema } from "@/features/handovers/schemas";
import { rememberSector } from "@/features/handovers/sectorCookie";
import { sectorRedirectHref } from "@/features/handovers/sectorRedirect";
import { requireAdmin } from "@/lib/auth/session";

// Escolha de setor do admin (D-F3-3, F3-15): grava o cookie e navega para o
// mesmo caminho com ?setor= e os filtros da tela, reinterpretados no servidor
// (P45). Só devolve falha; o sucesso é o redirect.
export async function chooseSectorAction(input: unknown): Promise<AdminResult> {
  const actor = await requireAdmin();
  const parsed = chooseSectorSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", INVALID_INPUT_MESSAGE);
  const { sectorId, path, query } = parsed.data;

  if (sectorId !== ALL_SECTORS) {
    const found = await loadSector(db, actor, sectorId);
    if (!found) return fail("NOT_FOUND", notFoundMessage("setor"));
    if (!found.active) {
      return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_HANDOVER_MESSAGE);
    }
    await rememberSector(sectorId);
  }

  // Fora de try/catch: redirect() lança de propósito.
  redirect(
    sectorRedirectHref(
      path,
      sectorId,
      query ?? "",
      todayInSaoPaulo(new Date()),
    ),
  );
}

// "Agora não" do cartão "Convide sua equipe" (spec §5.3): só o admin, só o
// cookie (nada no banco). `revalidatePath` faz o Início renderizar de novo já
// sem o cartão. Devolve `void` porque vai direto no `<form action>` do cartão
// (Task 14); não há falha a informar (sem permissão, o `requireAdmin` já
// interrompe com redirect ou notFound).
export async function dismissInviteCardAction(): Promise<void> {
  await requireAdmin();
  await rememberInviteCardDismissed();
  revalidatePath("/");
}
