import { codePointLength } from "@/features/handovers/fieldRules";
import { pluralize } from "@/lib/plural";

import { CLOSED_WINDOW_DAYS, PREVIEW_LENGTH } from "./limits";
import type { BoardStatus } from "./types";

// NFC + "\r\n"/"\r" → "\n" + trim (descrição, motivo e comentário). Reexport:
// é a mesma regra do motivo da correção da passagem, sem cópia.
export { normalizeReason as normalizeRequestText } from "@/features/handovers/fieldRules";

/** Texto do "Outro": NFC, qualquer sequência de espaços/quebras vira um espaço, trim ("" possível). */
export function normalizeDestinationOther(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/g, " ").trim();
}

/**
 * Prévia da descrição para toasts e rótulos: a primeira linha com texto, com
 * os espaços colapsados, em até 60 pontos de código (acima disso, o corte
 * leva "…" e o total continua em 60).
 */
export function requestPreview(description: string): string {
  const firstLine =
    description.split(/\r\n|\r|\n/).find((line) => line.trim() !== "") ?? "";
  const line = firstLine.normalize("NFC").replace(/\s+/g, " ").trim();
  if (codePointLength(line) <= PREVIEW_LENGTH) return line;
  const cut = Array.from(line)
    .slice(0, PREVIEW_LENGTH - 1)
    .join("")
    .trimEnd();
  return `${cut}…`;
}

export function itemCountLabel(count: number): string {
  return pluralize(count, "item", "itens");
}

export function commentCountLabel(count: number): string {
  return pluralize(count, "comentário", "comentários");
}

export function openCountLabel(count: number): string {
  return pluralize(count, "aberta", "abertas");
}

export function staleCountLabel(count: number): string {
  return pluralize(count, "parada", "paradas");
}

/** "3 solicitadas · 1 em separação / trânsito · 5 entregues nos últimos 30 dias" (o sufixo só sem período escolhido). */
export function boardSummary(
  totals: Record<BoardStatus, number>,
  closedWindow: boolean,
): string {
  const summary = `${pluralize(totals.requested, "solicitada", "solicitadas")} · ${totals.in_transit} em separação / trânsito · ${pluralize(totals.delivered, "entregue", "entregues")}`;
  return closedWindow
    ? `${summary} nos últimos ${CLOSED_WINDOW_DAYS} dias`
    : summary;
}

/** Subtítulo da visão Tabela: "12 solicitações". */
export function tableSummary(total: number): string {
  return pluralize(total, "solicitação", "solicitações");
}

/** O texto do "Outro" ganha a marca; o nome da lista fica como está. */
export function destinationLabel(name: string, isOther: boolean): string {
  return isOther ? `${name} (outro destino)` : name;
}
