import { AdminListRow } from "@/components/admin/AdminListRow";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { Pagination } from "@/components/admin/Pagination";
import { SectorSwitcher } from "@/components/admin/SectorSwitcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import {
  ITEM_FORM_DEFAULTS,
  ITEM_KIND_LABELS,
  ITEM_UNIT_LABELS,
  OTHER_UNIT,
  splitUnit,
} from "@/features/admin/itemOptions";
import { listItems } from "@/features/admin/items";
import { parsePage } from "@/features/admin/pagination";
import {
  listActiveSectors,
  resolveSectorFilter,
} from "@/features/admin/sectors";
import { requireAdmin } from "@/lib/auth/session";

import { ItemForm } from "./ItemForm";
import { ItemRowActions } from "./ItemRowActions";

// Mostra o rótulo da lista ("Rolo"), igual ao select; "Outro" mostra o texto gravado.
function unitLabel(unit: string): string {
  const { choice } = splitUnit(unit);
  return choice === OTHER_UNIT ? unit : ITEM_UNIT_LABELS[choice];
}

type ItemsAdminProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const TITLE = "Itens";
const DESCRIPTION = "O que se conta na passagem de cada setor.";

export async function ItemsAdmin({ searchParams }: ItemsAdminProps) {
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
          description="Cadastre ou reative um setor para criar itens."
          action={{ label: "Ir para Setores", href: "/admin/setores" }}
        />
      </div>
    );
  }

  const page = await listItems(db, {
    sectorId: selected.id,
    page: parsePage(params.pagina),
  });

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
        pathname="/admin/itens"
      />

      <Card>
        <CardHeader>
          <CardTitle>Novo item</CardTitle>
        </CardHeader>
        <CardContent>
          <ItemForm
            // Formulário limpo (nome vazio, padrões) depois de cada criação.
            key={`${selected.id}-${page.total}`}
            sectorId={selected.id}
            initial={ITEM_FORM_DEFAULTS}
            submitLabel="Criar item"
          />
        </CardContent>
      </Card>

      {page.rows.length === 0 ? (
        <EmptyState
          title="Nenhum item neste setor."
          description="Crie o primeiro item acima. É o que o operador conta na passagem."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {page.rows.map((item) => (
            <AdminListRow
              key={item.id}
              title={item.name}
              inactive={!item.active}
              subtitle={unitLabel(item.unit)}
              badges={
                <Badge variant="outline">{ITEM_KIND_LABELS[item.kind]}</Badge>
              }
              actions={<ItemRowActions item={item} />}
            />
          ))}
        </ul>
      )}

      <Pagination
        page={page.page}
        pageCount={page.pageCount}
        pathname="/admin/itens"
        params={{ setor: selected.id }}
      />
    </div>
  );
}
