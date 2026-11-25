import { MAX_DAYS_BACK } from "./limits";

// O cálculo compara a hora de parede em São Paulo (via Intl), sem somar um
// offset fixo. O Brasil não tem horário de verão desde 2019, mas o código não
// depende disso: se a regra voltar, o Intl acompanha.
export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

const PARTS_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: SAO_PAULO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const TIME_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: SAO_PAULO_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** Dia ("YYYY-MM-DD") e minutos desde 00:00 (0..1439) em hora de parede de São Paulo. */
export function saoPauloParts(now: Date): { date: string; minutes: number } {
  const parts = new Map<string, string>();
  for (const part of PARTS_FORMAT.formatToParts(now)) {
    parts.set(part.type, part.value);
  }
  const hour = Number(parts.get("hour")) % 24;
  const minute = Number(parts.get("minute"));
  return {
    date: `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`,
    minutes: hour * 60 + minute,
  };
}

export function todayInSaoPaulo(now: Date): string {
  return saoPauloParts(now).date;
}

function utcMillis(isoDate: string): number | null {
  const match = ISO_DATE.exec(isoDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const millis = Date.UTC(year, month - 1, day);
  const probe = new Date(millis);
  // O Date rola "2026-02-30" para março; a data só vale se sobreviver à ida e volta.
  const real =
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day;
  return real ? millis : null;
}

function requireMillis(isoDate: string): number {
  const millis = utcMillis(isoDate);
  if (millis === null) {
    throw new RangeError(`Data inválida: "${isoDate}"`);
  }
  return millis;
}

/** Formato "YYYY-MM-DD" E data real: "2026-02-30" é falso. */
export function isIsoDate(value: string): boolean {
  return utcMillis(value) !== null;
}

/** "2026-11-30" + 1 → "2026-12-01"; aceita negativo. Lança RangeError se a data for inválida. */
export function addDays(date: string, days: number): string {
  const shifted = new Date(requireMillis(date) + days * MS_PER_DAY);
  return shifted.toISOString().slice(0, 10);
}

/** to − from, em dias inteiros (negativo se `to` for anterior). Lança RangeError se alguma data for inválida. */
export function daysBetween(from: string, to: string): number {
  return Math.round((requireMillis(to) - requireMillis(from)) / MS_PER_DAY);
}

/** Data real entre (hoje − 31 dias) e hoje, no dia de São Paulo. */
export function isOperationalDateAllowed(date: string, now: Date): boolean {
  if (!isIsoDate(date)) return false;
  const today = todayInSaoPaulo(now);
  return date >= addDays(today, -MAX_DAYS_BACK) && date <= today;
}

/** "14:05", em São Paulo. */
export function formatTimeBR(date: Date): string {
  return TIME_FORMAT.format(date);
}

/** "2026-11-21" → "21/11/2026". Só reformata o texto (nunca passa por Date). */
export function formatDateBR(isoDate: string): string {
  const match = ISO_DATE.exec(isoDate);
  if (!match || !isIsoDate(isoDate)) {
    throw new RangeError(`Data inválida: "${isoDate}"`);
  }
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** "21/11/2026 às 07:05": o dia e a hora de São Paulo juntos. */
export function formatDateAtTimeBR(date: Date): string {
  return `${formatDateBR(saoPauloParts(date).date)} às ${formatTimeBR(date)}`;
}
