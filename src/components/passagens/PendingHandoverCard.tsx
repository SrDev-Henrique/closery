import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { UserAvatar } from "@/components/app-shell/UserAvatar";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PendingHandover } from "@/features/handovers/home";
import { formatDateBR, formatTimeBR } from "@/features/handovers/saoPaulo";
import { handoverHref } from "@/features/handovers/urls";

// Cartão do topo do Início: a passagem mais recente do setor (entre entregues
// e confirmadas), se ainda espera recebimento (F3-6). O servidor já escondeu
// de quem entregou. Amarelo = precisa de atenção (só este cartão usa o
// `--highlight`); a tinta é a fixa dos cartões coloridos, igual nos dois temas.
// Duas colunas só com área útil de 1040px ou mais (container `main`).
// `avatarSrc` é o data URI de quem entregou (`avatarDataUri(deliveredById)`,
// gerado por quem chama, no servidor): o cartão só desenha.
export function PendingHandoverCard({
  pending,
  avatarSrc,
}: {
  pending: PendingHandover;
  avatarSrc: string;
}) {
  return (
    <Card
      variant="feature"
      data-slot="pending-handover"
      className="grid grid-cols-1 gap-6 bg-highlight text-on-pastel @min-[1040px]/main:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
    >
      <div className="flex flex-col items-start gap-[18px]">
        <h2 className="font-heading text-[26px] leading-none font-black tracking-[-0.025em] max-md:text-[22px]">
          Passagem para confirmar
        </h2>
        <div className="flex flex-col gap-3">
          <p className="font-heading text-[19px] font-bold">
            {pending.shiftName} · {formatDateBR(pending.operationalDate)}
          </p>
          <div className="flex items-center gap-2.5">
            <UserAvatar src={avatarSrc} size={36} tilt={3} frame="on-pastel" />
            <p className="text-[15px] text-on-highlight-muted">
              Entregue às {formatTimeBR(pending.deliveredAt)} por{" "}
              {pending.deliveredByName}
            </p>
          </div>
        </div>
        <Link
          href={handoverHref(pending.id)}
          className={`${buttonVariants({ variant: "on-pastel", size: "pill" })} mt-auto`}
        >
          Ver passagem
          <ArrowRight aria-hidden="true" strokeWidth={2.2} />
        </Link>
      </div>
      <div className="flex flex-col gap-2 rounded-[22px] bg-on-pastel-soft px-[22px] py-5">
        <p className="font-mono text-xs leading-none font-medium tracking-[0.06em] text-on-highlight-soft uppercase">
          Fica para o próximo turno
        </p>
        <p className="text-base leading-[1.55] text-pretty whitespace-pre-line">
          {pending.nextShiftPreview ?? "Nada registrado para o próximo turno."}
        </p>
      </div>
    </Card>
  );
}
