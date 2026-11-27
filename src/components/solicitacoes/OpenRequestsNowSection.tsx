import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import type { OpenRequestsNow } from "@/features/requests/types";

import { OpenRequestItem } from "./OpenRequestItem";

// Seção "Solicitações abertas" do formulário do rascunho: as abertas de agora
// (até 20, as mais antigas no status primeiro) e o atalho para criar uma nova
// ligada a esta passagem. Server-safe: `newRequest` é o botão de cliente.
export function OpenRequestsNowSection({
  data,
  allHref,
  newRequest,
}: {
  data: OpenRequestsNow;
  allHref: string;
  newRequest: ReactNode | null;
}) {
  return (
    <section
      aria-labelledby="open-requests-now-heading"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <h2 id="open-requests-now-heading" className="text-lg font-semibold">
          Solicitações abertas
        </h2>
        <p className="text-sm text-muted-foreground">
          Do setor, agora. As paradas há mais tempo aparecem primeiro.
        </p>
      </div>
      {data.rows.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma solicitação aberta.</p>
      ) : (
        <ul className="flex flex-col">
          {data.rows.map((request) => (
            <OpenRequestItem key={request.id} request={request} />
          ))}
        </ul>
      )}
      {data.total > data.rows.length && (
        <p className="text-sm text-muted-foreground tabular-nums">
          Mostrando {data.rows.length} de {data.total}.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {newRequest}
        <Link href={allHref} className={buttonVariants({ variant: "ghost" })}>
          Ver todas as solicitações
        </Link>
      </div>
    </section>
  );
}
