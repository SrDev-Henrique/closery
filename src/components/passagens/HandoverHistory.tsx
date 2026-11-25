import { EmptyState } from "@/components/admin/EmptyState";
import { Pagination } from "@/components/admin/Pagination";
import { HistoryFilters } from "@/components/passagens/HistoryFilters";
import { HistoryRowItem } from "@/components/passagens/HistoryRowItem";
import { SectorPicker } from "@/components/passagens/SectorPicker";
import { db } from "@/db";
import { parsePage } from "@/features/admin/pagination";
import { isAdmin } from "@/features/authz/authz";
import { listHandoverHistory } from "@/features/handovers/history";
import {
  buildHistoryHref,
  parseHistoryFilters,
} from "@/features/handovers/historyFilters";
import { MAX_DAYS_BACK } from "@/features/handovers/limits";
import {
  addDays,
  formatDateBR,
  todayInSaoPaulo,
} from "@/features/handovers/saoPaulo";
import { resolveScreenSector } from "@/features/handovers/screenSector";
import { listActiveShifts } from "@/features/handovers/targets";
import { requireUser } from "@/lib/auth/session";
import { paginationParams, type SearchParams } from "@/lib/searchParams";

type HandoverHistoryProps = {
  searchParams: Promise<SearchParams>;
};

const TITLE = "Passagens";
const DESCRIPTION =
  "Histórico de passagens de turno, do dia mais recente ao mais antigo.";

function Header() {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{TITLE}</h1>
      <p className="text-muted-foreground">{DESCRIPTION}</p>
    </header>
  );
}

export async function HandoverHistory({ searchParams }: HandoverHistoryProps) {
  const actor = await requireUser();
  const params = await searchParams;
  const now = new Date();
  const filters = parseHistoryFilters(params, todayInSaoPaulo(now));
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
          description="Cadastre ou reative um setor para usar a passagem de turno."
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

  const { sectorId, sectorParam } = screen;
  const picker =
    sectorParam === null ? null : (
      <SectorPicker
        sectors={screen.sectors}
        selectedId={sectorParam}
        path="/passagens"
        allowAll
      />
    );

  const [history, shifts] = await Promise.all([
    listHandoverHistory(
      db,
      actor,
      { filters, sectorId, page: parsePage(params.pagina) },
      now,
    ),
    sectorId === null ? Promise.resolve([]) : listActiveShifts(db, sectorId),
  ]);

  const extras = sectorParam === null ? {} : { sector: sectorParam };
  const showSector = admin && sectorId === null;
  const minDate = addDays(todayInSaoPaulo(now), -MAX_DAYS_BACK);

  return (
    <div className="flex flex-col gap-6">
      <Header />
      {picker}
      <HistoryFilters
        key={buildHistoryHref(filters, extras)}
        filters={filters}
        shifts={shifts}
        sectorParam={sectorParam}
      />
      <p className="text-sm text-muted-foreground">
        Período:{" "}
        <span className="tabular-nums">
          {formatDateBR(filters.from)} a {formatDateBR(filters.to)}
        </span>
      </p>
      {history.rows.length === 0 ? (
        <EmptyState
          title="Nenhuma passagem neste período."
          description="Mude o período ou os filtros para ver mais."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {history.rows.map((row) => (
            <HistoryRowItem
              key={row.key}
              row={row}
              showSector={showSector}
              sectorParam={sectorParam}
              minDate={minDate}
            />
          ))}
        </ul>
      )}
      <Pagination
        page={history.page}
        pageCount={history.pageCount}
        pathname="/passagens"
        params={paginationParams(buildHistoryHref(filters, extras))}
      />
    </div>
  );
}
