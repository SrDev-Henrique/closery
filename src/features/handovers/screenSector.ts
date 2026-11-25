import "server-only";

import type { Db } from "@/db/types";
import { listActiveSectors, type SectorChoice } from "@/features/admin/sectors";
import { type Authz, isAdmin } from "@/features/authz/authz";

import { ALL_SECTORS } from "./limits";
import { loadSector } from "./loaders";
import { resolveHandoverSector } from "./sectorChoice";
import { readRememberedSector } from "./sectorCookie";

/**
 * O setor que uma tela mostra, já resolvido para o papel de quem pede.
 * `missing` (o setor do operador não existe) e `inactive` ficam separados
 * porque cada tela já responde de um jeito a cada um.
 */
export type ScreenSector =
  | { kind: "none" }
  | { kind: "missing" }
  | { kind: "inactive" }
  | {
      kind: "sector";
      sectorId: string;
      sectorName: string;
      sectorParam: string | null;
      sectors: readonly SectorChoice[];
      cookie: string | undefined;
    }
  | {
      kind: "all";
      sectorId: null;
      sectorName: null;
      sectorParam: typeof ALL_SECTORS;
      sectors: readonly SectorChoice[];
      cookie: string | undefined;
    };

/**
 * Admin: escolhe pelo `?setor=`, pelo cookie ou o primeiro ativo ("todos" só
 * com `allowAll`). Operador: sempre o próprio setor, o `?setor=` nunca é lido.
 * Chame dentro de <Suspense> (lê o cookie).
 */
export async function resolveScreenSector(
  db: Db,
  actor: Authz,
  input: { url: string | string[] | undefined; allowAll: boolean },
): Promise<ScreenSector> {
  if (isAdmin(actor)) {
    const sectors = await listActiveSectors(db);
    const cookie = await readRememberedSector();
    const selection = resolveHandoverSector(
      sectors,
      { url: input.url, cookie },
      { allowAll: input.allowAll },
    );
    if (selection.kind === "none") return { kind: "none" };
    if (selection.kind === "all") {
      return {
        kind: "all",
        sectorId: null,
        sectorName: null,
        sectorParam: ALL_SECTORS,
        sectors,
        cookie,
      };
    }
    return {
      kind: "sector",
      sectorId: selection.sector.id,
      sectorName: selection.sector.name,
      sectorParam: selection.sector.id,
      sectors,
      cookie,
    };
  }

  const own = actor.sectorId
    ? await loadSector(db, actor, actor.sectorId)
    : null;
  if (!own) return { kind: "missing" };
  if (!own.active) return { kind: "inactive" };
  return {
    kind: "sector",
    sectorId: own.id,
    sectorName: own.name,
    sectorParam: null,
    sectors: [],
    cookie: undefined,
  };
}
