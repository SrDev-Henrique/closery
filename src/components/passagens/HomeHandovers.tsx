import { notFound } from "next/navigation";

import { EmptyState } from "@/components/admin/EmptyState";
import { RequestsHomeCard } from "@/components/solicitacoes/RequestsHomeCard";
import { db } from "@/db";
import { getHomeHandovers } from "@/features/handovers/home";
import { resolveScreenSector } from "@/features/handovers/screenSector";
import { getHomeRequests } from "@/features/requests/home";
import { requestsHref } from "@/features/requests/urls";
import { requireUser } from "@/lib/auth/session";
import type { SearchParams } from "@/lib/searchParams";

import { MyShiftCard } from "./MyShiftCard";
import { PendingHandoverCard } from "./PendingHandoverCard";
import { SectorPicker } from "./SectorPicker";

type HomeHandoversProps = {
  searchParams: Promise<SearchParams>;
};

// Cartões do Início. Lê sessão, cookie e URL: só dentro de <Suspense>.
export async function HomeHandovers({ searchParams }: HomeHandoversProps) {
  const actor = await requireUser();
  const params = await searchParams;

  // Operador sempre usa o próprio setor (toAuthz garante que existe).
  if (actor.role !== "admin" && actor.sectorId === null) notFound();

  const screen = await resolveScreenSector(db, actor, {
    url: params.setor,
    allowAll: false,
  });
  if (screen.kind === "missing") notFound();
  if (screen.kind === "inactive") {
    return (
      <EmptyState
        title="Seu setor está inativo."
        description="Peça a um administrador para reativá-lo."
      />
    );
  }
  if (screen.kind !== "sector") {
    return (
      <EmptyState
        title="Nenhum setor ativo."
        description="Cadastre ou reative um setor para usar a passagem de turno."
        action={{ label: "Ir para Setores", href: "/admin/setores" }}
      />
    );
  }

  const { sectorId, sectorParam } = screen;
  const picker =
    sectorParam === null ? null : (
      <SectorPicker
        sectors={screen.sectors}
        selectedId={sectorParam}
        path="/"
      />
    );

  const now = new Date();
  const result = await getHomeHandovers(db, actor, sectorId, now);
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
  // O setor já foi validado (existe, é do ator e está ativo) pelo getHomeHandovers.
  const requests = await getHomeRequests(db, actor, home.sector.id, now);
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
      <RequestsHomeCard home={requests} allHref={requestsHref(sectorParam)} />
    </div>
  );
}
