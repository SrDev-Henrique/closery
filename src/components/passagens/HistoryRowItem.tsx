import Link from "next/link";

import { AdminListRow } from "@/components/admin/AdminListRow";
import { HandoverStatusBadge } from "@/components/passagens/HandoverStatusBadge";
import { buttonVariants } from "@/components/ui/button";
import type { HistoryRow } from "@/features/handovers/history";
import { formatDateBR, formatTimeBR } from "@/features/handovers/saoPaulo";
import { handoverHref, newHandoverHref } from "@/features/handovers/urls";

// Uma linha do histórico. `sectorParam` é o que o admin está vendo no `?setor=`
// (id ou "todos"); o operador não tem seletor e passa `null`. O setor da linha,
// não o valor "todos", é o que vai no link de "Entregar turno".
export function HistoryRowItem({
  row,
  showSector,
  sectorParam,
  minDate,
}: {
  row: HistoryRow;
  showSector: boolean;
  sectorParam: string | null;
  // Dia mais antigo em que ainda se cria ou entrega uma passagem (hoje menos
  // MAX_DAYS_BACK). Antes disso a linha só informa: o link cairia no turno
  // sugerido de hoje, sem aviso.
  minDate: string;
}) {
  const date = formatDateBR(row.operationalDate);

  const details: string[] = [];
  if (showSector) details.push(row.sectorName);
  if (row.deliveredByName !== null && row.deliveredAt !== null) {
    details.push(
      `Entregue por ${row.deliveredByName} às ${formatTimeBR(row.deliveredAt)}`,
    );
  }

  let action: { href: string; label: string; ariaLabel: string } | null;
  if (row.handoverId !== null) {
    action = {
      href: handoverHref(row.handoverId),
      label: "Abrir",
      ariaLabel: `Abrir passagem de ${row.shiftName} em ${date}`,
    };
  } else if (row.operationalDate < minDate) {
    action = null;
  } else {
    const label = row.hasDraft ? "Continuar passagem" : "Entregar turno";
    action = {
      href: newHandoverHref(
        {
          sectorId: row.sectorId,
          shiftId: row.shiftId,
          operationalDate: row.operationalDate,
        },
        sectorParam === null ? undefined : row.sectorId,
      ),
      label,
      ariaLabel: `${label} de ${row.shiftName} em ${date}`,
    };
  }

  return (
    <AdminListRow
      title={
        <>
          <span className="tabular-nums">{date}</span> · {row.shiftName}
        </>
      }
      subtitle={details.length > 0 ? details.join(" · ") : undefined}
      badges={
        <HandoverStatusBadge
          situation={row.situation}
          confirmedByName={row.confirmedByName}
          corrected={row.corrected}
        />
      }
      actions={
        action === null ? undefined : (
          <Link
            href={action.href}
            aria-label={action.ariaLabel}
            className={buttonVariants({
              variant: row.handoverId === null ? "default" : "outline",
            })}
          >
            {action.label}
          </Link>
        )
      }
    />
  );
}
