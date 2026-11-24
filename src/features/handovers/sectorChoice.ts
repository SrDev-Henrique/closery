import type { SectorChoice } from "@/features/admin/sectors";

import { ALL_SECTORS } from "./limits";

export type SectorSelection =
  | { kind: "sector"; sector: SectorChoice }
  | { kind: "all" }
  | { kind: "none" };

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Setor que o admin vê: URL "todos" (só com allowAll) → todos; URL na lista →
 * ele; cookie na lista → ele; senão o primeiro da lista; lista vazia → none.
 * `sectors` são só os ativos. O operador não usa esta função: o setor dele é
 * actor.sectorId (a página confere se está ativo).
 */
export function resolveHandoverSector(
  sectors: readonly SectorChoice[],
  sources: { url: string | string[] | undefined; cookie: string | undefined },
  options: { allowAll?: boolean } = {},
): SectorSelection {
  const first = sectors[0];
  if (first === undefined) return { kind: "none" };

  const url = firstValue(sources.url);
  if (options.allowAll && url === ALL_SECTORS) return { kind: "all" };

  const fromUrl = sectors.find((sector) => sector.id === url);
  if (fromUrl) return { kind: "sector", sector: fromUrl };

  const fromCookie = sectors.find((sector) => sector.id === sources.cookie);
  if (fromCookie) return { kind: "sector", sector: fromCookie };

  return { kind: "sector", sector: first };
}
