import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PendingHandover } from "@/features/handovers/home";
import { formatDateBR, formatTimeBR } from "@/features/handovers/saoPaulo";
import { handoverHref } from "@/features/handovers/urls";

// Cartão do topo do Início: a passagem mais recente do setor (entre entregues
// e confirmadas), se ainda espera recebimento (F3-6). O servidor já escondeu
// de quem entregou.
export function PendingHandoverCard({ pending }: { pending: PendingHandover }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Passagem para confirmar</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-medium">
            {pending.shiftName} · {formatDateBR(pending.operationalDate)}
          </p>
          <p className="text-sm text-muted-foreground">
            Entregue às {formatTimeBR(pending.deliveredAt)} por{" "}
            {pending.deliveredByName}
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border-l-4 border-warning-foreground/40 bg-warning/40 p-3">
          <p className="text-sm font-medium">Fica para o próximo turno</p>
          <p className="text-sm whitespace-pre-line">
            {pending.nextShiftPreview ??
              "Nada registrado para o próximo turno."}
          </p>
        </div>
        <Link
          href={handoverHref(pending.id)}
          className={`${buttonVariants()} w-fit`}
        >
          Ver passagem
        </Link>
      </CardContent>
    </Card>
  );
}
