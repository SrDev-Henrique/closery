import { CalendarClock, Send } from "lucide-react";

import { EmptyState } from "@/components/admin/EmptyState";
import { SITUATION_CHART } from "@/components/dashboard/chartColors";
import { StatLink } from "@/components/dashboard/StatLink";
import { SpendingRing } from "@/components/kokonutui/spending-ring";
import { SITUATION_STYLE } from "@/components/passagens/HandoverStatusBadge";
import { db } from "@/db";
import type { Authz } from "@/features/authz/authz";
import { linkExtras, passagesListHref } from "@/features/dashboard/links";
import { getPassagesData } from "@/features/dashboard/passages";
import { dashboardQueryOf } from "@/features/dashboard/period";
import type { DashboardScope } from "@/features/dashboard/types";
import type { HistorySituation } from "@/features/handovers/status";

// Os rótulos no plural do bloco; o selo da lista que o link abre diz o mesmo
// no singular. Ordem fixa da entidade (a do anel).
const SITUATIONS: readonly { situation: HistorySituation; label: string }[] = [
  { situation: "confirmed", label: "Confirmadas" },
  { situation: "awaiting", label: "Aguardando recebimento" },
  { situation: "unconfirmed", label: "Não confirmadas" },
  { situation: "missing", label: "Sem passagem" },
];

export async function DashboardPassages({
  actor,
  scope,
  now,
}: {
  actor: Authz;
  scope: DashboardScope;
  now: Date;
}) {
  const data = await getPassagesData(db, actor, dashboardQueryOf(scope), now);
  const extras = linkExtras(scope.sectorParam);
  const { period } = scope;

  return (
    <section
      aria-labelledby="dashboard-passages-title"
      className="flex flex-col gap-4"
    >
      <h2 id="dashboard-passages-title" className="text-lg font-semibold">
        Passagens
      </h2>
      {data.expected === 0 && data.listed === 0 ? (
        <EmptyState
          title="Nenhum turno encerrado no período."
          description="Os números aparecem quando um turno do período termina ou uma passagem é entregue."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <ul
            aria-label="Números das passagens"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3"
          >
            <li>
              <StatLink
                label="Esperadas"
                value={data.expected}
                href={passagesListHref(period, "expected", extras)}
                icon={CalendarClock}
                caption="turnos já encerrados"
              />
            </li>
            <li>
              <StatLink
                label="Entregues"
                value={data.delivered}
                href={passagesListHref(period, "delivered", extras)}
                icon={Send}
                caption="entregues ou confirmadas"
              />
            </li>
            {SITUATIONS.map(({ situation, label }) => (
              <li key={situation}>
                <StatLink
                  label={label}
                  value={data[situation]}
                  href={passagesListHref(period, situation, extras)}
                  icon={SITUATION_STYLE[situation].icon}
                />
              </li>
            ))}
          </ul>
          <SpendingRing
            className="rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10"
            title="Situação das passagens"
            legendLabel="Legenda da situação das passagens"
            total={data.listed}
            totalHref={passagesListHref(period, "all", extras)}
            emptyText="Nenhuma passagem entregue nem turno encerrado no período."
            slices={SITUATIONS.map(({ situation, label }) => {
              const Icon = SITUATION_STYLE[situation].icon;
              return {
                key: situation,
                label,
                value: data[situation],
                href: passagesListHref(period, situation, extras),
                strokeClass: SITUATION_CHART[situation].stroke,
                dotClass: SITUATION_CHART[situation].dot,
                icon: <Icon aria-hidden="true" className="size-4 shrink-0" />,
              };
            })}
          />
        </div>
      )}
    </section>
  );
}
