import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MyShiftState } from "@/features/handovers/home";
import { formatDateBR, formatTimeBR } from "@/features/handovers/saoPaulo";
import { handoverHref, newHandoverHref } from "@/features/handovers/urls";

function NoShifts({
  sectorId,
  canManageCatalog,
}: {
  sectorId: string;
  canManageCatalog: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Passagem do meu turno</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-medium">Nenhum turno neste setor.</p>
          <p className="text-sm text-muted-foreground">
            {canManageCatalog
              ? "Cadastre os turnos do setor para começar a passagem."
              : "Peça a um administrador para cadastrar os turnos do setor."}
          </p>
        </div>
        {canManageCatalog && (
          <Link
            href={`/admin/turnos?setor=${sectorId}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Ir para Turnos
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export function MyShiftCard({
  state,
  sectorId,
  canManageCatalog,
  sectorParam,
}: {
  state: MyShiftState;
  sectorId: string;
  canManageCatalog: boolean;
  sectorParam: string | null;
}) {
  if (state.kind === "no-shifts") {
    return <NoShifts sectorId={sectorId} canManageCatalog={canManageCatalog} />;
  }

  const { shift, ref } = state;
  const newHref = newHandoverHref(ref, sectorParam ?? undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Passagem do meu turno</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-medium">
            {shift.name} ·{" "}
            <span className="tabular-nums">
              {shift.startsAt}–{shift.endsAt}
            </span>{" "}
            · {formatDateBR(ref.operationalDate)}
          </p>
          <p className="text-sm text-muted-foreground">
            Turno sugerido pelo horário de agora.
          </p>
        </div>

        {state.kind === "start" && (
          <Link href={newHref} className={`${buttonVariants()} w-fit`}>
            Começar passagem
          </Link>
        )}

        {state.kind === "continue" && (
          <>
            {state.saved && (
              <p className="text-sm">
                Rascunho salvo às {formatTimeBR(state.saved.at)} por{" "}
                {state.saved.byName}
              </p>
            )}
            <Link href={newHref} className={`${buttonVariants()} w-fit`}>
              Continuar passagem
            </Link>
          </>
        )}

        {state.kind === "delivered" && (
          <>
            <p className="text-sm">
              Entregue às {formatTimeBR(state.deliveredAt)} por{" "}
              {state.deliveredByName}. Aguardando recebimento.
            </p>
            <Link
              href={handoverHref(state.handoverId)}
              className={`${buttonVariants({ variant: "outline" })} w-fit`}
            >
              Ver passagem
            </Link>
          </>
        )}

        {state.kind === "confirmed" && (
          <>
            <p className="text-sm">
              Entregue por {state.deliveredByName} às{" "}
              {formatTimeBR(state.deliveredAt)}. Confirmada por{" "}
              {state.confirmedByName ?? "outra pessoa"}
              {state.confirmedAt
                ? ` às ${formatTimeBR(state.confirmedAt)}`
                : ""}
              .
            </p>
            <Link
              href={handoverHref(state.handoverId)}
              className={`${buttonVariants({ variant: "outline" })} w-fit`}
            >
              Ver passagem
            </Link>
          </>
        )}

        <Link
          href="/passagens"
          className={`${buttonVariants({ variant: "link" })} w-fit px-0`}
        >
          Ver todas as passagens
        </Link>
      </CardContent>
    </Card>
  );
}
