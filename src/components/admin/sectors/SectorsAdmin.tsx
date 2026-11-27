import { AdminListRow } from "@/components/admin/AdminListRow";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { Pagination } from "@/components/admin/Pagination";
import { SectorCreateForm } from "@/components/admin/sectors/SectorCreateForm";
import { SectorRowActions } from "@/components/admin/sectors/SectorRowActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { parsePage } from "@/features/admin/pagination";
import {
  listSectors,
  suggestColorForNewSector,
} from "@/features/admin/sectors";
import { requireAdmin } from "@/lib/auth/session";
import { pluralize } from "@/lib/plural";

type SectorsAdminProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Lê tudo dentro do <Suspense> da página: o portão (requireAdmin) vem antes de
// qualquer leitura, e o título só aparece para quem passa por ele.
export async function SectorsAdmin({ searchParams }: SectorsAdminProps) {
  await requireAdmin();
  const params = await searchParams;
  const [data, suggestedColor] = await Promise.all([
    listSectors(db, { page: parsePage(params.pagina) }, new Date()),
    suggestColorForNewSector(db),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Setores"
        description="Onde cada pessoa trabalha. Turnos e itens são cadastrados por setor."
        backHref="/admin"
      />

      <Card>
        <CardHeader>
          <CardTitle>Novo setor</CardTitle>
        </CardHeader>
        <CardContent>
          <SectorCreateForm suggestedColor={suggestedColor} />
        </CardContent>
      </Card>

      {data.total === 0 ? (
        <EmptyState
          title="Nenhum setor ainda."
          description="Crie o primeiro setor acima para cadastrar turnos, itens e convidar operadores."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.rows.map((row) => (
            <AdminListRow
              key={row.id}
              title={row.name}
              inactive={!row.active}
              subtitle={`${pluralize(row.activePeople, "pessoa ativa", "pessoas ativas")} · ${pluralize(row.pendingInvites, "convite pendente", "convites pendentes")}`}
              actions={<SectorRowActions sector={row} />}
            />
          ))}
        </ul>
      )}

      <Pagination
        page={data.page}
        pageCount={data.pageCount}
        pathname="/admin/setores"
        params={{}}
      />
    </div>
  );
}
