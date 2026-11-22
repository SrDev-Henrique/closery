"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  deliverHandoverAction,
  saveHandoverFieldAction,
} from "@/app/(app)/passagens/actions";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import type { HandoverFormState } from "@/features/handovers/formState";
import {
  UNSAVED_DELIVER_MESSAGE,
  UNSAVED_SUMMARY_MESSAGE,
} from "@/features/handovers/messages";
import type {
  FieldChange,
  FieldValues,
  FormMode,
  ShiftChoice,
} from "@/features/handovers/types";
import { handoverHref } from "@/features/handovers/urls";
import { AutosaveIndicator } from "./AutosaveIndicator";
import { HandoverFields } from "./HandoverFields";
import { HandoverHeader } from "./HandoverHeader";
import { useHandoverAutosave } from "./useHandoverAutosave";

function initialValues(state: HandoverFormState): FieldValues {
  const lines = [...state.controls, ...state.stock];
  return {
    occurrencesText: state.occurrencesText,
    nextShiftText: state.nextShiftText,
    quantities: Object.fromEntries(
      lines.map((line) => [line.itemId, line.quantity]),
    ),
    notes: Object.fromEntries(lines.map((line) => [line.itemId, line.note])),
  };
}

function applyChange(values: FieldValues, change: FieldChange): FieldValues {
  switch (change.field) {
    case "occurrences":
      return { ...values, occurrencesText: change.value };
    case "nextShift":
      return { ...values, nextShiftText: change.value };
    case "quantity":
      return {
        ...values,
        quantities: { ...values.quantities, [change.itemId]: change.value },
      };
    case "note":
      return {
        ...values,
        notes: { ...values.notes, [change.itemId]: change.value },
      };
  }
}

// Formulário da passagem com salvamento automático por campo. O chamador põe
// `key={`${shiftId}:${operationalDate}`}` para remontar ao trocar turno/data.
export function HandoverForm({
  state,
  shifts,
  today,
  minDate,
  sectorParam,
  canManageCatalog,
}: {
  state: HandoverFormState & { mode: FormMode };
  shifts: readonly ShiftChoice[];
  today: string;
  minDate: string;
  sectorParam: string | null;
  canManageCatalog: boolean;
}) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [values, setValues] = useState(() => initialValues(state));
  const [delivering, setDelivering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const autosave = useHandoverAutosave({
    ref: state.ref,
    save: saveHandoverFieldAction,
    initial: state.saved,
  });
  const drafting = state.mode === "draft";

  function handleChange(change: FieldChange) {
    setValues((current) => applyChange(current, change));
    autosave.change(change);
  }

  function handleCommit(change: FieldChange) {
    setValues((current) => applyChange(current, change));
    autosave.commit(change);
  }

  // Devolve a mensagem de falha, ou null quando entregou (e já navegou).
  async function submit(): Promise<string | null> {
    // Nada pendente fica para trás: entrega só depois de salvar tudo.
    if (!(await autosave.flush())) return UNSAVED_DELIVER_MESSAGE;
    const result = await run(() => deliverHandoverAction(state.ref), {
      showError: false,
      success: "Turno entregue.",
    });
    if (!result.ok) return result.message;
    router.push(handoverHref(result.id));
    return null;
  }

  // No modo de edição o resumo só abre depois que o salvamento terminou: uma
  // navegação passa na frente de uma action pendente e mostraria o valor velho.
  async function openSummary() {
    const handoverId = state.handoverId;
    if (delivering || !handoverId) return;
    setError(null);
    setDelivering(true);
    if (!(await autosave.flush())) {
      setError(UNSAVED_SUMMARY_MESSAGE);
      setDelivering(false);
      return;
    }
    router.push(handoverHref(handoverId));
  }

  async function deliver() {
    if (delivering || pending || switching) return;
    setError(null);
    setDelivering(true);
    const failure = await submit();
    // Com sucesso o botão fica travado até a navegação: sem segunda entrega.
    if (failure !== null) {
      setError(failure);
      setDelivering(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {drafting && (
        <HandoverHeader
          sectorId={state.ref.sectorId}
          sectorName={state.sectorName}
          shifts={shifts}
          shiftId={state.ref.shiftId}
          operationalDate={state.ref.operationalDate}
          today={today}
          minDate={minDate}
          sectorParam={sectorParam}
          beforeNavigate={autosave.flush}
          onPendingChange={setSwitching}
        />
      )}

      <HandoverFields
        controls={state.controls}
        stock={state.stock}
        values={values}
        onChange={handleChange}
        onCommit={handleCommit}
        disabled={switching}
        canManageCatalog={canManageCatalog}
        itemsHref={`/admin/itens?setor=${state.ref.sectorId}`}
      />

      <div className="flex flex-col gap-3">
        <AutosaveIndicator
          status={autosave.status}
          lastSaved={autosave.lastSaved}
          onRetry={autosave.retry}
        />
        {error && <FieldError>{error}</FieldError>}
        {drafting ? (
          <div className="flex flex-col items-start gap-2">
            <Button
              type="button"
              size="lg"
              disabled={delivering || pending || switching}
              onClick={deliver}
            >
              {delivering || pending ? "Entregando…" : "Entregar turno"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Você ainda pode corrigir até alguém confirmar o recebimento.
            </p>
          </div>
        ) : (
          state.handoverId && (
            <Button
              type="button"
              variant="outline"
              disabled={delivering}
              onClick={openSummary}
            >
              Ver resumo
            </Button>
          )
        )}
      </div>
    </div>
  );
}
