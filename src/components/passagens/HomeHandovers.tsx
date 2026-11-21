import { notFound } from "next/navigation";

import { EmptyState } from "@/components/admin/EmptyState";
import { db } from "@/db";
import { listActiveSectors } from "@/features/admin/sectors";
import { getHomeHandovers } from "@/features/handovers/home";
import { resolveHandoverSector } from "@/features/handovers/sectorChoice";
import { readRememberedSector } from "@/features/handovers/sectorCookie";
import { requireUser } from "@/lib/auth/session";

import { MyShiftCard } from "./MyShiftCard";
import { PendingHandoverCard } from "./PendingHandoverCard";
import { SectorPicker } from "./SectorPicker";

type HomeHandoversProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Cartões do Início. Lê sessão, cookie e URL: só dentro de <Suspense>.
export async function HomeHandovers({ searchParams }: HomeHandoversProps) {
  const actor = await requireUser();
  const params = await searchParams;

  let sectorId: string;
  let picker: React.ReactNode = null;
  let sectorParam: string | null = null;

  if (actor.role === "admin") {
    const sectors = await listActiveSectors(db);
    const selection = resolveHandoverSector(sectors, {
      url: params.setor,
      cookie: await readRememberedSector(),
    });
    if (selection.kind !== "sector") {
      return (
        <EmptyState
          title="Nenhum setor ativo."
          description="Cadastre ou reative um setor para usar a passagem de turno."
          action={{ label: "Ir para Setores", href: "/admin/setores" }}
        />
      );
    }
    sectorId = selection.sector.id;
    sectorParam = selection.sector.id;
    picker = (
      <SectorPicker
        sectors={sectors}
        selectedId={selection.sector.id}
        path="/"
      />
    );
  } else {
    // Operador sempre usa o próprio setor (toAuthz garante que existe).
    if (actor.sectorId === null) notFound();
    sectorId = actor.sectorId;
  }

  const result = await getHomeHandovers(db, actor, sectorId, new Date());
  if (!result.ok) {
    if (result.code !== "SECTOR_INACTIVE") notFound();
    return (
      <EmptyState
        title="Seu setor está inativo."
        description="Peça a um administrador para reativá-lo."
      />
    );
  }

  const { home } = result;
  return (
    <div className="flex flex-col gap-4">
      {picker}
      {home.pending && <PendingHandoverCard pending={home.pending} />}
      <MyShiftCard
        state={home.mine}
        sectorId={home.sector.id}
        canManageCatalog={actor.role === "admin"}
        sectorParam={sectorParam}
      />
    </div>
  );
}
