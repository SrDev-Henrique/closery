import { cn } from "cn";
import { ArrowRight, CircleCheck, Clock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { UserAvatar } from "@/components/app-shell/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MyShiftState } from "@/features/handovers/home";
import { formatDateBR, formatTimeBR } from "@/features/handovers/saoPaulo";
import { handoverHref, newHandoverHref } from "@/features/handovers/urls";
import { SECTOR_COLOR_BG, type SectorColor } from "@/features/sectors/colors";

import { ShiftProgressBar } from "./ShiftProgressBar";

// Protótipo: o primário dentro do card colorido tem 22px de padding (o do
// `pill`); o secundário, 20px (o `cn` troca o `px-[22px]` pelo `px-5`).
const PRIMARY = buttonVariants({ variant: "on-pastel", size: "pill" });
const SECONDARY = cn(
  buttonVariants({ variant: "on-pastel-secondary", size: "pill" }),
  "px-5",
);

// Os selos do cartão de turno são maiores que o `md` do Badge (protótipo):
// 28px de altura, 12px de padding, 13px/600, ícone de 14px e gap de 6px. O
// `leading-[normal]` vem depois do tamanho: o twMerge do Badge descarta o
// `leading-*` que vier antes de um `text-*`.
const STATE_BADGE =
  "h-7 gap-1.5 px-3 text-[13px] leading-[normal] [&>svg]:size-3.5!";

// 64px; 52px quando o cartão divide a linha com Solicitações e a área útil é
// menor que 1240px (container query do contêiner principal); 44px no celular.
const TIME_CLASS =
  "font-heading text-[64px] leading-none font-black tracking-[-0.035em] tabular-nums max-md:text-[44px] @min-[1040px]/main:@max-[1239px]/main:text-[52px]";

function Shell({
  color,
  sectorName,
  children,
}: {
  color: SectorColor;
  sectorName: string;
  children: ReactNode;
}) {
  return (
    <Card
      variant="feature"
      className={cn(
        "gap-[22px] text-on-pastel transition-colors duration-[450ms] motion-reduce:transition-none",
        SECTOR_COLOR_BG[color],
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 font-heading text-lg leading-[normal] font-bold">
          Passagem do meu turno
        </h2>
        <span
          title={sectorName}
          className="h-7 max-w-[55%] min-w-0 truncate rounded-full bg-on-pastel px-3 font-mono text-xs leading-7 font-medium tracking-[.04em] whitespace-nowrap text-on-pastel-ink"
        >
          {sectorName}
        </span>
      </div>
      {children}
    </Card>
  );
}

function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={PRIMARY}>
      {children}
      <ArrowRight aria-hidden="true" strokeWidth={2.2} />
    </Link>
  );
}

function Actions({ primary }: { primary: ReactNode }) {
  return (
    <div className="mt-auto flex flex-wrap gap-2.5">
      {primary}
      <Link href="/passagens" className={SECONDARY}>
        Ver todas as passagens
      </Link>
    </div>
  );
}

export function MyShiftCard({
  state,
  sectorId,
  sectorName,
  sectorColor,
  canManageCatalog,
  sectorParam,
  avatarSrc = null,
}: {
  state: MyShiftState;
  sectorId: string;
  sectorName: string;
  sectorColor: SectorColor;
  canManageCatalog: boolean;
  sectorParam: string | null;
  // Avatar de quem salvou o rascunho (estado `continue`).
  avatarSrc?: string | null;
}) {
  if (state.kind === "no-shifts") {
    return (
      <Shell color={sectorColor} sectorName={sectorName}>
        <div className="flex flex-col gap-1.5">
          <p className="font-heading text-[32px] leading-[1.05] font-black tracking-[-0.02em]">
            Nenhum turno neste setor.
          </p>
          <p className="text-[15px] leading-[normal] text-on-pastel-muted">
            {canManageCatalog
              ? "Cadastre os turnos do setor para começar a passagem."
              : "Peça a um administrador para cadastrar os turnos do setor."}
          </p>
        </div>
        <Actions
          primary={
            canManageCatalog ? (
              <PrimaryLink href={`/admin/turnos?setor=${sectorId}`}>
                Ir para Turnos
              </PrimaryLink>
            ) : null
          }
        />
      </Shell>
    );
  }

  const { shift, ref } = state;
  const newHref = newHandoverHref(ref, sectorParam ?? undefined);

  return (
    <Shell color={sectorColor} sectorName={sectorName}>
      <div className="flex flex-col gap-1.5">
        <span className="font-heading text-xl leading-[normal] font-bold break-words">
          {shift.name}
        </span>
        <span className={TIME_CLASS}>
          {shift.startsAt}–{shift.endsAt}
        </span>
        <span className="mt-1 font-mono text-sm leading-[normal] font-medium text-on-pastel-muted">
          {formatDateBR(ref.operationalDate)}
        </span>
      </div>

      {(state.kind === "start" || state.kind === "continue") && (
        <div className="flex flex-col gap-2">
          <ShiftProgressBar progress={state.progress} />
          <p className="mt-0.5 text-[15px] leading-[normal] text-on-pastel-muted">
            Turno sugerido pelo horário de agora.
          </p>
        </div>
      )}

      {state.kind === "continue" && state.saved && (
        <div className="flex w-fit max-w-full items-center gap-2.5 rounded-[18px] bg-on-pastel-soft py-2.5 pr-3.5 pl-2.5">
          {avatarSrc !== null && (
            <UserAvatar src={avatarSrc} size={34} tilt={-3} frame="on-pastel" />
          )}
          <span className="text-[15px] leading-[normal]">
            Rascunho salvo às {formatTimeBR(state.saved.at)} por{" "}
            {state.saved.byName}
          </span>
        </div>
      )}

      {state.kind === "delivered" && (
        <div className="flex flex-col items-start gap-3">
          <Badge variant="pastel-pending" size="md" className={STATE_BADGE}>
            <Clock aria-hidden="true" strokeWidth={2.2} />
            Aguardando recebimento
          </Badge>
          <p className="text-[15px] leading-normal">
            Entregue às {formatTimeBR(state.deliveredAt)} por{" "}
            {state.deliveredByName}. Aguardando recebimento.
          </p>
        </div>
      )}

      {state.kind === "confirmed" && (
        <div className="flex flex-col items-start gap-3">
          <Badge variant="pastel-confirmed" size="md" className={STATE_BADGE}>
            <CircleCheck aria-hidden="true" strokeWidth={2.2} />
            Confirmada
          </Badge>
          <p className="text-[15px] leading-normal">
            Entregue por {state.deliveredByName} às{" "}
            {formatTimeBR(state.deliveredAt)}. Confirmada por{" "}
            {state.confirmedByName ?? "outra pessoa"}
            {state.confirmedAt ? ` às ${formatTimeBR(state.confirmedAt)}` : ""}.
          </p>
        </div>
      )}

      <Actions
        primary={
          state.kind === "start" ? (
            <PrimaryLink href={newHref}>Começar passagem</PrimaryLink>
          ) : state.kind === "continue" ? (
            <PrimaryLink href={newHref}>Continuar passagem</PrimaryLink>
          ) : state.kind === "delivered" || state.kind === "confirmed" ? (
            <PrimaryLink href={handoverHref(state.handoverId)}>
              Ver passagem
            </PrimaryLink>
          ) : null
        }
      />
    </Shell>
  );
}
