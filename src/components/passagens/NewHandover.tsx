import { notFound, redirect } from "next/navigation";

import { EmptyState } from "@/components/admin/EmptyState";
import { NewRequestDialog } from "@/components/solicitacoes/NewRequestDialog";
import { OpenRequestsNowSection } from "@/components/solicitacoes/OpenRequestsNowSection";
import { db } from "@/db";
import { getHandoverFormState } from "@/features/handovers/formState";
import { MAX_DAYS_BACK } from "@/features/handovers/limits";
import { loadSector } from "@/features/handovers/loaders";
import { addDays, todayInSaoPaulo } from "@/features/handovers/saoPaulo";
import { resolveScreenSector } from "@/features/handovers/screenSector";
import { resolveHandoverTarget } from "@/features/handovers/shiftSuggestion";
import { listActiveShifts } from "@/features/handovers/targets";
import { handoverHref } from "@/features/handovers/urls";
import { getRequestFormChoices } from "@/features/requests/choices";
import { listOpenRequests } from "@/features/requests/open";
import { requestsHref } from "@/features/requests/urls";
import { requireUser } from "@/lib/auth/session";
import type { SearchParams } from "@/lib/searchParams";

import { HandoverForm } from "./HandoverForm";
import { SectorPicker } from "./SectorPicker";

type NewHandoverProps = {
  searchParams: Promise<SearchParams>;
};

function PageTitle() {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">
        Passagem de turno
      </h1>
      <p className="text-muted-foreground">
        Registre o que aconteceu no turno. Tudo é salvo sozinho.
      </p>
    </header>
  );
}

// Lê sessão, URL e cookie: só dentro de <Suspense>. GET nunca escreve: o
// rascunho nasce no primeiro salvamento.
export async function NewHandover({ searchParams }: NewHandoverProps) {
  const actor = await requireUser();
  const params = await searchParams;
  const now = new Date();
  const isAdmin = actor.role === "admin";

  if (!isAdmin && actor.sectorId === null) notFound();

  const screen = await resolveScreenSector(db, actor, {
    url: params.setor,
    allowAll: false,
  });
  if (screen.kind === "missing") notFound();
  if (screen.kind === "inactive") {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle />
        <EmptyState
          title="Seu setor está inativo."
          description="Peça a um administrador para reativá-lo."
        />
      </div>
    );
  }
  if (screen.kind !== "sector") {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle />
        <EmptyState
          title="Nenhum setor ativo."
          description="Cadastre ou reative um setor para usar a passagem de turno."
          action={{ label: "Ir para Setores", href: "/admin/setores" }}
        />
      </div>
    );
  }

  const picker =
    screen.sectorParam === null ? null : (
      <SectorPicker
        sectors={screen.sectors}
        selectedId={screen.sectorParam}
        path="/passagens/nova"
      />
    );

  const sector = await loadSector(db, actor, screen.sectorId);
  if (!sector) notFound();

  const shifts = await listActiveShifts(db, sector.id);
  const target = resolveHandoverTarget(shifts, now, {
    shiftId: params.turno,
    date: params.data,
  });
  if (!target) {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle />
        {picker}
        <EmptyState
          title="Nenhum turno neste setor."
          description={
            isAdmin
              ? "Cadastre os turnos do setor para começar a passagem."
              : "Peça a um administrador para cadastrar os turnos do setor."
          }
          action={
            isAdmin
              ? {
                  label: "Ir para Turnos",
                  href: `/admin/turnos?setor=${sector.id}`,
                }
              : undefined
          }
        />
      </div>
    );
  }

  const ref = {
    sectorId: sector.id,
    shiftId: target.shiftId,
    operationalDate: target.operationalDate,
  };
  const result = await getHandoverFormState(db, actor, ref, now);
  if (!result.ok) notFound();
  const { state } = result;

  // Já entregue (ou confirmada): o lugar dela é o resumo.
  if (state.handoverId && state.status && state.status !== "draft") {
    redirect(handoverHref(state.handoverId));
  }
  if (state.mode === null) notFound();

  // Só o rascunho mostra as abertas de agora (a entregue já tem o retrato da
  // entrega no resumo). "Nova solicitação" leva a tripla da passagem: o servidor
  // cria o rascunho junto, se ainda não existir.
  let requestsSection: React.ReactNode;
  if (state.mode === "draft") {
    const [open, choices] = await Promise.all([
      listOpenRequests(db, actor, sector.id, now),
      getRequestFormChoices(db, [sector.id]),
    ]);
    requestsSection = (
      <OpenRequestsNowSection
        data={open}
        allHref={requestsHref(isAdmin ? sector.id : null)}
        newRequest={
          <NewRequestDialog
            sectors={null}
            initialSectorId={sector.id}
            choices={choices}
            originRef={ref}
            triggerVariant="outline"
          />
        }
      />
    );
  }

  const today = todayInSaoPaulo(now);
  return (
    <div className="flex flex-col gap-6">
      <PageTitle />
      {picker}
      <HandoverForm
        // Remonta ao trocar turno ou data: cada combinação tem o seu rascunho.
        key={`${ref.shiftId}:${ref.operationalDate}`}
        state={{ ...state, mode: state.mode }}
        shifts={shifts}
        today={today}
        minDate={addDays(today, -MAX_DAYS_BACK)}
        sectorParam={isAdmin ? sector.id : null}
        canManageCatalog={isAdmin}
        requestsSection={requestsSection}
      />
    </div>
  );
}
