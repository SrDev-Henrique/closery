export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InviteState = "valid" | "expired" | "used" | "cancelled";

// Precedência: cancelled > used > expired > valid. O instante exato de
// expiração já conta como expirado (mesma regra do `expires_at > now` do SQL
// em consumeInvite).
export function inviteState(
  row: { expiresAt: Date; usedAt: Date | null; cancelledAt: Date | null },
  now: Date,
): InviteState {
  if (row.cancelledAt) return "cancelled";
  if (row.usedAt) return "used";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}
