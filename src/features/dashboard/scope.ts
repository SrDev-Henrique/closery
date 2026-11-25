import "server-only";

import type { Db } from "@/db/types";
import type { SectorChoice } from "@/features/admin/sectors";
import type { Authz } from "@/features/authz/authz";
import { parseHistoryPeriod } from "@/features/handovers/historyFilters";
import { todayInSaoPaulo } from "@/features/handovers/saoPaulo";
import { resolveScreenSector } from "@/features/handovers/screenSector";
import type { SearchParams } from "@/lib/searchParams";

import { periodDays, previousPeriod } from "./period";
import type { DashboardScope } from "./types";

export type DashboardScopeResult =
  | { kind: "none" } // admin sem setor ativo
  | { kind: "inactive" } // operador de setor inativo
  | { kind: "ok"; scope: DashboardScope; sectors: readonly SectorChoice[] };

// A única resolução de setor e período do dashboard: a página e o CSV chamam
// esta função. O operador sempre vê o próprio setor (o ?setor= é ignorado).
export async function resolveDashboardScope(
  db: Db,
  actor: Authz,
  params: SearchParams,
  now: Date,
): Promise<DashboardScopeResult> {
  const screen = await resolveScreenSector(db, actor, {
    url: params.setor,
    allowAll: true,
  });
  if (screen.kind === "none") return { kind: "none" };
  if (screen.kind === "missing" || screen.kind === "inactive") {
    return { kind: "inactive" };
  }

  const today = todayInSaoPaulo(now);
  const period = parseHistoryPeriod(params, today);
  return {
    kind: "ok",
    sectors: screen.sectors,
    scope: {
      sectorId: screen.sectorId,
      sectorName: screen.sectorName,
      sectorParam: screen.sectorParam,
      showSector: screen.kind === "all",
      period,
      previous: previousPeriod(period),
      days: periodDays(period),
      today,
    },
  };
}
