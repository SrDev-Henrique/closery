import Link from "next/link";

import { EmptyState } from "@/components/admin/EmptyState";
import { StockTrendChart } from "@/components/dashboard/StockTrendChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { type Authz, isAdmin } from "@/features/authz/authz";
import { lastCountHref } from "@/features/dashboard/links";
import { dashboardQueryOf } from "@/features/dashboard/period";
import { getStockData } from "@/features/dashboard/stock";
import type { DashboardScope } from "@/features/dashboard/types";
import { formatDateBR } from "@/features/handovers/saoPaulo";
import { formatInteger } from "@/lib/numberFormat";

const ALL_SECTORS_HINT = " Escolha um setor para ver todos.";

export async function DashboardStock({
  actor,
  scope,
}: {
  actor: Authz;
  scope: DashboardScope;
}) {
  const data = await getStockData(db, actor, dashboardQueryOf(scope));

  return (
    <section
      aria-labelledby="dashboard-stock-title"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="dashboard-stock-title" className="text-lg font-semibold">
          Estoque
        </h2>
        <p className="text-sm text-muted-foreground">
          Última contagem de cada item e a evolução no período.
        </p>
      </div>
      {data.items.length === 0 ? (
        <EmptyState
          title="Nenhum item de estoque."
          description="Os itens de estoque do setor aparecem aqui."
          action={
            isAdmin(actor)
              ? { label: "Ir para Itens", href: "/admin/itens" }
              : undefined
          }
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {data.items.map((item) => (
            <li key={item.itemId}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{item.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {item.unit}
                    {scope.showSector ? ` · ${item.sectorName}` : ""}
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {item.last === null ? (
                    <p className="text-sm text-muted-foreground">
                      Sem contagem
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <Link
                        href={lastCountHref(item.last.handoverId)}
                        className="w-fit text-2xl font-semibold tabular-nums underline-offset-4 hover:underline"
                      >
                        {`${formatInteger(item.last.quantity)} ${item.last.unit}`}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {`Contado em ${formatDateBR(item.last.operationalDate)}, ${item.last.shiftName}`}
                        {item.lastBeforePeriod ? " · antes do período" : ""}
                      </p>
                    </div>
                  )}
                  <StockTrendChart
                    label={item.name}
                    unit={item.unit}
                    points={item.points}
                  />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {data.totalItems > data.items.length && (
        <p className="text-xs text-muted-foreground">
          {`Mostrando ${formatInteger(data.items.length)} de ${formatInteger(data.totalItems)} itens.`}
          {scope.showSector ? ALL_SECTORS_HINT : ""}
        </p>
      )}
    </section>
  );
}
