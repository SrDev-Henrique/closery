import { MINUTES_PER_DAY, parseTimeOfDay } from "@/features/admin/timeOfDay";
import { firstValue } from "@/lib/searchParams";

import {
  addDays,
  daysBetween,
  isOperationalDateAllowed,
  saoPauloParts,
} from "./saoPaulo";

// Chega na ordem da lista do setor (sort_order, created_at, id): a posição
// desempata dois turnos com o mesmo fim.
export type SuggestableShift = { id: string; startsAt: string; endsAt: string };
export type HandoverTarget = { shiftId: string; operationalDate: string };

function minutesOf(value: string): number {
  const minutes = parseTimeOfDay(value);
  if (minutes === null) {
    throw new RangeError(`Horário inválido: "${value}"`);
  }
  return minutes;
}

/**
 * Fim do turno em hora de parede: o dia é o operacional (+1 se o turno
 * atravessa a meia-noite) e `minutes` são os minutos do fim.
 */
export function shiftEnd(
  operationalDate: string,
  shift: SuggestableShift,
): { date: string; minutes: number } {
  const start = minutesOf(shift.startsAt);
  const end = minutesOf(shift.endsAt);
  return {
    date: end < start ? addDays(operationalDate, 1) : operationalDate,
    minutes: end,
  };
}

/** Fim ≤ agora (fim == agora conta como encerrado; mesma regra do SQL do histórico). */
export function hasShiftEnded(
  operationalDate: string,
  shift: SuggestableShift,
  now: Date,
): boolean {
  const end = shiftEnd(operationalDate, shift);
  const current = saoPauloParts(now);
  if (end.date !== current.date) return end.date < current.date;
  return end.minutes <= current.minutes;
}

type Candidate = {
  shiftId: string;
  operationalDate: string;
  distance: number;
  ended: boolean;
  position: number;
};

// Só ontem e hoje: um turno que começa amanhã não pode ter passagem ainda, e a
// data de amanhã seria recusada por isOperationalDateAllowed.
const CANDIDATE_DAY_OFFSETS = [-1, 0] as const;

function isBetter(a: Candidate, b: Candidate): boolean {
  if (a.distance !== b.distance) return a.distance < b.distance;
  // Empate de distância: o que já terminou vence o que ainda vai terminar.
  if (a.ended !== b.ended) return a.ended;
  if (a.position !== b.position) return a.position < b.position;
  return a.operationalDate < b.operationalDate;
}

/**
 * Turno sugerido agora: o do fim mais próximo de agora (antes ou depois).
 * O dia operacional é o dia em que o turno COMEÇOU (turno 22:00–06:00 que
 * termina às 06:05 de hoje → dia de ontem). Sem turnos → null.
 */
export function suggestShift(
  shifts: readonly SuggestableShift[],
  now: Date,
): HandoverTarget | null {
  const current = saoPauloParts(now);
  let best: Candidate | null = null;

  for (const [position, shift] of shifts.entries()) {
    for (const offset of CANDIDATE_DAY_OFFSETS) {
      const operationalDate = addDays(current.date, offset);
      const end = shiftEnd(operationalDate, shift);
      const endAt =
        daysBetween(current.date, end.date) * MINUTES_PER_DAY + end.minutes;
      const candidate: Candidate = {
        shiftId: shift.id,
        operationalDate,
        distance: Math.abs(endAt - current.minutes),
        ended: endAt <= current.minutes,
        position,
      };
      if (best === null || isBetter(candidate, best)) best = candidate;
    }
  }

  if (best === null) return null;
  return { shiftId: best.shiftId, operationalDate: best.operationalDate };
}

/**
 * Turno E data válidos na URL → usa; qualquer outra coisa → sugestão
 * (`suggested: true`). Sem turnos → null. Parâmetro repetido vale o primeiro.
 */
export function resolveHandoverTarget(
  shifts: readonly SuggestableShift[],
  now: Date,
  requested: { shiftId?: string | string[]; date?: string | string[] },
): (HandoverTarget & { suggested: boolean }) | null {
  if (shifts.length === 0) return null;

  const shiftId = firstValue(requested.shiftId);
  const date = firstValue(requested.date);
  if (
    shiftId !== undefined &&
    date !== undefined &&
    shifts.some((shift) => shift.id === shiftId) &&
    isOperationalDateAllowed(date, now)
  ) {
    return { shiftId, operationalDate: date, suggested: false };
  }

  const suggestion = suggestShift(shifts, now);
  return suggestion === null ? null : { ...suggestion, suggested: true };
}
