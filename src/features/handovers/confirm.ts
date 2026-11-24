import "server-only";

import { and, eq, ne } from "drizzle-orm";

import { handover } from "@/db/schema/handovers";
import type { Db } from "@/db/types";
import {
  type AdminResult,
  fail,
  INVALID_INPUT_MESSAGE,
  ok,
} from "@/features/admin/result";
import type { Authz } from "@/features/authz/authz";

import { codePointLength, normalizeOptionalText } from "./fieldRules";
import { CONFIRMATION_NOTE_MAX_LENGTH } from "./limits";
import {
  findHandoverById,
  type HandoverRow,
  loadSector,
  lockHandover,
  userNames,
} from "./loaders";
import {
  alreadyConfirmedMessage,
  CONFIRMATION_NOTE_TOO_LONG_MESSAGE,
  HANDOVER_NOT_FOUND_MESSAGE,
  NOT_DELIVERED_MESSAGE,
  OWN_HANDOVER_MESSAGE,
  SECTOR_INACTIVE_HANDOVER_MESSAGE,
} from "./messages";

export type Confirmed = { confirmedAt: Date };

// O estado da linha travada decide a mensagem. Com a linha travada (FOR
// UPDATE) a corrida perdida cai aqui com o estado do vencedor.
async function refusalFor(
  tx: Db,
  actor: Authz,
  row: HandoverRow,
): Promise<AdminResult<Confirmed> | null> {
  if (row.status === "draft") {
    return fail("NOT_DELIVERED", NOT_DELIVERED_MESSAGE);
  }
  if (row.status === "confirmed") {
    const names = await userNames(
      tx,
      row.confirmedBy === null ? [] : [row.confirmedBy],
    );
    const who =
      (row.confirmedBy && names.get(row.confirmedBy)) || "outra pessoa";
    return fail(
      "ALREADY_CONFIRMED",
      alreadyConfirmedMessage(who, row.confirmedAt ?? new Date(0)),
    );
  }
  if (row.deliveredBy === actor.userId) {
    return fail("OWN_HANDOVER", OWN_HANDOVER_MESSAGE);
  }
  return null;
}

export async function confirmHandover(
  db: Db,
  actor: Authz,
  input: { id: string; note: string | null },
  now: Date,
): Promise<AdminResult<Confirmed>> {
  const note = input.note === null ? null : normalizeOptionalText(input.note);
  if (note !== null && codePointLength(note) > CONFIRMATION_NOTE_MAX_LENGTH) {
    return fail("INVALID_INPUT", INVALID_INPUT_MESSAGE, {
      note: CONFIRMATION_NOTE_TOO_LONG_MESSAGE,
    });
  }

  return db.transaction(async (tx) => {
    const visible = await findHandoverById(tx, actor, input.id);
    if (!visible) return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);

    // Setor inativo é só leitura (P26).
    const owner = await loadSector(tx, actor, visible.sectorId);
    if (!owner) return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);
    if (!owner.active) {
      return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_HANDOVER_MESSAGE);
    }

    const row = await lockHandover(tx, input.id);
    if (!row) return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);

    const refusal = await refusalFor(tx, actor, row);
    if (refusal) return refusal;

    const updated = await tx
      .update(handover)
      .set({
        status: "confirmed",
        confirmedBy: actor.userId,
        confirmedAt: now,
        confirmationNote: note,
      })
      .where(
        and(
          eq(handover.id, input.id),
          eq(handover.status, "delivered"),
          ne(handover.deliveredBy, actor.userId),
        ),
      )
      .returning({ id: handover.id });
    if (updated.length === 0) {
      // Defesa em profundidade: com a linha travada isto não deveria ocorrer.
      const current = await lockHandover(tx, input.id);
      const refused = current ? await refusalFor(tx, actor, current) : null;
      return refused ?? fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);
    }
    return ok({ confirmedAt: now });
  });
}
