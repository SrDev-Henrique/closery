import "server-only";

import { and, count, desc, eq, gt, isNull } from "drizzle-orm";

import { user } from "@/db/schema/auth";
import { invite } from "@/db/schema/invites";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import { ADMIN_INVITE_LABEL_MAX_LENGTH } from "@/features/invites/adminInvite";
import { cancelInvite, createInvite } from "@/features/invites/inviteQueries";
import { buildInviteUrl, isHttpUrl } from "@/features/invites/inviteUrl";
import type { Role } from "@/lib/roles";
import {
  INVITE_LABEL_TOO_LONG_MESSAGE,
  INVITE_NOT_PENDING_MESSAGE,
  notFoundMessage,
  SECTOR_INACTIVE_MESSAGE,
  SECTOR_REQUIRED_MESSAGE,
} from "./messages";
import { normalizeName } from "./names";
import { PAGE_SIZE, type Page, resolvePage } from "./pagination";
import { type AdminResult, fail, ok } from "./result";

export type PendingInviteRow = {
  id: string;
  inviteeLabel: string | null;
  role: Role;
  sectorName: string | null;
  inviterName: string | null;
  expiresAt: Date;
  createdAt: Date;
};

// Pendente = mesma regra de consumeInvite/cancelInvite (estado "valid").
function pendingWhere(now: Date) {
  return and(
    isNull(invite.usedAt),
    isNull(invite.cancelledAt),
    gt(invite.expiresAt, now),
  );
}

export async function listPendingInvites(
  db: Db,
  input: { page: number },
  now: Date,
): Promise<Page<PendingInviteRow>> {
  const [totalRow] = await db
    .select({ value: count() })
    .from(invite)
    .where(pendingWhere(now));
  const total = totalRow?.value ?? 0;
  const { page, pageCount, offset } = resolvePage(total, input.page);

  const rows = await db
    .select({
      id: invite.id,
      inviteeLabel: invite.inviteeLabel,
      role: invite.role,
      sectorName: sector.name,
      inviterName: user.name,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    })
    .from(invite)
    .leftJoin(sector, eq(invite.sectorId, sector.id))
    .leftJoin(user, eq(invite.invitedBy, user.id))
    .where(pendingWhere(now))
    .orderBy(desc(invite.createdAt), desc(invite.id))
    .limit(PAGE_SIZE)
    .offset(offset);

  return { rows, total, page, pageCount, pageSize: PAGE_SIZE };
}

export async function createTeamInvite(
  db: Db,
  input: {
    actorId: string;
    inviteeLabel: string | null;
    role: Role;
    sectorId: string | null;
    baseURL: string;
    now: Date;
  },
): Promise<AdminResult<{ id: string; url: string; expiresAt: Date }>> {
  const label = normalizeName(input.inviteeLabel ?? "");
  if ([...label].length > ADMIN_INVITE_LABEL_MAX_LENGTH) {
    return fail("INVALID_INPUT", INVITE_LABEL_TOO_LONG_MESSAGE, {
      inviteeLabel: INVITE_LABEL_TOO_LONG_MESSAGE,
    });
  }

  // A checagem do setor e o INSERT do convite rodam na mesma transação: o
  // FOR SHARE segura o setor e serializa com o FOR UPDATE de setSectorActive.
  return db.transaction(async (tx) => {
    let sectorId: string | null = null;
    if (input.role === "operator") {
      if (!input.sectorId) {
        return fail("SECTOR_REQUIRED", SECTOR_REQUIRED_MESSAGE, {
          sectorId: SECTOR_REQUIRED_MESSAGE,
        });
      }
      const [chosen] = await tx
        .select({ id: sector.id, active: sector.active })
        .from(sector)
        .where(eq(sector.id, input.sectorId))
        .limit(1)
        .for("share");
      if (!chosen) {
        return fail("NOT_FOUND", notFoundMessage("setor"));
      }
      if (!chosen.active) {
        return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_MESSAGE, {
          sectorId: SECTOR_INACTIVE_MESSAGE,
        });
      }
      sectorId = chosen.id;
    }

    // Valida a URL antes de gravar: senão o convite nasceria sem link para mostrar.
    if (!isHttpUrl(input.baseURL)) {
      throw new Error(
        `BETTER_AUTH_URL não é uma URL absoluta: "${input.baseURL}".`,
      );
    }

    const { id, token, expiresAt } = await createInvite(tx, {
      role: input.role,
      sectorId,
      inviteeLabel: label === "" ? null : label,
      invitedBy: input.actorId,
      now: input.now,
    });

    return ok({ id, url: buildInviteUrl(input.baseURL, token), expiresAt });
  });
}

export async function cancelPendingInvite(
  db: Db,
  input: { id: string },
  now: Date,
): Promise<AdminResult> {
  const cancelled = await cancelInvite(db, input.id, now);
  if (!cancelled) {
    return fail("INVITE_NOT_PENDING", INVITE_NOT_PENDING_MESSAGE);
  }
  return ok();
}
