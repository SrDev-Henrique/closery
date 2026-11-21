"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { SelectField } from "@/components/admin/SelectField";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SWITCH_FAILED_MESSAGE } from "@/features/handovers/messages";
import { isIsoDate } from "@/features/handovers/saoPaulo";
import type { ShiftChoice } from "@/features/handovers/types";
import { newHandoverHref } from "@/features/handovers/urls";

// Cabeçalho do formulário: setor (texto), turno e data. Trocar turno ou data
// abre o rascunho DAQUELE turno e dia (D-F3-2): salva o que está pendente e
// navega; a troca de turno mantém a data e a de data mantém o turno.
export function HandoverHeader({
  sectorId,
  sectorName,
  shifts,
  shiftId,
  operationalDate,
  today,
  minDate,
  sectorParam,
  beforeNavigate,
}: {
  sectorId: string;
  sectorName: string;
  shifts: readonly ShiftChoice[];
  shiftId: string;
  operationalDate: string;
  today: string;
  minDate: string;
  sectorParam: string | null;
  beforeNavigate?: () => Promise<boolean>;
}) {
  const router = useRouter();
  const uid = useId();
  const [navigating, startNavigation] = useTransition();
  const [saving, setSaving] = useState(false);
  // O que a pessoa está digitando no campo de data. Só vira navegação ao sair
  // do campo ou com Enter: digitando "15", o navegador emite "2026-11-01"
  // depois do "1", que já é uma data válida.
  const [draftDate, setDraftDate] = useState<string | null>(null);

  async function go(next: { shiftId: string; operationalDate: string }) {
    setSaving(true);
    const canLeave = beforeNavigate ? await beforeNavigate() : true;
    setSaving(false);
    if (!canLeave) {
      toast.error(SWITCH_FAILED_MESSAGE);
      return;
    }
    startNavigation(() => {
      router.push(
        newHandoverHref({ sectorId, ...next }, sectorParam ?? undefined),
      );
    });
  }

  const busy = saving || navigating;

  function commitDate() {
    const value = draftDate;
    setDraftDate(null);
    if (value === null || busy) return;
    // Campo limpo ou fora da janela: ignora (o campo volta ao valor atual).
    if (!isIsoDate(value) || value < minDate || value > today) return;
    if (value !== operationalDate) void go({ shiftId, operationalDate: value });
  }

  return (
    <FieldGroup className="gap-4 sm:grid sm:grid-cols-3">
      <Field>
        <FieldLabel>Setor</FieldLabel>
        <p className="flex h-9 items-center text-base max-md:h-11">
          {sectorName}
        </p>
      </Field>
      <SelectField
        label="Turno"
        value={shiftId}
        disabled={busy}
        options={shifts.map((shift) => ({
          value: shift.id,
          label: `${shift.name} (${shift.startsAt}–${shift.endsAt})`,
        }))}
        onValueChange={(value) => {
          if (value !== shiftId) void go({ shiftId: value, operationalDate });
        }}
      />
      <Field>
        <FieldLabel htmlFor={`${uid}-date`}>Data</FieldLabel>
        <Input
          id={`${uid}-date`}
          type="date"
          min={minDate}
          max={today}
          value={draftDate ?? operationalDate}
          disabled={busy}
          onChange={(event) => setDraftDate(event.target.value)}
          onBlur={commitDate}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDate();
            }
          }}
        />
      </Field>
    </FieldGroup>
  );
}
