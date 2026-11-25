import { MIN_BAR_PERCENT } from "./limits";

/**
 * Duração em texto curto: "menos de 1 min", "35 min", "5 h", "5 h 20 min",
 * "2 d", "2 d 4 h" (de 1 dia em diante os minutos somem). Negativo ou não
 * finito lança RangeError.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new RangeError(`Duração inválida: ${seconds}`);
  }
  const minutes = Math.round(seconds / 60);
  if (minutes === 0) return "menos de 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours === 0 ? `${days} d` : `${days} d ${restHours} h`;
}

/** Largura da barra em % do maior valor; valor > 0 nunca some (piso) e nunca passa de 100. */
export function barPercent(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.min(
    100,
    Math.max(MIN_BAR_PERCENT, Math.round((value / max) * 100)),
  );
}

/** Participação do valor no total, em % inteiro. */
export function sharePercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}
