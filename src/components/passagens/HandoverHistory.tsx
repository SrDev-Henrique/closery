import { EmptyState } from "@/components/admin/EmptyState";
import { Pagination } from "@/components/admin/Pagination";
import { HistoryFilters } from "@/components/passagens/HistoryFilters";
import { HistoryRowItem } from "@/components/passagens/HistoryRowItem";
import { SectorPicker } from "@/components/passagens/SectorPicker";
import { db } from "@/db";
import { parsePage } from "@/features/admin/pagination";
import { listActiveSectors } from "@/features/admin/sectors";
import { isAdmin } from "@/features/authz/authz";
import { listHandoverHistory } from "@/features/handovers/history";
import {
  buildHistoryHref,
  parseHistoryFilters,
} from "@/features/handovers/historyFilters";
import { ALL_SECTORS } from "@/features/handovers/limits";
import { loadSector } from "@/features/handovers/loaders";
import { formatDateBR, todayInSaoPaulo } from "@/features/handovers/saoPaulo";
import { resolveHandoverSector } from "@/features/handovers/sectorChoice";
import { readRememberedSector } from "@/features/handovers/sectorCookie";
import { listActiveShifts } from "@/features/handovers/targets";
import { requireUser } from "@/lib/auth/session";

type HandoverHistoryProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

// Os filtros que a Pagination preserva: a mesma URL que buildHistoryHref monta.
function paginationParams(href: string): Record<string, string> {
  return Object.fromEntries(new URL(href, "http://closery.local").searchParams);
}

export async function HandoverHistory({ searchParams }: HandoverHistoryProps) {
  const actor = await requireUser();
  const params = await searchParams;
  const now = new Date();
  const filters = parseHistoryFilters(params, todayInSaoPaulo(now));
  const admin = isAdmin(actor);

  // Admin escolhe o setor (ou "Todos os setores", sem cookie); operador usa o
  // próprio setor e nunca vê o seletor.
  let sectorId: string | null = null;
  let sectorParam: string | null = null;
  let picker: React.ReactNode = null;

  if (admin) {
    const sectors = await listActiveSectors(db);
    const selection = resolveHandoverSector(
      sectors,
      { url: params.setor, cookie: await readRememberedSector() },
      { allowAll: true },
    );
    if (selection.kind === "none") {
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
    sectorId = selection.kind === "sector" ? selection.sector.id : null;
    sectorParam =
      selection.kind === "sector" ? selection.sector.id : ALL_SECTORS;
    picker = (
      <SectorPicker
        sectors={sectors}
        selectedId={sectorParam}
        path="/passagens"
        allowAll
      />
    );
  } else {
    const own = actor.sectorId
      ? await loadSector(db, actor, actor.sectorId)
      : null;
    if (!own?.active) {
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
    sectorId = own.id;
  }

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

  return (
    <div className="flex flex-col gap-6">
      <Header />
      {picker}
      <HistoryFilters
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
