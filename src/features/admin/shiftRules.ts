import { formatTimeOfDay, MINUTES_PER_DAY, parseTimeOfDay } from "./timeOfDay";

export type ShiftRange = { startsAt: string; endsAt: string }; // "HH:mm"
export type NamedShiftRange = ShiftRange & { id: string; name: string };
export type OverlapWarning = {
  shiftId: string;
  name: string;
  startsAt: string;
  endsAt: string;
};

const DEFAULT_START = "06:00";
const SUGGESTED_DURATION_MINUTES = 8 * 60;

function minutesOf(value: string): number {
  const minutes = parseTimeOfDay(value);
  if (minutes === null) throw new RangeError(`Horário inválido: "${value}"`);
  return minutes;
}

/** Atravessa a meia-noite quando o fim é menor que o início. */
export function crossesMidnight(range: ShiftRange): boolean {
  return minutesOf(range.endsAt) < minutesOf(range.startsAt);
}

/**
 * Intervalos semiabertos [início, fim) em minutos. Ao atravessar a meia-noite,
 * 22:00–06:00 vira [1320, 1440) e [0, 360). Segmento vazio some (22:00–00:00
 * é só [1320, 1440)).
 */
export function shiftSegments(
  range: ShiftRange,
): ReadonlyArray<readonly [number, number]> {
  const start = minutesOf(range.startsAt);
  const end = minutesOf(range.endsAt);
  const segments: Array<readonly [number, number]> =
    end >= start
      ? [[start, end]]
      : [
          [start, MINUTES_PER_DAY],
          [0, end],
        ];
  return segments.filter(([from, to]) => to > from);
}

/** Encostar (fim de um == início do outro) não sobrepõe. */
export function rangesOverlap(a: ShiftRange, b: ShiftRange): boolean {
  const segmentsOfB = shiftSegments(b);
  return shiftSegments(a).some(([aStart, aEnd]) =>
    segmentsOfB.some(([bStart, bEnd]) => aStart < bEnd && bStart < aEnd),
  );
}

/** `others` deve ter só os turnos ativos do setor; a ordem de entrada é preservada. */
export function findOverlaps(
  candidate: ShiftRange & { id?: string },
  others: readonly NamedShiftRange[],
): OverlapWarning[] {
  return others
    .filter(
      (other) =>
        (candidate.id === undefined || other.id !== candidate.id) &&
        rangesOverlap(candidate, other),
    )
    .map((other) => ({
      shiftId: other.id,
      name: other.name,
      startsAt: other.startsAt,
      endsAt: other.endsAt,
    }));
}

export function formatOverlapWarning(warning: OverlapWarning): string {
  return `Sobrepõe o turno ${warning.name} (${warning.startsAt}\u{2013}${warning.endsAt})`;
}

/** Começa onde o último turno ativo termina (ou 06:00) e dura 8 h. */
export function suggestShiftTimes(
  activeInOrder: readonly ShiftRange[],
): ShiftRange {
  const last = activeInOrder.at(-1);
  const startsAt = last
    ? formatTimeOfDay(minutesOf(last.endsAt))
    : DEFAULT_START;
  const endsAt = formatTimeOfDay(
    minutesOf(startsAt) + SUGGESTED_DURATION_MINUTES,
  );
  return { startsAt, endsAt };
}

/** "Turno N" com N = quantidade + 1; sobe enquanto o nome existir (sem diferença de caixa). */
export function suggestShiftName(existingNames: readonly string[]): string {
  const taken = new Set(existingNames.map((name) => name.toLowerCase()));
  let next = existingNames.length + 1;
  while (taken.has(`turno ${next}`)) next += 1;
  return `Turno ${next}`;
}
