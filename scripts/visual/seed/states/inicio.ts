// Os estados do Início (spec §5.4), portados do seed do PR A com o vocabulário inventado e as datas
// relativas ao `ctx.now`. Cada um roda depois do resetVariable (o seedState chama) e usa o setor do
// `ctx` (padrão ULD). O que depende do relógio vai para as máscaras e o patch da tela
// (scripts/visual/screens/inicio.mjs).
import { and, eq, ne } from "drizzle-orm";

import { user } from "@/db/schema/auth";
import { shift } from "@/db/schema/catalog";
import { handover } from "@/db/schema/handovers";
import { suggestShift } from "@/features/handovers/shiftSuggestion";

import { insertHandover, insertRequest } from "../../../../test/fixtures";
import {
  VISUAL_PEOPLE,
  VISUAL_SHIFTS,
  VISUAL_TEXTS,
} from "../../vocabulary.mjs";
import {
  destinationIdByName,
  type PersonKey,
  type SeedDb,
  saoPauloAt,
  saoPauloDate,
  sectorIdByName,
  userIdByEmail,
} from "../world";
import type { StateContext, StateSeeder } from "./index";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const RECENT_REQUESTS = 4;

type StaleTiming = {
  by: "bruno" | "carla";
  status: "requested" | "in_transit";
  createdAgo: number;
  changedAgo?: number;
};

// A idade de cada parada, na ordem de VISUAL_TEXTS.staleRequests (spec §5.4).
const STALE_TIMING: readonly StaleTiming[] = [
  { by: "bruno", status: "requested", createdAgo: 4 * DAY_MS + 2 * HOUR_MS },
  {
    by: "carla",
    status: "in_transit",
    createdAgo: 5 * DAY_MS,
    changedAgo: 3 * DAY_MS + 5 * HOUR_MS,
  },
  { by: "bruno", status: "requested", createdAgo: 3 * DAY_MS + HOUR_MS },
];

/** O turno que o app sugere agora no setor (o do fim mais próximo) e os outros turnos ativos. */
export async function suggestedTarget(
  db: SeedDb,
  sectorId: string,
  now: Date,
): Promise<{ shiftId: string; operationalDate: string; others: string[] }> {
  const shifts = await db
    .select({ id: shift.id, startsAt: shift.startsAt, endsAt: shift.endsAt })
    .from(shift)
    .where(and(eq(shift.sectorId, sectorId), eq(shift.active, true)))
    .orderBy(shift.sortOrder);
  const target = suggestShift(shifts, now);
  if (!target) throw new Error("o setor não tem turno ativo para sugerir");
  return {
    ...target,
    others: shifts.filter((s) => s.id !== target.shiftId).map((s) => s.id),
  };
}

/**
 * A pendente do Bruno: entregue às 05:58 de hoje, de ontem, num turno que não é o sugerido, com o
 * nome "Turno 3" no snapshot (o seed não depende da hora em que roda). Devolve o turno e o dia que
 * ela ocupa.
 */
export async function seedPendingFromBruno(
  db: SeedDb,
  ctx: StateContext,
): Promise<{ shiftId: string; operationalDate: string }> {
  const sectorId = await sectorIdByName(db, ctx.sector);
  const target = await suggestedTarget(db, sectorId, ctx.now);
  const shiftId = target.others[0];
  if (!shiftId) {
    throw new Error("a pendente precisa de um segundo turno ativo no setor");
  }
  const bruno = await userIdByEmail(db, VISUAL_PEOPLE.bruno.email);
  const operationalDate = saoPauloDate(ctx.now, -1);
  await insertHandover(db, {
    sectorId,
    shiftId,
    operationalDate,
    status: "delivered",
    deliveredBy: bruno,
    deliveredAt: saoPauloAt("05:58", ctx.now),
    updatedBy: bruno,
    shiftNameSnapshot: VISUAL_SHIFTS[2]?.name ?? "Turno 3",
    nextShiftText: VISUAL_TEXTS.pendingNextShift,
  });
  return { shiftId, operationalDate };
}

/** As 3 paradas (mais de 72 h no mesmo status) e 4 abertas recentes: 7 abertas no setor. */
export async function seedStaleRequests(
  db: SeedDb,
  ctx: StateContext,
): Promise<void> {
  const sectorId = await sectorIdByName(db, ctx.sector);
  const people = {
    bruno: await userIdByEmail(db, VISUAL_PEOPLE.bruno.email),
    carla: await userIdByEmail(db, VISUAL_PEOPLE.carla.email),
  };
  const now = ctx.now.getTime();
  for (const [index, text] of VISUAL_TEXTS.staleRequests.entries()) {
    const timing = STALE_TIMING[index];
    if (!timing) throw new Error(`a parada nº ${index + 1} não tem idade`);
    await insertRequest(db, {
      sectorId,
      createdBy: people[timing.by],
      destinationId: await destinationIdByName(db, text.destination),
      description: text.description,
      status: timing.status,
      createdAt: new Date(now - timing.createdAgo),
      ...(timing.changedAgo === undefined
        ? {}
        : { statusChangedAt: new Date(now - timing.changedAgo) }),
    });
  }
  const recent = VISUAL_TEXTS.recentRequests;
  const destinationId = await destinationIdByName(db, recent.destination);
  for (let n = 1; n <= RECENT_REQUESTS; n++) {
    await insertRequest(db, {
      sectorId,
      createdBy: people.carla,
      destinationId,
      description: `${recent.descriptionPrefix} ${n}`,
      createdAt: new Date(now - n * HOUR_MS),
    });
  }
}

/** A passagem do turno sugerido: rascunho salvo às 07:58, entregue às 13:52, confirmada às 14:06. */
async function seedCurrentHandover(
  db: SeedDb,
  ctx: StateContext,
  status: "draft" | "delivered" | "confirmed",
  by: PersonKey,
  confirmer?: PersonKey,
): Promise<void> {
  const sectorId = await sectorIdByName(db, ctx.sector);
  const target = await suggestedTarget(db, sectorId, ctx.now);
  const byId = await userIdByEmail(db, VISUAL_PEOPLE[by].email);
  const confirmedBy = confirmer
    ? await userIdByEmail(db, VISUAL_PEOPLE[confirmer].email)
    : undefined;
  const created = await insertHandover(db, {
    sectorId,
    shiftId: target.shiftId,
    operationalDate: target.operationalDate,
    status,
    updatedBy: byId,
    ...(status === "draft"
      ? {}
      : { deliveredBy: byId, deliveredAt: saoPauloAt("13:52", ctx.now) }),
    ...(status === "confirmed" && confirmedBy
      ? { confirmedBy, confirmedAt: saoPauloAt("14:06", ctx.now) }
      : {}),
  });
  if (status === "draft") {
    await db
      .update(handover)
      .set({ updatedAt: saoPauloAt("07:58", ctx.now) })
      .where(eq(handover.id, created.id));
  }
}

export const INICIO_STATES: Record<
  "admin" | "primeiro" | "continuar" | "entregue" | "confirmada" | "sem-turnos",
  StateSeeder
> = {
  // A pendente do Bruno e as 7 abertas (3 paradas).
  admin: async (db, ctx) => {
    await seedPendingFromBruno(db, ctx);
    await seedStaleRequests(db, ctx);
  },
  // Primeiro acesso: só a Ana ativa, sem convite pendente, sem passagem nem solicitação.
  primeiro: async (db, ctx) => {
    const ana = await userIdByEmail(db, VISUAL_PEOPLE.ana.email);
    await db
      .update(user)
      .set({ deactivatedAt: ctx.now })
      .where(ne(user.id, ana));
  },
  // Rascunho do turno sugerido, salvo pela Carla.
  continuar: (db, ctx) => seedCurrentHandover(db, ctx, "draft", "carla"),
  // Entregue pela Ana, mais as paradas.
  entregue: async (db, ctx) => {
    await seedCurrentHandover(db, ctx, "delivered", "ana");
    await seedStaleRequests(db, ctx);
  },
  // Entregue pela Ana e confirmada pelo Diego, mais as paradas.
  confirmada: async (db, ctx) => {
    await seedCurrentHandover(db, ctx, "confirmed", "ana", "diego");
    await seedStaleRequests(db, ctx);
  },
  // Os turnos do setor desligados, mais as paradas.
  "sem-turnos": async (db, ctx) => {
    const sectorId = await sectorIdByName(db, ctx.sector);
    await db
      .update(shift)
      .set({ active: false })
      .where(eq(shift.sectorId, sectorId));
    await seedStaleRequests(db, ctx);
  },
};
