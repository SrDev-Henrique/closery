import { formatInteger } from "@/lib/numberFormat";

export type Delta =
  | { kind: "none" }
  | { kind: "same" }
  | { kind: "up" | "down"; percent: number }; // percent inteiro ≥ 0

const MINUS = "\u{2212}";
const EM_DASH = "\u{2014}";
const SUFFIX = "vs período anterior";

/**
 * Variação contra o período anterior. Anterior 0 não tem comparação (nem 0 → 0):
 * "none". Sem verde nem vermelho: a polaridade é neutra.
 */
export function computeDelta(current: number, previous: number): Delta {
  if (previous === 0) return { kind: "none" };
  if (current === previous) return { kind: "same" };
  const percent = Math.round((Math.abs(current - previous) * 100) / previous);
  return { kind: current > previous ? "up" : "down", percent };
}

// Diferença menor que 0,5% arredonda para 0: "+<1%", nunca "+0%" (que diria
// "igual" sem ser).
function percentText(percent: number): string {
  return percent === 0 ? "<1%" : `${formatInteger(percent)}%`;
}

export function deltaText(delta: Delta): string {
  switch (delta.kind) {
    case "none":
      return `${EM_DASH} ${SUFFIX}`;
    case "same":
      return "igual ao período anterior";
    case "up":
      return `+${percentText(delta.percent)} ${SUFFIX}`;
    case "down":
      return `${MINUS}${percentText(delta.percent)} ${SUFFIX}`;
  }
}

export function deltaAriaLabel(delta: Delta): string {
  return delta.kind === "none"
    ? "Sem dados no período anterior para comparar"
    : deltaText(delta);
}
