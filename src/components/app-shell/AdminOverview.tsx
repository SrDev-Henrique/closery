import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db";
import { getAdminOverviewCounts } from "@/features/admin/overview";
import { requireAdmin } from "@/lib/auth/session";
import { pluralize } from "@/lib/plural";

type OverviewCard = {
  href: string;
  title: string;
  description: string;
  count: string;
};

export async function AdminOverview() {
  await requireAdmin();
  const counts = await getAdminOverviewCounts(db, new Date());

  const active = (n: number) => pluralize(n, "ativo", "ativos");
  const cards: OverviewCard[] = [
    {
      href: "/admin/setores",
      title: "Setores",
      description: "Onde cada pessoa trabalha.",
      count: active(counts.sectors),
    },
    {
      href: "/admin/turnos",
      title: "Turnos",
      description: "Horários de cada setor.",
      count: active(counts.shifts),
    },
    {
      href: "/admin/itens",
      title: "Itens",
      description: "O que se conta na passagem.",
      count: active(counts.items),
    },
    {
      href: "/admin/destinos",
      title: "Destinos",
      description: "Para onde os pedidos vão.",
      count: active(counts.destinations),
    },
    {
      href: "/admin/equipe",
      title: "Equipe",
      description: "Pessoas, papéis e convites.",
      count: `${pluralize(counts.people, "pessoa ativa", "pessoas ativas")} · ${pluralize(counts.pendingInvites, "convite pendente", "convites pendentes")}`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
        <p className="text-muted-foreground">
          Cadastros que a passagem de turno usa.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="group block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors group-hover:bg-muted/50">
                <CardHeader>
                  <CardTitle>{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                  <p className="pt-2 text-sm font-medium tabular-nums">
                    {card.count}
                  </p>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
