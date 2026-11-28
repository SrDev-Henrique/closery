// O mundo visual (spec §5.4): setores, turnos, itens, destinos e um convite por pessoa fictícia, e a
// parte variável que cada estado zera antes de se montar. Só o vocabulário inventado de
// scripts/visual/vocabulary.mjs, nada de protótipo. Recebe `db` por parâmetro: a CLI passa o banco
// da 54332 (conferido por assertVisualDbUrl), o teste passa o PGlite.
import { and, count, eq, isNull } from "drizzle-orm";

import { user } from "@/db/schema/auth";
import { destination, item, shift } from "@/db/schema/catalog";
import {
  handover,
  handoverCorrection,
  handoverItem,
} from "@/db/schema/handovers";
import { invite } from "@/db/schema/invites";
import {
  request,
  requestComment,
  requestItem,
  requestStatusEvent,
} from "@/db/schema/requests";
import { sector } from "@/db/schema/sectors";
import {
  addDays,
  saoPauloParts,
  todayInSaoPaulo,
} from "@/features/handovers/saoPaulo";

import {
  insertDestination,
  insertInvite,
  insertItem,
  insertSector,
  insertShift,
} from "../../../test/fixtures";
import {
  VISUAL_DESTINATIONS,
  VISUAL_ITEMS,
  VISUAL_PEOPLE,
  VISUAL_SECTORS,
  VISUAL_SHIFTS,
} from "../vocabulary.mjs";

export type SeedDb = Parameters<typeof insertSector>[0];
export type PersonKey = keyof typeof VISUAL_PEOPLE;
export type WorldFile = {
  sectors: Record<string, string>;
  invites: Record<PersonKey, string>;
};

/** O setor dos estados quando o `--setor` não vem (e o dos convites dos operadores). */
export const DEFAULT_SECTOR = "ULD";

// Turnos "antigos": o histórico só gera "sem passagem" a partir do createdAt do turno.
const SHIFTS_CREATED_AT = new Date("2026-10-01T12:00:00Z");
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MINUTES_PER_DAY = 1440;

/**
 * O mundo inteiro, uma vez: 4 setores, 3 turnos em cada, 9 itens, 5 destinos e um convite por
 * pessoa (a Ana admin, sem setor; os operadores no ULD). Lança se o banco já tem setores.
 */
export async function seedBase(db: SeedDb): Promise<WorldFile> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ total: count() }).from(sector);
    if ((existing?.total ?? 0) > 0) {
      throw new Error(
        "o banco visual já tem setores: o base roda uma vez (para recomeçar, pare o visual:db e apague .git/sdd/visual-db/pgdata)",
      );
    }

    const sectors: Record<string, string> = {};
    for (const { name, color } of VISUAL_SECTORS) {
      const created = await insertSector(tx, name, { color });
      sectors[name] = created.id;
      for (const [index, turn] of VISUAL_SHIFTS.entries()) {
        await insertShift(tx, {
          sectorId: created.id,
          name: turn.name,
          startsAt: turn.startsAt,
          endsAt: turn.endsAt,
          sortOrder: index + 1,
          createdAt: SHIFTS_CREATED_AT,
        });
      }
      for (const [index, itemName] of (VISUAL_ITEMS[name] ?? []).entries()) {
        await insertItem(tx, {
          sectorId: created.id,
          name: itemName,
          unit: "unidade",
          kind: "control",
          sortOrder: index + 1,
        });
      }
    }
    for (const name of VISUAL_DESTINATIONS) {
      await insertDestination(tx, { name });
    }

    const operatorsSector = sectors[DEFAULT_SECTOR];
    if (!operatorsSector) {
      throw new Error(`setor ${DEFAULT_SECTOR} não existe no vocabulário`);
    }
    const invites = {} as Record<PersonKey, string>;
    for (const key of Object.keys(VISUAL_PEOPLE) as PersonKey[]) {
      const person = VISUAL_PEOPLE[key];
      const { token } = await insertInvite(tx, {
        role: person.role,
        sectorId: person.role === "admin" ? null : operatorsSector,
      });
      invites[key] = token;
    }
    return { sectors, invites };
  });
}

/**
 * A parte variável, zerada antes de cada estado: passagens, solicitações e o histórico delas; todos
 * os turnos ativos; todas as pessoas ativas; os itens de volta a `control` em `unidade`; os convites
 * pendentes cancelados (o primeiro acesso exige zero pendentes).
 */
export async function resetVariable(db: SeedDb): Promise<void> {
  await db.delete(requestComment);
  await db.delete(requestStatusEvent);
  await db.delete(requestItem);
  await db.delete(request);
  await db.delete(handoverCorrection);
  await db.delete(handoverItem);
  await db.delete(handover);
  await db.update(shift).set({ active: true });
  await db.update(user).set({ deactivatedAt: null });
  await db.update(item).set({ kind: "control", unit: "unidade" });
  await db
    .update(invite)
    .set({ cancelledAt: new Date() })
    .where(and(isNull(invite.usedAt), isNull(invite.cancelledAt)));
}

/** Id do setor pelo nome; lança "setor <nome> não existe". */
export async function sectorIdByName(
  db: SeedDb,
  name: string,
): Promise<string> {
  const [row] = await db
    .select({ id: sector.id })
    .from(sector)
    .where(eq(sector.name, name));
  if (!row) throw new Error(`setor ${name} não existe`);
  return row.id;
}

/** Id da pessoa pelo e-mail; lança se ela ainda não se cadastrou. */
export async function userIdByEmail(
  db: SeedDb,
  email: string,
): Promise<string> {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  if (!row) {
    throw new Error(
      `usuário ${email} não existe (cadastre com bun run visual:people)`,
    );
  }
  return row.id;
}

/** Id do destino pelo nome; lança "destino <nome> não existe". */
export async function destinationIdByName(
  db: SeedDb,
  name: string,
): Promise<string> {
  const [row] = await db
    .select({ id: destination.id })
    .from(destination)
    .where(eq(destination.name, name));
  if (!row) throw new Error(`destino ${name} não existe`);
  return row.id;
}

/**
 * Hoje (o dia de São Paulo de `now`) às HH:MM de São Paulo. O palpite é UTC−3; a hora de parede que
 * o Intl devolve corrige se o fuso mudar.
 */
export function saoPauloAt(hhmm: string, now: Date = new Date()): Date {
  const match = HHMM.exec(hhmm);
  if (!match) throw new RangeError(`horário inválido: "${hhmm}" (HH:MM)`);
  const date = todayInSaoPaulo(now);
  const target = Number(match[1]) * 60 + Number(match[2]);
  const guess = new Date(`${date}T${hhmm}:00-03:00`);
  const parts = saoPauloParts(guess);
  let dayShift = 0;
  if (parts.date < date) dayShift = -MINUTES_PER_DAY;
  if (parts.date > date) dayShift = MINUTES_PER_DAY;
  const delta = dayShift + parts.minutes - target;
  return delta === 0 ? guess : new Date(guess.getTime() - delta * 60_000);
}

/** O dia de São Paulo de `now`, andado `offsetDays` dias: "YYYY-MM-DD". */
export function saoPauloDate(now: Date, offsetDays = 0): string {
  return addDays(todayInSaoPaulo(now), offsetDays);
}
