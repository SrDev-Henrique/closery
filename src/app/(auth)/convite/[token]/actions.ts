"use server";

import { cookies } from "next/headers";
import { db } from "@/db";
import {
  INVITE_UNAVAILABLE_HINT,
  inviteUnavailableMessage,
} from "@/features/invites/inviteMessages";
import { findInviteByToken } from "@/features/invites/inviteQueries";
import { INVITE_COOKIE, inviteCookieOptions } from "@/lib/auth/inviteCookie";

type ArmInviteResult = { ok: true } | { ok: false; message: string };

function unavailable(
  reason: Parameters<typeof inviteUnavailableMessage>[0],
): ArmInviteResult {
  return {
    ok: false,
    message: `${inviteUnavailableMessage(reason)} ${INVITE_UNAVAILABLE_HINT}`,
  };
}

// Arma o cookie do convite antes do cadastro. Só revalida e grava; quem
// consome o convite é o hook de criação de usuário (nunca a página nem esta
// action), então prefetch e scanners de link não gastam o convite.
export async function armInvite(token: string): Promise<ArmInviteResult> {
  const details = await findInviteByToken(db, token, new Date());
  if (!details) return unavailable("not_found");
  if (details.state !== "valid") return unavailable(details.state);

  const jar = await cookies();
  jar.set(
    INVITE_COOKIE,
    token,
    inviteCookieOptions(process.env.NODE_ENV === "production"),
  );
  return { ok: true };
}
