import { TriangleAlert } from "lucide-react";

import { AdminListRow } from "@/components/admin/AdminListRow";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { Pagination } from "@/components/admin/Pagination";
import { SectorSwitcher } from "@/components/admin/SectorSwitcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { parsePage } from "@/features/admin/pagination";
import {
  listActiveSectors,
  resolveSectorFilter,
} from "@/features/admin/sectors";
import { formatOverlapWarning } from "@/features/admin/shiftRules";
import { getShiftFormDefaults, listShifts } from "@/features/admin/shifts";
import { requireAdmin } from "@/lib/auth/session";

import { ShiftForm } from "./ShiftForm";
import { ShiftRowActions } from "./ShiftRowActions";

type ShiftsAdminProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const TITLE = "Turnos";
const DESCRIPTION =
  "Horários de cada setor. Um turno pode passar da meia-noite.";

export async function ShiftsAdmin({ searchParams }: ShiftsAdminProps) {
  await requireAdmin();
  const params = await searchParams;
  const sectors = await listActiveSectors(db);
  const selected = resolveSectorFilter(sectors, params.setor);

  if (!selected) {
    return (
      <div className="flex flex-col gap-6">
        <AdminPageHeader
          title={TITLE}
          description={DESCRIPTION}
          backHref="/admin"
        />
        <EmptyState
          title="Nenhum setor ativo."
          description="Cadastre ou reative um setor para criar turnos."
          action={{ label: "Ir para Setores", href: "/admin/setores" }}
        />
      </div>
    );
  }

  const [page, defaults] = await Promise.all([
    listShifts(db, { sectorId: selected.id, page: parsePage(params.pagina) }),
    getShiftFormDefaults(db, selected.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title={TITLE}
        description={DESCRIPTION}
        backHref="/admin"
      />
      <SectorSwitcher
        sectors={sectors}
        selectedId={selected.id}
        pathname="/admin/turnos"
      />

      <Card>
        <CardHeader>
          <CardTitle>Novo turno</CardTitle>
        </CardHeader>
        <CardContent>
          <ShiftForm
            // Novo padrão depois de cada criação: remonta o formulário.
            key={`${selected.id}-${defaults.name}-${defaults.startsAt}-${defaults.endsAt}`}
            sectorId={selected.id}
            initial={defaults}
            submitLabel="Criar turno"
          />
        </CardContent>
      </Card>

      {page.rows.length === 0 ? (
        <EmptyState
          title="Nenhum turno neste setor."
          description="Crie o primeiro turno acima. A passagem de turno usa esses horários."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {page.rows.map((shift) => (
            <AdminListRow
              key={shift.id}
              title={shift.name}
              inactive={!shift.active}
              subtitle={
                <span className="tabular-nums">
                  {shift.startsAt}–{shift.endsAt}
                </span>
              }
              badges={
                shift.crossesMidnight ? (
                  <Badge variant="outline">Atravessa a meia-noite</Badge>
                ) : undefined
              }
              notes={
                shift.overlaps.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {shift.overlaps.map((warning) => (
                      <li
                        key={warning.shiftId}
                        className="flex items-center gap-1.5 text-sm text-warning-foreground"
                      >
                        <TriangleAlert aria-hidden="true" className="size-4" />
                        {formatOverlapWarning(warning)}
                      </li>
                    ))}
                  </ul>
                ) : undefined
              }
              actions={<ShiftRowActions shift={shift} />}
            />
          ))}
        </ul>
      )}

      <Pagination
        page={page.page}
        pageCount={page.pageCount}
        pathname="/admin/turnos"
        params={{ setor: selected.id }}
      />
    </div>
  );
}
