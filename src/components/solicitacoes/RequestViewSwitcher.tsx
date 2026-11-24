import { List, SquareKanban, Table2 } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { RequestView } from "@/features/requests/requestFilters";
import { cn } from "@/lib/utils";

const VIEWS = [
  { view: "board", label: "Quadro", icon: SquareKanban },
  { view: "list", label: "Lista", icon: List },
  { view: "table", label: "Tabela", icon: Table2 },
] as const;

// Seletor de visão: três links (navegação com cara de botão). Sem `visao` na
// URL a tela renderiza este seletor duas vezes (um por largura, só CSS) para o
// aria-current dizer a verdade em cada uma.
export function RequestViewSwitcher({
  current,
  hrefs,
  className,
}: {
  current: RequestView;
  hrefs: Readonly<Record<RequestView, string>>;
  className?: string;
}) {
  return (
    <nav aria-label="Visão" className={cn("flex flex-wrap gap-2", className)}>
      {VIEWS.map(({ view, label, icon: Icon }) => (
        <Link
          key={view}
          href={hrefs[view]}
          aria-current={view === current ? "page" : undefined}
          className={buttonVariants({
            variant: view === current ? "default" : "outline",
          })}
        >
          <Icon aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
