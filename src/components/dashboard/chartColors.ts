import type { SegmentSlot } from "@/features/dashboard/types";
import type { HistorySituation } from "@/features/handovers/status";

// Classes LITERAIS: o Tailwind só gera o CSS do que aparece escrito inteiro, e o guarda de
// paleta (`chartPalette.test.ts`) lê este arquivo para medir o que a tela pinta.

/** Turno nos slots 1 a 4: a cor da entidade (turno), nunca ciclada. */
export const SHIFT_SWATCHES = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
] as const;
export const SHIFT_STROKES = [
  "stroke-chart-1",
  "stroke-chart-2",
  "stroke-chart-3",
  "stroke-chart-4",
] as const;

/** Turno do 5º em diante: sem cor própria, cada um continua com a própria linha e o link. */
export const OTHERS_SWATCH = "bg-foreground";
export const OTHERS_STROKE = "stroke-foreground";

export function segmentSwatch(slot: SegmentSlot): string {
  return slot === null ? OTHERS_SWATCH : SHIFT_SWATCHES[slot - 1];
}

export function segmentStroke(slot: SegmentSlot): string {
  return slot === null ? OTHERS_STROKE : SHIFT_STROKES[slot - 1];
}

/** A cor da situação é a do selo da lista (`-foreground` do token), não o fundo pastel dele. */
export const SITUATION_CHART: Readonly<
  Record<HistorySituation, { stroke: string; dot: string }>
> = {
  confirmed: {
    stroke: "stroke-success-foreground",
    dot: "bg-success-foreground",
  },
  awaiting: { stroke: "stroke-info-foreground", dot: "bg-info-foreground" },
  unconfirmed: {
    stroke: "stroke-warning-foreground",
    dot: "bg-warning-foreground",
  },
  missing: { stroke: "stroke-muted-foreground", dot: "bg-muted-foreground" },
};

/** Série única (linha do estoque), no `ChartConfig`. */
export const SINGLE_SERIES_COLOR = "var(--foreground)";
/** Barra única (destinos), no `BarList`. */
export const SINGLE_BAR_CLASS = "bg-foreground";
