import { cn } from "cn";
import { ArrowRight, Check, Plus } from "lucide-react";
import Link from "next/link";

import { dismissInviteCardAction } from "@/app/(app)/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AdminOverviewCounts } from "@/features/admin/overview";
import { pluralize } from "@/lib/plural";

import { UserAvatar } from "./UserAvatar";

export type InviteCounts = Pick<
  AdminOverviewCounts,
  "sectors" | "shifts" | "items" | "destinations" | "people"
>;

function setupSteps(counts: InviteCounts) {
  const active = (count: number) => pluralize(count, "ativo", "ativos");
  return [
    {
      name: "Setores",
      count: active(counts.sectors),
      done: counts.sectors > 0,
    },
    { name: "Turnos", count: active(counts.shifts), done: counts.shifts > 0 },
    { name: "Itens", count: active(counts.items), done: counts.items > 0 },
    {
      name: "Destinos",
      count: active(counts.destinations),
      done: counts.destinations > 0,
    },
    {
      // O passo que falta: convidar. Nunca vem marcado.
      name: "Equipe",
      count: pluralize(counts.people, "pessoa ativa", "pessoas ativas"),
      done: false,
    },
  ];
}

// Primeiro acesso do admin: o último passo é convidar a equipe. Aparece no topo
// dos cartões (HomeCards decide quando). Rosa (--invite), tinta --on-pastel.
export function InviteTeamCard({
  counts,
  avatarSrc,
}: {
  counts: InviteCounts;
  avatarSrc: string;
}) {
  return (
    <Card
      variant="feature"
      className="grid grid-cols-1 gap-6 bg-invite text-on-pastel @min-[1040px]/main:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
    >
      <div className="flex flex-col items-start gap-[18px]">
        <div aria-hidden="true" className="flex items-center gap-2.5 py-1">
          <UserAvatar src={avatarSrc} size={52} tilt={-5} frame="on-pastel" />
          <span className="grid size-[52px] shrink-0 rotate-[4deg] place-items-center rounded-[17px] border-2 border-dashed border-on-pastel/40">
            <Plus className="size-[18px]" strokeWidth={2.2} />
          </span>
          <span className="size-[52px] shrink-0 -rotate-3 rounded-[17px] border-2 border-dashed border-on-pastel/30" />
          <span className="size-[52px] shrink-0 rotate-5 rounded-[17px] border-2 border-dashed border-on-pastel/20" />
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="font-mono text-xs leading-none font-medium tracking-[.06em] text-on-invite-soft uppercase">
            Último passo
          </span>
          <h2 className="font-heading text-[26px] leading-none font-black tracking-[-0.025em] max-md:text-[22px]">
            Convide sua equipe
          </h2>
          <p className="max-w-[440px] text-[15px] leading-[1.55] text-pretty text-on-invite-muted">
            Gere um link de convite para cada pessoa. Operadores entram no setor
            que você escolher; administradores veem todos os setores.
          </p>
        </div>

        <div className="mt-auto flex flex-wrap gap-2.5">
          <Link
            href="/admin/equipe"
            className={buttonVariants({ variant: "on-pastel", size: "pill" })}
          >
            Gerar convites
            <ArrowRight aria-hidden="true" strokeWidth={2.2} />
          </Link>
          {/* "Agora não": formulário com a Server Action da Task 10 (funciona sem
              JS e sem estado de cliente; ela devolve `void`, o tipo que o
              `action` do React aceita). Nada de `"use server"` inline aqui: o
              guarda `actionsGuards.test.ts` só aceita a diretiva num
              `actions.ts` de `src/app/(app)/`. A ação grava o cookie e o
              `revalidatePath("/")` dela redesenha o Início sem o cartão. */}
          <form action={dismissInviteCardAction}>
            <Button
              type="submit"
              variant="on-pastel-secondary"
              size="pill"
              className="px-5"
            >
              Agora não
            </Button>
          </form>
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-[22px] bg-on-pastel-soft px-[22px] py-[18px]">
        <p className="mb-2 font-mono text-xs leading-none font-medium tracking-[.06em] text-on-invite-soft uppercase">
          Cadastros
        </p>
        {/* Protótipo: 4px entre as linhas (o `gap` do bloco), mais a divisória.
            `box-content`: os 44px mínimos são do conteúdo e a divisória de 1px
            soma por fora (45px), como no protótipo (sem o border-box do reset). */}
        <ul className="flex flex-col gap-1">
          {setupSteps(counts).map((step, index) => (
            <li
              key={step.name}
              data-done={step.done}
              className={cn(
                "box-content flex min-h-11 items-center gap-3",
                index > 0 && "border-t border-on-pastel-line",
              )}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full",
                  step.done
                    ? "bg-on-pastel text-invite"
                    : "border-2 border-dashed border-on-pastel/45",
                )}
              >
                {step.done && (
                  <Check
                    aria-hidden="true"
                    className="size-[13px]"
                    strokeWidth={3}
                  />
                )}
                <span className="sr-only">
                  {step.done ? "Feito" : "Falta fazer"}
                </span>
              </span>
              <span className="flex-1 font-heading text-base font-bold">
                {step.name}
              </span>
              <span className="font-mono text-[13px] font-medium whitespace-nowrap text-on-invite-muted tabular-nums">
                {step.count}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
