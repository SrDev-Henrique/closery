import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { OpenRequestsAtDeliverySection } from "@/components/solicitacoes/OpenRequestsAtDeliverySection";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/db";
import { idSchema } from "@/features/admin/schemas";
import { isAdmin } from "@/features/authz/authz";
import { getHandoverFormStateById } from "@/features/handovers/formState";
import { MAX_DAYS_BACK } from "@/features/handovers/limits";
import {
  addDays,
  formatDateBR,
  formatTimeBR,
  saoPauloParts,
  todayInSaoPaulo,
} from "@/features/handovers/saoPaulo";
import { getHandoverSummary } from "@/features/handovers/summary";
import { handoverHref, newHandoverHref } from "@/features/handovers/urls";
import { listOpenRequestsAtDelivery } from "@/features/requests/open";
import { requestsHref } from "@/features/requests/urls";
import { requireUser } from "@/lib/auth/session";

import { ConfirmReceiptForm } from "./ConfirmReceiptForm";
import { CorrectionForm } from "./CorrectionForm";
import { CorrectionsTimeline } from "./CorrectionsTimeline";
import { HandoverForm } from "./HandoverForm";
import { HandoverStatusBadge } from "./HandoverStatusBadge";
import { ReadOnlySectorNotice } from "./ReadOnlySectorNotice";
import { SummaryItemList } from "./SummaryItemList";

type HandoverDetailProps = {
  id: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function dateAndTime(value: Date): string {
  return `em ${formatDateBR(saoPauloParts(value).date)} às ${formatTimeBR(value)}`;
}

function EditShell({
  description,
  context,
  children,
}: {
  description: string;
  context: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Corrigir passagem
        </h1>
        <p className="text-muted-foreground">{description}</p>
        <p className="text-sm text-muted-foreground">{context}</p>
      </header>
      {children}
    </div>
  );
}

export async function HandoverDetail({
  id,
  searchParams,
}: HandoverDetailProps) {
  const actor = await requireUser();
  // Id malformado nem chega ao banco (uuid inválido estouraria no Postgres).
  if (!idSchema.safeParse(id).success) notFound();

  const result = await getHandoverSummary(db, actor, id);
  if (!result.ok) notFound();
  const { summary } = result;

  // Rascunho não tem resumo: o lugar dele é o formulário daquele turno e dia.
  if (summary.status === "draft") {
    redirect(newHandoverHref(summary.ref, summary.ref.sectorId));
  }

  // ?editar=1: o formulário só aparece para quem pode (quem entregou e o admin
  // na entregue; só o admin, com motivo, na confirmada). Quem não pode cai no
  // resumo, sem aviso de que a opção existe.
  const params = await searchParams;
  if (params.editar === "1") {
    const editable = await getHandoverFormStateById(db, actor, id);
    if (editable.ok) {
      const { state } = editable;
      const context = `${state.sectorName} · ${state.shiftName} · ${formatDateBR(state.ref.operationalDate)}`;
      if (state.mode === "edit") {
        const today = todayInSaoPaulo(new Date());
        return (
          <EditShell
            description="As alterações valem na hora. Quem recebe vê a versão atual."
            context={context}
          >
            <HandoverForm
              key={`${state.ref.shiftId}:${state.ref.operationalDate}`}
              state={{ ...state, mode: state.mode }}
              shifts={[]}
              today={today}
              minDate={addDays(today, -MAX_DAYS_BACK)}
              sectorParam={null}
              canManageCatalog={isAdmin(actor)}
            />
          </EditShell>
        );
      }
      if (state.mode === "correction") {
        return (
          <EditShell
            description="Esta passagem já foi confirmada. A correção fica registrada com o motivo."
            context={context}
          >
            <CorrectionForm state={{ ...state, mode: state.mode }} />
          </EditShell>
        );
      }
    }
  }

  // Setor inativo é só leitura (P37): nenhuma ação de escrita é oferecida.
  const writable = summary.sectorActive;
  const { capabilities } = summary;
  // As abertas NA ENTREGA (D-F4-2): o retrato do instante `delivered_at`, com o
  // status daquele instante calculado pelos eventos. Só aqui (resumo): o
  // formulário de edição e a correção não mostram a seção.
  const openAtDelivery =
    summary.deliveredAt === null
      ? null
      : await listOpenRequestsAtDelivery(db, actor, {
          sectorId: summary.ref.sectorId,
          deliveredAt: summary.deliveredAt,
        });
  const hasHighlighted =
    summary.highlighted.controls.length > 0 ||
    summary.highlighted.stock.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Passagem de turno
        </h1>
        <p className="text-muted-foreground">
          {`${summary.sectorName} · ${summary.shiftName} · ${formatDateBR(summary.ref.operationalDate)}`}
        </p>
        {summary.situation && (
          <HandoverStatusBadge
            situation={summary.situation}
            confirmedByName={summary.confirmedByName}
            corrected={summary.corrected}
          />
        )}
      </header>

      {!writable && <ReadOnlySectorNotice />}

      <section
        aria-labelledby="next-shift-heading"
        className="flex flex-col gap-2 rounded-lg border border-warning p-4"
      >
        <h2 id="next-shift-heading" className="text-lg font-semibold">
          Fica para o próximo turno
        </h2>
        {summary.nextShiftText === "" ? (
          <p className="text-muted-foreground">
            Nada registrado para o próximo turno.
          </p>
        ) : (
          <p className="whitespace-pre-wrap">{summary.nextShiftText}</p>
        )}
      </section>

      {openAtDelivery && (
        <OpenRequestsAtDeliverySection
          data={openAtDelivery}
          allHref={requestsHref(isAdmin(actor) ? summary.ref.sectorId : null)}
        />
      )}

      <SummaryItemList title="Controles" items={summary.highlighted.controls} />
      <SummaryItemList title="Estoque" items={summary.highlighted.stock} />
      {!hasHighlighted && (
        <p className="text-muted-foreground">
          Nenhum item com valor ou observação.
        </p>
      )}
      {summary.zeroed.count > 0 && (
        <details className="rounded-lg border px-4 py-3">
          <summary className="cursor-pointer font-medium">
            {`Demais itens: 0 (${summary.zeroed.count})`}
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
            {summary.zeroed.items.map((line) => (
              <li key={line.itemId}>{line.name}</li>
            ))}
          </ul>
        </details>
      )}

      <section
        aria-labelledby="occurrences-heading"
        className="flex flex-col gap-2"
      >
        <h2 id="occurrences-heading" className="text-lg font-semibold">
          Ocorrências do turno
        </h2>
        {summary.occurrencesText === "" ? (
          <p className="text-muted-foreground">
            Nenhuma ocorrência registrada.
          </p>
        ) : (
          <p className="whitespace-pre-wrap">{summary.occurrencesText}</p>
        )}
      </section>

      <section
        aria-labelledby="delivery-heading"
        className="flex flex-col gap-3"
      >
        <h2 id="delivery-heading" className="text-lg font-semibold">
          Entrega
        </h2>
        {summary.deliveredAt && (
          <p>
            {`Entregue por ${summary.deliveredByName ?? "—"} ${dateAndTime(summary.deliveredAt)}.`}
          </p>
        )}
        {summary.confirmedAt && (
          <p>
            {`Recebido por ${summary.confirmedByName ?? "—"} ${dateAndTime(summary.confirmedAt)}.`}
          </p>
        )}
        {summary.confirmationNote && (
          <p className="whitespace-pre-wrap">
            {`Observação do recebimento: ${summary.confirmationNote}`}
          </p>
        )}
        {writable && capabilities.canConfirm && (
          <ConfirmReceiptForm id={summary.id} />
        )}
        {writable &&
          summary.status === "delivered" &&
          !capabilities.canConfirm && (
            <p className="text-muted-foreground">
              Você entregou este turno. Outra pessoa do setor confirma o
              recebimento.
            </p>
          )}
      </section>

      {summary.corrections.length > 0 && (
        <section
          aria-labelledby="corrections-heading"
          className="flex flex-col gap-3"
        >
          <h2 id="corrections-heading" className="text-lg font-semibold">
            Correções
          </h2>
          <CorrectionsTimeline corrections={summary.corrections} />
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        {writable &&
          summary.status === "delivered" &&
          capabilities.canEditDirectly && (
            <Link
              href={handoverHref(summary.id, { edit: true })}
              className={buttonVariants({ variant: "outline" })}
            >
              Corrigir
            </Link>
          )}
        {writable && capabilities.canCorrectWithReason && (
          <Link
            href={handoverHref(summary.id, { edit: true })}
            className={buttonVariants({ variant: "outline" })}
          >
            Corrigir com motivo
          </Link>
        )}
        <Link
          href="/passagens"
          className={buttonVariants({ variant: "ghost" })}
        >
          Ver todas as passagens
        </Link>
      </div>
    </div>
  );
}
