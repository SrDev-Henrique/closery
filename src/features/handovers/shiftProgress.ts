import {
  formatTimeOfDay,
  MINUTES_PER_DAY,
  parseTimeOfDay,
} from "@/features/admin/timeOfDay";

import { formatTimeBR, saoPauloParts } from "./saoPaulo";

// Barra do turno do Início (estados `start` e `continue`). Pura: o servidor
// calcula a cada carga da página com o `now` do render; nada anima no cliente.
export type ShiftProgress = {
  startLabel: string; // "06:00"
  endLabel: string; // "14:00"
  nowLabel: string; // "08:42", hora de São Paulo
  pct: number; // 0..100, no máximo 2 casas
};

function minutesOf(value: string): number {
  const minutes = parseTimeOfDay(value);
  if (minutes === null) {
    throw new RangeError(`Horário inválido: "${value}"`);
  }
  return minutes;
}

/**
 * Quanto do turno já passou, em hora de parede de São Paulo. Trata o turno que
 * cruza a meia-noite. Fora do turno, o "agora" fica entre o fim e o próximo
 * início: mais perto do fim (empate incluso) = 100, mais perto do início = 0.
 */
export function shiftProgress(
  shift: { startsAt: string; endsAt: string },
  now: Date,
): ShiftProgress {
  const start = minutesOf(shift.startsAt);
  const end = minutesOf(shift.endsAt);
  const duration =
    end === start
      ? MINUTES_PER_DAY
      : (end - start + MINUTES_PER_DAY) % MINUTES_PER_DAY;

  const current = saoPauloParts(now).minutes;
  const elapsed = (current - start + MINUTES_PER_DAY) % MINUTES_PER_DAY;

  let pct: number;
  if (elapsed <= duration) {
    pct = (elapsed / duration) * 100;
  } else {
    const sinceEnd = elapsed - duration;
    const untilNextStart = MINUTES_PER_DAY - elapsed;
    pct = sinceEnd <= untilNextStart ? 100 : 0;
  }

  return {
    startLabel: formatTimeOfDay(start),
    endLabel: formatTimeOfDay(end),
    nowLabel: formatTimeBR(now),
    pct: Math.round(pct * 100) / 100,
  };
}
