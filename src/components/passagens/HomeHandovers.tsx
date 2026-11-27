import { cn } from "cn";
import { ChartColumn } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/admin/EmptyState";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/db";
import {
  readInviteCardDismissed,
  shouldShowInviteCard,
} from "@/features/admin/firstAccess";
import { getAdminOverviewCounts } from "@/features/admin/overview";
import { getHomeHandovers } from "@/features/handovers/home";
import { resolveScreenSector } from "@/features/handovers/screenSector";
import { getHomeRequests } from "@/features/requests/home";
import { requireUser } from "@/lib/auth/session";
import type { SearchParams } from "@/lib/searchParams";

import { HomeCards } from "./HomeCards";
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
  const isAdmin = actor.role === "admin";
  // Primeiro acesso (spec §5.3): só o admin paga as contagens e lê o cookie
  // de dispensa (`readInviteCardDismissed`, Task 10: só o valor "1" dispensa).
  const [requests, counts, dismissed] = await Promise.all([
    getHomeRequests(db, actor, home.sector.id, now),
    isAdmin ? getAdminOverviewCounts(db, now) : Promise.resolve(null),
    isAdmin ? readInviteCardDismissed() : Promise.resolve(false),
  ]);
  // "Agora não" some só com o cartão; a linha de apoio das solicitações vazias
  // continua enquanto for o primeiro acesso (é o que o protótipo faz).
  const firstAccess =
    counts !== null &&
    shouldShowInviteCard({ isAdmin, counts, dismissed: false });
  const inviteCounts =
    counts !== null && shouldShowInviteCard({ isAdmin, counts, dismissed })
      ? counts
      : null;
  return (
    <HomeFrame
      lead={
        picker ?? (
          <SectorPill name={home.sector.name} color={home.sector.color} />
        )
      }
    >
      {/* Os cartões (convite, pendente e o grid turno + solicitações) são do
          HomeCards, que mantém o `data-slot="home-cards"`. */}
      <HomeCards
        home={home}
        requests={requests}
        sectorParam={sectorParam}
        canManageCatalog={isAdmin}
        actorId={actor.userId}
        inviteCounts={inviteCounts}
        firstAccess={firstAccess}
      />
    </HomeFrame>
  );
}
