import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  formatDateBR,
  formatTimeBR,
  saoPauloParts,
} from "@/features/handovers/saoPaulo";
import type { OpenRequestsAtDelivery } from "@/features/requests/types";

import { OpenRequestItem } from "./OpenRequestItem";

// Seção "Solicitações abertas" do resumo da passagem: como estavam no instante
// da entrega (status e "parada" daquele instante), com "Agora: …" quando o
// status mudou depois. Só leitura: criar é no formulário e na tela própria.
export function OpenRequestsAtDeliverySection({
  data,
  allHref,
}: {
  data: OpenRequestsAtDelivery;
  allHref: string;
}) {
  const when = `${formatDateBR(saoPauloParts(data.deliveredAt).date)} às ${formatTimeBR(data.deliveredAt)}`;
  return (
    <section
      aria-labelledby="open-requests-delivery-heading"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="open-requests-delivery-heading"
          className="text-lg font-semibold"
        >
          Solicitações abertas
        </h2>
        <p className="text-sm text-muted-foreground">
          {`Como estavam na entrega, em ${when}.`}
        </p>
      </div>
      {data.rows.length === 0 ? (
        <p className="text-muted-foreground">
          Nenhuma solicitação aberta na entrega.
        </p>
      ) : (
        <ul className="flex flex-col divide-y">
          {data.rows.map((request) => (
            <OpenRequestItem
              key={request.id}
              request={request}
              statusNow={request.statusNow}
            />
          ))}
        </ul>
      )}
      {data.total > data.rows.length && (
        <p className="text-sm text-muted-foreground tabular-nums">
          Mostrando {data.rows.length} de {data.total}.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Link href={allHref} className={buttonVariants({ variant: "ghost" })}>
          Ver todas as solicitações
        </Link>
      </div>
    </section>
  );
}
