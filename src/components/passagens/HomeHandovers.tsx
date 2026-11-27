import { cn } from "cn";
import { ChartColumn } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/admin/EmptyState";
import { RequestsHomeCard } from "@/components/solicitacoes/RequestsHomeCard";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/db";
import { getHomeHandovers } from "@/features/handovers/home";
import { resolveScreenSector } from "@/features/handovers/screenSector";
import { getHomeRequests } from "@/features/requests/home";
import { requestsHref } from "@/features/requests/urls";
import { requireUser } from "@/lib/auth/session";
import { avatarDataUri } from "@/lib/avatar";
import type { SearchParams } from "@/lib/searchParams";

import { MyShiftCard } from "./MyShiftCard";
import { PendingHandoverCard } from "./PendingHandoverCard";
import { SectorPicker } from "./SectorPicker";
import { SectorPill } from "./SectorPill";

type HomeHandoversProps = {
  searchParams: Promise<SearchParams>;
};

// Linha de baixo do hero (spec §6.2): o seletor do admin ou a pílula do
// operador à esquerda e "Ver o dashboard" à direita. O espaçamento do
// protótipo vem daqui: 32px de gap em cima (pt-8; 24px no celular) e 40px de
// padding embaixo (pb-10; 28px) — o resto do hero (28px de topo, eyebrow e
// título) é do `Greeting`. Sem `lead` (erros), só o botão do dashboard.
function HeroRow({ lead }: { lead: ReactNode }) {
  return (
    <div
      data-slot="home-hero-row"
      className="flex flex-wrap items-center justify-between gap-4 pt-8 pb-10 max-md:pt-6 max-md:pb-7"
    >
      {lead}
      {/* 20px de padding (protótipo): o `cn` troca o `px-[22px]` do `pill`. */}
      <Link
        href="/dashboard"
        className={cn(
          buttonVariants({ variant: "surface", size: "pill" }),
          "px-5",
          "ml-auto",
        )}
      >
        <ChartColumn aria-hidden="true" strokeWidth={2.2} />
        Ver o dashboard
      </Link>
    </div>
  );
}

function HomeFrame({
  lead = null,
  children,
}: {
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <HeroRow lead={lead} />
      {children}
    </>
  );
}

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
      <HomeFrame>
        <EmptyState
          title="Seu setor está inativo."
          description="Peça a um administrador para reativá-lo."
        />
      </HomeFrame>
    );
  }
  if (screen.kind !== "sector") {
    return (
      <HomeFrame>
        <EmptyState
          title="Nenhum setor ativo."
          description="Cadastre ou reative um setor para usar a passagem de turno."
          action={{ label: "Ir para Setores", href: "/admin/setores" }}
        />
      </HomeFrame>
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
      <HomeFrame>
        <EmptyState
          title="Seu setor está inativo."
          description="Peça a um administrador para reativá-lo."
        />
      </HomeFrame>
    );
  }

  const { home } = result;
  // O setor já foi validado (existe, é do ator e está ativo) pelo getHomeHandovers.
  const requests = await getHomeRequests(db, actor, home.sector.id, now);
  return (
    <HomeFrame
      lead={
        picker ?? (
          <SectorPill name={home.sector.name} color={home.sector.color} />
        )
      }
    >
      {/* Ponto de extensão do Início: aqui entram o convite (antes do pendente) e o
          grid de 2 colunas (no lugar dos dois cartões finais). */}
      <div data-slot="home-cards" className="flex flex-col gap-4">
        {home.pending && (
          <PendingHandoverCard
            pending={home.pending}
            avatarSrc={avatarDataUri(home.pending.deliveredById)}
          />
        )}
        <MyShiftCard
          state={home.mine}
          sectorId={home.sector.id}
          sectorName={home.sector.name}
          sectorColor={home.sector.color}
          canManageCatalog={actor.role === "admin"}
          sectorParam={sectorParam}
          avatarSrc={
            home.mine.kind === "continue" && home.mine.saved
              ? avatarDataUri(home.mine.saved.byId)
              : null
          }
        />
        <RequestsHomeCard home={requests} allHref={requestsHref(sectorParam)} />
      </div>
    </HomeFrame>
  );
}
