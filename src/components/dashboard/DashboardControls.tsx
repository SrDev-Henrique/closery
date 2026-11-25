import { EmptyState } from "@/components/admin/EmptyState";
import {
  segmentStroke,
  segmentSwatch,
} from "@/components/dashboard/chartColors";
import { MetricCard } from "@/components/kokonutui/metric-card";
import { db } from "@/db";
import { type Authz, isAdmin } from "@/features/authz/authz";
import { getControlsData } from "@/features/dashboard/controls";
import { computeDelta } from "@/features/dashboard/delta";
import { linkExtras, passagesListHref } from "@/features/dashboard/links";
import { dashboardQueryOf } from "@/features/dashboard/period";
import type { DashboardScope } from "@/features/dashboard/types";
import { formatInteger } from "@/lib/numberFormat";

const ALL_SECTORS_HINT = " Escolha um setor para ver todos.";

export async function DashboardControls({
  actor,
  scope,
}: {
  actor: Authz;
  scope: DashboardScope;
}) {
  const data = await getControlsData(db, actor, dashboardQueryOf(scope));
  const { period } = scope;

  return (
    <section
      aria-labelledby="dashboard-controls-title"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="dashboard-controls-title" className="text-lg font-semibold">
          Controles
        </h2>
        <p className="text-sm text-muted-foreground">
          Itens de controle: total do período, média por turno e comparação com
          o período anterior.
        </p>
      </div>
      {data.items.length === 0 ? (
        <EmptyState
          title="Nenhum item de controle."
          description="Os itens de controle do setor aparecem aqui."
          action={
            isAdmin(actor)
              ? { label: "Ir para Itens", href: "/admin/itens" }
              : undefined
          }
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {data.items.map((item) => {
            // O cartão é de um setor: em "Todos os setores" o link vai para o
            // setor do item, nunca para `setor=todos` (F5-17).
            const extras = linkExtras(
              scope.sectorParam === null ? null : item.sectorId,
            );
            return (
              <li key={`${item.itemId}:${period.from}:${period.to}`}>
                <MetricCard
                  label={item.name}
                  unit={item.unit}
                  context={scope.showSector ? item.sectorName : null}
                  periodDays={scope.days}
                  total={item.total}
                  average={item.average}
                  handoverCount={item.handoverCount}
                  delta={computeDelta(item.total, item.previousTotal)}
                  href={passagesListHref(period, "delivered", {
                    ...extras,
                    itemId: item.itemId,
                  })}
                  segments={item.segments.map((segment) => ({
                    key: segment.key,
                    label: segment.label,
                    swatchClass: segmentSwatch(segment.slot),
                    strokeClass: segmentStroke(segment.slot),
                    total: segment.total,
                    previousTotal: segment.previousTotal,
                    href: passagesListHref(period, "delivered", {
                      ...extras,
                      itemId: item.itemId,
                      shiftId: segment.shiftId,
                    }),
                  }))}
                  series={item.series}
                />
              </li>
            );
          })}
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
