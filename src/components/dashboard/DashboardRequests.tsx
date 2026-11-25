import { ClockAlert, PackageCheck, PackageOpen } from "lucide-react";

import { BarList } from "@/components/dashboard/BarList";
import { StatLink } from "@/components/dashboard/StatLink";
import { db } from "@/db";
import type { Authz } from "@/features/authz/authz";
import { formatDuration } from "@/features/dashboard/format";
import {
  deliveredRequestsHref,
  destinationDeliveriesHref,
  linkExtras,
  openRequestsHref,
  requestedItemHref,
  staleRequestsHref,
} from "@/features/dashboard/links";
import { dashboardQueryOf } from "@/features/dashboard/period";
import { getRequestsData } from "@/features/dashboard/requests";
import type { DashboardScope } from "@/features/dashboard/types";
import { formatInteger } from "@/lib/numberFormat";

const ALL_SECTORS_HINT = " Escolha um setor para ver todos.";

function count(value: number, singular: string, plural: string): string {
  return `${formatInteger(value)} ${value === 1 ? singular : plural}`;
}

export async function DashboardRequests({
  actor,
  scope,
  now,
}: {
  actor: Authz;
  scope: DashboardScope;
  now: Date;
}) {
  const data = await getRequestsData(db, actor, dashboardQueryOf(scope), now);
  const extras = linkExtras(scope.sectorParam);
  const { period } = scope;

  return (
    <section
      aria-labelledby="dashboard-requests-title"
      className="flex flex-col gap-4"
    >
      <h2 id="dashboard-requests-title" className="text-lg font-semibold">
        Solicitações
      </h2>
      <ul
        aria-label="Números das solicitações"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <li>
          <StatLink
            label="Abertas agora"
            value={data.open}
            href={openRequestsHref(extras)}
            icon={PackageOpen}
          />
        </li>
        <li>
          <StatLink
            label="Paradas agora"
            value={data.stale}
            href={staleRequestsHref(extras)}
            icon={ClockAlert}
            caption="há mais de 3 dias no mesmo status"
          />
        </li>
        <li>
          <StatLink
            label="Entregues no período"
            value={data.deliveredInPeriod}
            href={deliveredRequestsHref(period, extras)}
            icon={PackageCheck}
          />
        </li>
      </ul>
      <div className="flex flex-col gap-2">
        <h3 className="text-base font-medium">
          Tempo até a entrega por destino
        </h3>
        <BarList
          label="Tempo até a entrega por destino"
          bars
          emptyText="Nenhuma entrega no período."
          moreText={
            data.totalDestinations > data.destinations.length
              ? `Mostrando ${formatInteger(data.destinations.length)} de ${formatInteger(data.totalDestinations)} destinos.`
              : null
          }
          rows={data.destinations.map((destination) => ({
            key: destination.key,
            label: destination.name,
            value: destination.averageSeconds,
            valueText: formatDuration(destination.averageSeconds),
            detail: count(destination.deliveredCount, "entregue", "entregues"),
            href: destinationDeliveriesHref(period, destination.key, extras),
          }))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-medium">Quantidade pedida por item</h3>
          <p className="text-sm text-muted-foreground">
            Das solicitações criadas no período, sem as canceladas.
          </p>
        </div>
        <BarList
          label="Quantidade pedida por item"
          bars={false}
          emptyText="Nenhum item pedido no período."
          moreText={
            data.totalItems > data.items.length
              ? `Mostrando ${formatInteger(data.items.length)} de ${formatInteger(data.totalItems)} itens.${scope.showSector ? ALL_SECTORS_HINT : ""}`
              : null
          }
          rows={data.items.map((item) => ({
            key: item.itemId,
            label: item.name,
            context: scope.showSector ? item.sectorName : null,
            value: item.quantity,
            valueText: `${formatInteger(item.quantity)} ${item.unit}`,
            detail: `em ${count(item.requestCount, "solicitação", "solicitações")}`,
            href: requestedItemHref(period, item.itemId, extras),
          }))}
        />
      </div>
    </section>
  );
}
