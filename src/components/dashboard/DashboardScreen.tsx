import { type ReactNode, Suspense } from "react";

import { EmptyState } from "@/components/admin/EmptyState";
import { DashboardBlockBoundary } from "@/components/dashboard/DashboardBlockBoundary";
import { DashboardBlockSkeleton } from "@/components/dashboard/DashboardBlockSkeleton";
import { DashboardControls } from "@/components/dashboard/DashboardControls";
import { DashboardPassages } from "@/components/dashboard/DashboardPassages";
import { DashboardPeriodPicker } from "@/components/dashboard/DashboardPeriodPicker";
import { DashboardRequests } from "@/components/dashboard/DashboardRequests";
import { DashboardStock } from "@/components/dashboard/DashboardStock";
import { ExportCsvLink } from "@/components/dashboard/ExportCsvLink";
import { SectorPicker } from "@/components/passagens/SectorPicker";
import { db } from "@/db";
import { linkExtras } from "@/features/dashboard/links";
import {
  buildDashboardHref,
  dashboardExportHref,
  formatPeriodLabel,
} from "@/features/dashboard/period";
import { resolveDashboardScope } from "@/features/dashboard/scope";
import { requireUser } from "@/lib/auth/session";
import { hrefQuery, type SearchParams } from "@/lib/searchParams";

type DashboardScreenProps = {
  searchParams: Promise<SearchParams>;
};

const TITLE = "Dashboard";

function Header({
  children,
  action,
}: {
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{TITLE}</h1>
        {children}
      </div>
      {action}
    </header>
  );
}

export async function DashboardScreen({ searchParams }: DashboardScreenProps) {
  const actor = await requireUser();
  const params = await searchParams;
  const now = new Date();
  const resolved = await resolveDashboardScope(db, actor, params, now);

  if (resolved.kind === "none") {
    return (
      <div className="flex flex-col gap-6">
        <Header />
        <EmptyState
          title="Nenhum setor ativo."
          description="Cadastre ou reative um setor para ver o dashboard."
          action={{ label: "Ir para Setores", href: "/admin/setores" }}
        />
      </div>
    );
  }
  if (resolved.kind === "inactive") {
    return (
      <div className="flex flex-col gap-6">
        <Header />
        <EmptyState
          title="Seu setor está inativo."
          description="Peça a um administrador para reativá-lo."
        />
      </div>
    );
  }

  const { scope, sectors } = resolved;
  const extras = linkExtras(scope.sectorParam);
  // O limite de cada bloco remonta quando o período ou o setor mudam: o
  // catchError só limpa o erro quando muda o pathname, e ?periodo=/?setor= não
  // mudam o pathname.
  const blockKey = buildDashboardHref(scope.period, extras);

  return (
    <div className="flex flex-col gap-6">
      <Header
        action={
          <ExportCsvLink href={dashboardExportHref(scope.period, extras)} />
        }
      >
        <p className="text-muted-foreground">
          {formatPeriodLabel(scope.period, scope.today)}
        </p>
      </Header>
      {scope.sectorParam !== null && sectors.length > 0 && (
        <SectorPicker
          sectors={sectors}
          selectedId={scope.sectorParam}
          path="/dashboard"
          allowAll
          query={hrefQuery(buildDashboardHref(scope.period))}
        />
      )}
      <DashboardPeriodPicker
        key={blockKey}
        period={scope.period}
        today={scope.today}
        sectorParam={scope.sectorParam}
      />
      <DashboardBlockBoundary key={`Passagens:${blockKey}`} title="Passagens">
        <Suspense fallback={<DashboardBlockSkeleton title="Passagens" />}>
          <DashboardPassages actor={actor} scope={scope} now={now} />
        </Suspense>
      </DashboardBlockBoundary>
      <DashboardBlockBoundary key={`Controles:${blockKey}`} title="Controles">
        <Suspense fallback={<DashboardBlockSkeleton title="Controles" />}>
          <DashboardControls actor={actor} scope={scope} />
        </Suspense>
      </DashboardBlockBoundary>
      <DashboardBlockBoundary key={`Estoque:${blockKey}`} title="Estoque">
        <Suspense fallback={<DashboardBlockSkeleton title="Estoque" />}>
          <DashboardStock actor={actor} scope={scope} />
        </Suspense>
      </DashboardBlockBoundary>
      <DashboardBlockBoundary
        key={`Solicitações:${blockKey}`}
        title="Solicitações"
      >
        <Suspense fallback={<DashboardBlockSkeleton title="Solicitações" />}>
          <DashboardRequests actor={actor} scope={scope} now={now} />
        </Suspense>
      </DashboardBlockBoundary>
    </div>
  );
}
