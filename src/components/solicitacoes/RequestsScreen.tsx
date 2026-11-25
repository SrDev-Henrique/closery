import type { ReactNode } from "react";

import { EmptyState } from "@/components/admin/EmptyState";
import { SectorPicker } from "@/components/passagens/SectorPicker";
import { db } from "@/db";
import { isAdmin } from "@/features/authz/authz";
import { addDays, todayInSaoPaulo } from "@/features/handovers/saoPaulo";
import { resolveScreenSector } from "@/features/handovers/screenSector";
import { resolveHandoverSector } from "@/features/handovers/sectorChoice";
import {
  getRequestFormChoices,
  listFilterDestinations,
  listRequestCreators,
} from "@/features/requests/choices";
import { BOARD_MAX_LIMIT, DESTINATION_OTHER } from "@/features/requests/limits";
import { getRequestGroups, listRequestTable } from "@/features/requests/lists";
import {
  buildRequestsHref,
  clearFiltersHref,
  filtersActive,
  moreHref,
  parseRequestFilters,
  type RequestFilters,
  viewHrefs,
} from "@/features/requests/requestFilters";
import { boardSummary, tableSummary } from "@/features/requests/text";
import type { RequestGroups, RequestStatus } from "@/features/requests/types";
import { requireUser } from "@/lib/auth/session";
import { REQUEST_STATUSES } from "@/lib/requestStatuses";
import { paginationParams, type SearchParams } from "@/lib/searchParams";

import { NewRequestDialog } from "./NewRequestDialog";
import { RequestBoard } from "./RequestBoard";
import { RequestFiltersForm } from "./RequestFiltersForm";
import { RequestList } from "./RequestList";
import { RequestTable } from "./RequestTable";
import { RequestViewSwitcher } from "./RequestViewSwitcher";

type RequestsScreenProps = {
  searchParams: Promise<SearchParams>;
};

const TITLE = "Solicitações";

function Header({
  subtitle,
  action,
}: {
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{TITLE}</h1>
        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

function moreHrefs(
  groups: RequestGroups,
  filters: RequestFilters,
  extras: { sector?: string },
): Record<RequestStatus, string | null> {
  const result: Record<RequestStatus, string | null> = {
    requested: null,
    in_transit: null,
    delivered: null,
    cancelled: null,
  };
  for (const status of REQUEST_STATUSES) {
    const group = groups[status];
    result[status] =
      group.rows.length < group.total && group.limit < BOARD_MAX_LIMIT
        ? moreHref(filters, status, extras)
        : null;
  }
  return result;
}

export async function RequestsScreen({ searchParams }: RequestsScreenProps) {
  const actor = await requireUser();
  const params = await searchParams;
  const now = new Date();
  const today = todayInSaoPaulo(now);
  const parsed = parseRequestFilters(params, today);
  const admin = isAdmin(actor);

  // Admin escolhe o setor (ou "Todos os setores", sem cookie); operador usa o
  // próprio setor e nunca vê o seletor.
  const screen = await resolveScreenSector(db, actor, {
    url: params.setor,
    allowAll: true,
  });
  if (screen.kind === "none") {
    return (
      <div className="flex flex-col gap-6">
        <Header />
        <EmptyState
          title="Nenhum setor ativo."
          description="Cadastre ou reative um setor para usar as solicitações."
          action={{ label: "Ir para Setores", href: "/admin/setores" }}
        />
      </div>
    );
  }
  if (screen.kind === "missing" || screen.kind === "inactive") {
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

  const { sectorId, sectorParam, sectors, cookie } = screen;
  const picker: ReactNode =
    sectorParam === null ? null : (
      <SectorPicker
        sectors={sectors}
        selectedId={sectorParam}
        path="/solicitacoes"
        allowAll
      />
    );

  const [creators, destinations] = await Promise.all([
    listRequestCreators(db, actor, sectorId),
    listFilterDestinations(db),
  ]);

  // Quem criou e destino que o seletor não sabe mostrar viram "todos" antes da
  // consulta ("outro" é uma opção fixa, sempre vale).
  const filters: RequestFilters = {
    ...parsed,
    creatorId: creators.some((person) => person.id === parsed.creatorId)
      ? parsed.creatorId
      : null,
    destination:
      parsed.destination === DESTINATION_OTHER ||
      destinations.some((entry) => entry.id === parsed.destination)
        ? parsed.destination
        : null,
  };
  const extras = sectorParam === null ? {} : { sector: sectorParam };
  const showSector = admin && sectorId === null;

  const formSectors = showSector ? sectors : null;
  const initialSectorId =
    sectorId ??
    (() => {
      const first = resolveHandoverSector(sectors, { url: undefined, cookie });
      return first.kind === "sector" ? first.sector.id : "";
    })();
  const choices = await getRequestFormChoices(
    db,
    showSector ? sectors.map((entry) => entry.id) : [initialSectorId],
  );

  const input = { sectorId, filters };
  const table =
    filters.view === "table"
      ? await listRequestTable(db, actor, input, now)
      : null;
  const groups =
    table === null ? await getRequestGroups(db, actor, input, now) : null;

  const closedWindow = filters.period === "all";
  const subtitle =
    table !== null
      ? tableSummary(table.total)
      : groups !== null
        ? boardSummary(
            {
              requested: groups.requested.total,
              in_transit: groups.in_transit.total,
              delivered: groups.delivered.total,
            },
            closedWindow,
          )
        : undefined;
  const empty =
    table !== null
      ? table.total === 0
      : groups !== null &&
        REQUEST_STATUSES.every((status) => groups[status].total === 0);

  // Os filtros do formulário nunca começam em branco: o intervalo abre com a
  // última semana quando o período ainda é "Todo o período".
  const formFilters: RequestFilters = {
    ...filters,
    from: filters.from ?? addDays(today, -6),
    to: filters.to ?? today,
  };
  const hrefs = viewHrefs(filters, extras);

  let body: ReactNode;
  if (empty) {
    body = filtersActive(filters) ? (
      <EmptyState
        title="Nenhuma solicitação com esses filtros."
        description="Mude ou limpe os filtros para ver mais."
        action={{
          label: "Limpar filtros",
          href: clearFiltersHref(filters.view, extras),
        }}
      />
    ) : (
      <EmptyState
        title="Nenhuma solicitação para mostrar."
        description={
          table !== null
            ? "Use “Nova solicitação” para criar uma."
            : "Aparecem aqui as abertas e as entregues ou canceladas nos últimos 30 dias. Use “Nova solicitação” para criar uma."
        }
      />
    );
  } else if (table !== null) {
    body = (
      <RequestTable
        page={table}
        showSector={showSector}
        pageParams={paginationParams(buildRequestsHref(filters, extras))}
      />
    );
  } else if (groups !== null) {
    const more = moreHrefs(groups, filters, extras);
    const board = (
      <RequestBoard
        groups={groups}
        moreHrefs={more}
        showSector={showSector}
        closedWindow={closedWindow}
      />
    );
    const list = (
      <RequestList
        groups={groups}
        moreHrefs={more}
        showSector={showSector}
        closedWindow={closedWindow}
      />
    );
    // Sem `visao` o servidor não sabe a largura: as duas visões vão no DOM e o
    // CSS mostra a Lista abaixo de md e o Quadro de md em diante.
    body =
      filters.view === "board" ? (
        board
      ) : filters.view === "list" ? (
        list
      ) : (
        <>
          <div className="hidden md:block">{board}</div>
          <div className="md:hidden">{list}</div>
        </>
      );
  }

  return (
    <div className="flex flex-col gap-6">
      <Header
        subtitle={subtitle}
        action={
          <NewRequestDialog
            sectors={formSectors}
            initialSectorId={initialSectorId}
            choices={choices}
            originRef={null}
          />
        }
      />
      {picker}
      <RequestFiltersForm
        key={buildRequestsHref(filters, extras)}
        filters={formFilters}
        destinations={destinations}
        creators={creators}
        sectorParam={sectorParam}
      />
      {filters.view === null ? (
        <>
          <RequestViewSwitcher
            current="list"
            hrefs={hrefs}
            className="md:hidden"
          />
          <RequestViewSwitcher
            current="board"
            hrefs={hrefs}
            className="hidden md:flex"
          />
        </>
      ) : (
        <RequestViewSwitcher current={filters.view} hrefs={hrefs} />
      )}
      {body}
    </div>
  );
}
