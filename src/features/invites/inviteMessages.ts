import type { InviteState } from "./inviteState";

export type InviteUnavailableReason =
  | Exclude<InviteState, "valid">
  | "not_found";

export const INVITE_UNAVAILABLE_TITLE = "Convite indisponível";
export const INVITE_UNAVAILABLE_HINT =
  "Peça um novo convite a quem te convidou.";

const MESSAGES: Record<InviteUnavailableReason, string> = {
  expired: "Este convite expirou.",
  used: "Este convite já foi usado.",
  cancelled: "Este convite foi cancelado.",
  not_found: "Convite não encontrado.",
};

export function inviteUnavailableMessage(
  reason: InviteUnavailableReason,
): string {
  return MESSAGES[reason];
}
