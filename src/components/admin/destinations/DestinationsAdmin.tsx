import { AdminListRow } from "@/components/admin/AdminListRow";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DestinationCreateForm } from "@/components/admin/destinations/DestinationCreateForm";
import { DestinationRowActions } from "@/components/admin/destinations/DestinationRowActions";
import { EmptyState } from "@/components/admin/EmptyState";
import { Pagination } from "@/components/admin/Pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { listDestinations } from "@/features/admin/destinations";
import { parsePage } from "@/features/admin/pagination";
import { requireAdmin } from "@/lib/auth/session";

type DestinationsAdminProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function DestinationsAdmin({
  searchParams,
}: DestinationsAdminProps) {
  await requireAdmin();
  const params = await searchParams;
  const data = await listDestinations(db, { page: parsePage(params.pagina) });

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Destinos"
        description="Para onde os pedidos de material vão. Valem para todos os setores."
        backHref="/admin"
      />

      <Card>
        <CardHeader>
          <CardTitle>Novo destino</CardTitle>
        </CardHeader>
        <CardContent>
          <DestinationCreateForm />
        </CardContent>
      </Card>

      {data.total === 0 ? (
        <EmptyState
          title="Nenhum destino ainda."
          description="Crie o primeiro destino acima, por exemplo o almoxarifado."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.rows.map((row) => (
            <AdminListRow
              key={row.id}
              title={row.name}
              inactive={!row.active}
              actions={<DestinationRowActions destination={row} />}
            />
          ))}
        </ul>
      )}

      <Pagination
        page={data.page}
        pageCount={data.pageCount}
        pathname="/admin/destinos"
        params={{}}
      />
    </div>
  );
}
