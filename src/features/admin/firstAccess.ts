import "server-only";

import { cookies } from "next/headers";

import type { AdminOverviewCounts } from "./overview";

// Primeiro acesso do admin (spec §5.3): o cartão "Convide sua equipe" aparece
// enquanto a equipe tem só ele, nenhum convite foi gerado e ele não dispensou.
export const INVITE_CARD_DISMISSED_COOKIE = "closery-convite-dispensado";
export const INVITE_CARD_DISMISSED_MAX_AGE_SECONDS = 31_536_000; // 1 ano

export function shouldShowInviteCard(input: {
  isAdmin: boolean;
  counts: Pick<AdminOverviewCounts, "people" | "pendingInvites">;
  dismissed: boolean;
}): boolean {
  return (
    input.isAdmin &&
    !input.dismissed &&
    input.counts.people === 1 &&
    input.counts.pendingInvites === 0
  );
}

/** Só o valor "1" dispensa; ausente ou outro valor, o cartão aparece. Chame dentro de <Suspense> (lê `cookies()`). */
export async function readInviteCardDismissed(): Promise<boolean> {
  return (await cookies()).get(INVITE_CARD_DISMISSED_COOKIE)?.value === "1";
}

/** Só dentro de Server Action ou Route Handler: `.set` não vale em render. */
export async function rememberInviteCardDismissed(): Promise<void> {
  (await cookies()).set(INVITE_CARD_DISMISSED_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: INVITE_CARD_DISMISSED_MAX_AGE_SECONDS,
  });
}
