"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";

import { correctHandoverAction } from "@/app/(app)/passagens/actions";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  type FieldErrors,
  INVALID_INPUT_MESSAGE,
} from "@/features/admin/result";
import { firstFieldErrors } from "@/features/admin/schemas";
import type { HandoverFormState } from "@/features/handovers/formState";
import { REASON_MAX_LENGTH } from "@/features/handovers/limits";
import { HANDOVER_NOT_FOUND_MESSAGE } from "@/features/handovers/messages";
import { correctHandoverSchema } from "@/features/handovers/schemas";
import type { FieldChange, FieldValues } from "@/features/handovers/types";
import { handoverHref } from "@/features/handovers/urls";

import { HandoverFields } from "./HandoverFields";

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

// Correção de passagem confirmada (D13): sem salvamento automático. Tudo vai
// de uma vez, com o motivo, e é o servidor que calcula o que mudou.
export function CorrectionForm({
  state,
}: {
  state: HandoverFormState & { mode: "correction" };
}) {
  const uid = useId();
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [values, setValues] = useState(() => initialValues(state));
  const [reason, setReason] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const lines = [...state.controls, ...state.stock];
  const backHref = state.handoverId
    ? handoverHref(state.handoverId)
    : "/passagens";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFieldErrors({});
    setFormError(null);

    const id = state.handoverId;
    if (id === null) {
      setFormError(HANDOVER_NOT_FOUND_MESSAGE);
      return;
    }

    const input = {
      id,
      reason,
      occurrencesText: values.occurrencesText,
      nextShiftText: values.nextShiftText,
      items: lines.map((line) => ({
        itemId: line.itemId,
        quantity: values.quantities[line.itemId] ?? line.quantity,
        note: values.notes[line.itemId] ?? "",
      })),
    };
    const parsed = correctHandoverSchema.safeParse(input);
    if (!parsed.success) {
      const errors = firstFieldErrors(parsed.error);
      setFieldErrors(errors);
      setFormError(
        errors.reason
          ? null
          : (parsed.error.issues[0]?.message ?? INVALID_INPUT_MESSAGE),
      );
      return;
    }

    const result = await run(() => correctHandoverAction(input), {
      showError: false,
      success: "Correção registrada.",
    });
    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.fieldErrors?.reason ? null : result.message);
      return;
    }
    router.push(handoverHref(id));
  }

  const reasonError = fieldErrors.reason;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <HandoverFields
          controls={state.controls}
          stock={state.stock}
          values={values}
          onChange={(change) =>
            setValues((current) => applyChange(current, change))
          }
          onCommit={() => {}}
          disabled={pending}
          canManageCatalog={false}
          itemsHref={`/admin/itens?setor=${state.ref.sectorId}`}
        />

        <Field data-invalid={reasonError ? true : undefined}>
          <FieldLabel htmlFor={`${uid}-reason`}>Motivo da correção</FieldLabel>
          <FieldDescription>
            Obrigatório. Aparece na lista de correções.
          </FieldDescription>
          <Textarea
            id={`${uid}-reason`}
            maxLength={REASON_MAX_LENGTH}
            value={reason}
            disabled={pending}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={reasonError ? `${uid}-reason-error` : undefined}
          />
          {reasonError && (
            <FieldError id={`${uid}-reason-error`}>{reasonError}</FieldError>
          )}
        </Field>

        {formError && <FieldError>{formError}</FieldError>}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Registrando…" : "Registrar correção"}
          </Button>
          <Link
            href={backHref}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Cancelar
          </Link>
        </div>
      </FieldGroup>
    </form>
  );
}
