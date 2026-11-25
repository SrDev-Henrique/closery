import type { DashboardScope } from "@/features/dashboard/types";

import type { DashboardWorld } from "./dashboardWorld";

type Sector = { id: string; name: string };

// O escopo que `resolveDashboardScope` devolveria para o mundo, montado à mão
// para os testes dos blocos (eles recebem o escopo pronto por prop):
// - "operator": o operador do setor (sem ?setor= nos links);
// - "admin": o admin com um setor escolhido (sectorParam = id);
// - "all": o admin em "Todos os setores" (sectorParam "todos", showSector).
export function worldScope(
  world: DashboardWorld,
  who: "operator" | "admin" | "all",
  sector: Sector = world.uld,
  overrides: Partial<DashboardScope> = {},
): DashboardScope {
  const common = {
    period: world.period,
    previous: world.previous,
    days: 7,
    today: world.today,
  };
  if (who === "all") {
    return {
      ...common,
      sectorId: null,
      sectorName: null,
      sectorParam: "todos",
      showSector: true,
      ...overrides,
    };
  }
  return {
    ...common,
    sectorId: sector.id,
    sectorName: sector.name,
    sectorParam: who === "admin" ? sector.id : null,
    showSector: false,
    ...overrides,
  };
}
