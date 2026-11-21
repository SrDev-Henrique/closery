import type { HandoverRef } from "./types";

// Lista fechada de caminhos onde o seletor de setor aparece: a Server Action
// só redireciona para um destes (nunca para um caminho vindo do cliente).
export const SECTOR_PICKER_PATHS = [
  "/",
  "/passagens",
  "/passagens/nova",
] as const;
export type SectorPickerPath = (typeof SECTOR_PICKER_PATHS)[number];

/** Nova passagem de um turno e dia; `sector` preserva o ?setor= do admin. */
export function newHandoverHref(ref: HandoverRef, sector?: string): string {
  const base = `/passagens/nova?turno=${encodeURIComponent(ref.shiftId)}&data=${encodeURIComponent(ref.operationalDate)}`;
  return sector ? `${base}&setor=${encodeURIComponent(sector)}` : base;
}

/** Resumo da passagem, ou o formulário de edição (`?editar=1`). */
export function handoverHref(
  id: string,
  options: { edit?: boolean } = {},
): string {
  const base = `/passagens/${id}`;
  return options.edit ? `${base}?editar=1` : base;
}

export function chooseSectorPath(
  path: SectorPickerPath,
  sectorId: string,
): string {
  return `${path}?setor=${sectorId}`;
}
