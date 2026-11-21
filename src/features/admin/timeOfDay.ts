export const MINUTES_PER_DAY = 1440;

export const TIME_INPUT_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "HH:mm" ou "HH:mm:00" → minutos desde 00:00 (0..1439); inválido → null. */
export function parseTimeOfDay(value: string): number | null {
  const hhmm =
    value.endsWith(":00") && value.length === 8 ? value.slice(0, 5) : value;
  const match = TIME_INPUT_PATTERN.exec(hhmm);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Minutos → "HH:mm", módulo 24 h (1440 → "00:00"; -60 → "23:00"). */
export function formatTimeOfDay(minutes: number): string {
  const wrapped =
    ((Math.trunc(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) %
    MINUTES_PER_DAY;
  const hours = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const mins = String(wrapped % 60).padStart(2, "0");
  return `${hours}:${mins}`;
}

/** "06:00" → "06:00:00" (o que o banco recebe). Lança RangeError se inválido. */
export function toDbTime(value: string): string {
  const minutes = parseTimeOfDay(value);
  if (minutes === null) {
    throw new RangeError(`Horário inválido: "${value}"`);
  }
  return `${formatTimeOfDay(minutes)}:00`;
}

/** "06:00:00" → "06:00"; "06:00" → "06:00". Lança RangeError se inválido. */
export function fromDbTime(value: string): string {
  const minutes = parseTimeOfDay(value);
  if (minutes === null) {
    throw new RangeError(`Horário inválido: "${value}"`);
  }
  return formatTimeOfDay(minutes);
}
