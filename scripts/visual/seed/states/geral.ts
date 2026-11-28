// O estado "rico" do passe de legibilidade (spec §5.4): a pendente do Bruno, as paradas, seis dias de
// passagens confirmadas com itens e textos, uma correção e solicitações em todos os status. Portado
// do seed do PR A, com o vocabulário inventado e as datas relativas ao `ctx.now`.
import { and, eq } from "drizzle-orm";

import { item, shift } from "@/db/schema/catalog";

import {
  insertHandover,
  insertHandoverCorrection,
  insertHandoverItem,
  insertRequest,
} from "../../../../test/fixtures";
import { VISUAL_PEOPLE, VISUAL_TEXTS } from "../../vocabulary.mjs";
import {
  destinationIdByName,
  type SeedDb,
  saoPauloAt,
  saoPauloDate,
  sectorIdByName,
  userIdByEmail,
} from "../world";
import type { StateContext, StateSeeder } from "./index";
import {
  seedPendingFromBruno,
  seedStaleRequests,
  suggestedTarget,
} from "./inicio";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const HISTORY_DAYS = 6;
// Entrega e confirmação de cada turno (pela posição do turno no setor), no dia da passagem.
const DELIVERED_AT = ["12:55", "13:55", "14:55"] as const;
const CONFIRMED_AT = ["13:05", "14:05", "15:05"] as const;
// O item que vira estoque no estado rico (spec §5.4).
const STOCK_ITEM = "Stretch";
const HISTORY_STATUS_GAP_HOURS = {
  created: [30, 20],
  changed: [10, 5],
} as const;

async function seedHistory(
  db: SeedDb,
  ctx: StateContext,
  pending: { shiftId: string; operationalDate: string },
): Promise<void> {
  const sectorId = await sectorIdByName(db, ctx.sector);
  const ana = await userIdByEmail(db, VISUAL_PEOPLE.ana.email);
  const bruno = await userIdByEmail(db, VISUAL_PEOPLE.bruno.email);
  const carla = await userIdByEmail(db, VISUAL_PEOPLE.carla.email);
  const diego = await userIdByEmail(db, VISUAL_PEOPLE.diego.email);
  const shifts = await db
    .select({ id: shift.id, name: shift.name })
    .from(shift)
    .where(eq(shift.sectorId, sectorId))
    .orderBy(shift.sortOrder);

  // Antes das passagens: o snapshot dos itens já leva o Stretch em rolo.
  await db
    .update(item)
    .set({ kind: "stock", unit: "rolo" })
    .where(and(eq(item.sectorId, sectorId), eq(item.name, STOCK_ITEM)));
  const items = await db
    .select({ id: item.id })
    .from(item)
    .where(eq(item.sectorId, sectorId))
    .orderBy(item.sortOrder);

  const target = await suggestedTarget(db, sectorId, ctx.now);
  const authors = [bruno, carla, diego];
  let first: string | null = null;
  for (let d = 1; d <= HISTORY_DAYS; d++) {
    const date = saoPauloDate(ctx.now, -d);
    const dayNow = new Date(ctx.now.getTime() - d * DAY_MS);
    for (const [i, turn] of shifts.entries()) {
      // O turno sugerido e o da pendente ficam livres (a mesma tripla não pode ter duas passagens).
      const isTarget =
        turn.id === target.shiftId && date === target.operationalDate;
      const isPending =
        turn.id === pending.shiftId && date === pending.operationalDate;
      if (isTarget || isPending) continue;
      const by = authors[i % 3] ?? bruno;
      const confirmer = by === carla ? diego : carla;
      const created = await insertHandover(db, {
        sectorId,
        shiftId: turn.id,
        operationalDate: date,
        status: "confirmed",
        deliveredBy: by,
        deliveredAt: saoPauloAt(DELIVERED_AT[i % 3] ?? "12:55", dayNow),
        confirmedBy: confirmer,
        confirmedAt: saoPauloAt(CONFIRMED_AT[i % 3] ?? "13:05", dayNow),
        updatedBy: by,
        shiftNameSnapshot: turn.name,
        occurrencesText: d % 2 ? VISUAL_TEXTS.history.occurrences : "",
        nextShiftText: d % 3 ? VISUAL_TEXTS.history.nextShift : "",
      });
      first ??= created.id;
      for (const [k, line] of items.entries()) {
        await insertHandoverItem(db, {
          handoverId: created.id,
          itemId: line.id,
          quantity: (d + k * 3) % 9,
          note: k === 0 && d === 2 ? VISUAL_TEXTS.history.note : null,
          snapshot: true,
        });
      }
    }
  }

  // A primeira passagem criada (ontem, com o texto de ocorrências) ganha a correção.
  if (first) {
    await insertHandoverCorrection(db, {
      handoverId: first,
      field: "occurrences_text",
      oldValue: VISUAL_TEXTS.history.correctionOld,
      newValue: VISUAL_TEXTS.history.occurrences,
      reason: VISUAL_TEXTS.history.correctionReason,
      correctedBy: ana,
    });
  }

  // Solicitações em todos os status (Quadro, Tabela e Dashboard).
  const now = ctx.now.getTime();
  const { created, changed } = HISTORY_STATUS_GAP_HOURS;
  for (const [i, entry] of VISUAL_TEXTS.historyRequests.entries()) {
    await insertRequest(db, {
      sectorId,
      createdBy: i % 2 ? bruno : carla,
      destinationId: await destinationIdByName(db, entry.destination),
      description: entry.description,
      status: entry.status,
      createdAt: new Date(now - (created[0] + i * created[1]) * HOUR_MS),
      statusChangedAt: new Date(now - (changed[0] + i * changed[1]) * HOUR_MS),
      statusChangedBy: ana,
      ...(entry.status === "cancelled"
        ? { cancelReason: VISUAL_TEXTS.cancelReason }
        : {}),
    });
  }
}

export const GERAL_STATES: Record<"rico", StateSeeder> = {
  rico: async (db, ctx) => {
    const pending = await seedPendingFromBruno(db, ctx);
    await seedStaleRequests(db, ctx);
    await seedHistory(db, ctx, pending);
  },
};
