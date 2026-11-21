"use client";

import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";

import {
  createShiftAction,
  updateShiftAction,
} from "@/app/(app)/admin/turnos/actions";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { FieldErrors } from "@/features/admin/result";
import {
  createShiftSchema,
  firstFieldErrors,
  updateShiftSchema,
} from "@/features/admin/schemas";
import {
  formatOverlapWarning,
  type OverlapWarning,
} from "@/features/admin/shiftRules";
import type { ShiftFormDefaults } from "@/features/admin/shifts";
import { parseTimeOfDay } from "@/features/admin/timeOfDay";

type ShiftFormProps = {
  sectorId: string;
  initial: ShiftFormDefaults & { id?: string };
  submitLabel: string;
  onDone?: () => void;
};

const MAX_WARNING_TOASTS = 3;

function toastWarnings(warnings: readonly OverlapWarning[]): void {
  for (const warning of warnings.slice(0, MAX_WARNING_TOASTS)) {
    toast.warning(formatOverlapWarning(warning));
  }
}

export function ShiftForm({
  sectorId,
  initial,
  submitLabel,
  onDone,
}: ShiftFormProps) {
  const uid = useId();
  const { pending, run } = useAdminAction();
  const [name, setName] = useState(initial.name);
  const [startsAt, setStartsAt] = useState(initial.startsAt);
  const [endsAt, setEndsAt] = useState(initial.endsAt);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const start = parseTimeOfDay(startsAt);
  const end = parseTimeOfDay(endsAt);
  const crosses = start !== null && end !== null && end < start;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFieldErrors({});
    setFormError(null);

    const values = { name, startsAt, endsAt };
    const parsed = initial.id
      ? updateShiftSchema.safeParse({ id: initial.id, ...values })
      : createShiftSchema.safeParse({ sectorId, ...values });
    if (!parsed.success) {
      setFieldErrors(firstFieldErrors(parsed.error));
      return;
    }

    const result = await run<{ warnings: OverlapWarning[] }>(
      () =>
        initial.id
          ? updateShiftAction({ id: initial.id, ...values })
          : createShiftAction({ sectorId, ...values }),
      { showError: false },
    );
    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.fieldErrors ? null : result.message);
      return;
    }
    toast.success(initial.id ? "Alterações salvas." : "Turno criado.");
    toastWarnings(result.warnings);
    onDone?.();
  }

  const errorId = (field: string) => `${uid}-${field}-error`;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={fieldErrors.name ? true : undefined}>
          <FieldLabel htmlFor={`${uid}-name`}>Nome do turno</FieldLabel>
          <Input
            id={`${uid}-name`}
            type="text"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={fieldErrors.name ? errorId("name") : undefined}
          />
          {fieldErrors.name && (
            <FieldError id={errorId("name")}>{fieldErrors.name}</FieldError>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={fieldErrors.startsAt ? true : undefined}>
            <FieldLabel htmlFor={`${uid}-startsAt`}>Início</FieldLabel>
            <Input
              id={`${uid}-startsAt`}
              type="time"
              step={60}
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              aria-invalid={fieldErrors.startsAt ? true : undefined}
              aria-describedby={
                fieldErrors.startsAt ? errorId("startsAt") : undefined
              }
            />
            {fieldErrors.startsAt && (
              <FieldError id={errorId("startsAt")}>
                {fieldErrors.startsAt}
              </FieldError>
            )}
          </Field>
          <Field data-invalid={fieldErrors.endsAt ? true : undefined}>
            <FieldLabel htmlFor={`${uid}-endsAt`}>Fim</FieldLabel>
            <Input
              id={`${uid}-endsAt`}
              type="time"
              step={60}
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              aria-invalid={fieldErrors.endsAt ? true : undefined}
              aria-describedby={
                fieldErrors.endsAt ? errorId("endsAt") : undefined
              }
            />
            {fieldErrors.endsAt && (
              <FieldError id={errorId("endsAt")}>
                {fieldErrors.endsAt}
              </FieldError>
            )}
          </Field>
        </div>

        <FieldDescription>
          Fim menor que o início atravessa a meia-noite.
        </FieldDescription>
        {crosses && (
          <output className="text-sm font-medium">
            Atravessa a meia-noite.
          </output>
        )}

        {formError && <FieldError>{formError}</FieldError>}

        <Button type="submit" size="lg" disabled={pending}>
          {submitLabel}
        </Button>
      </FieldGroup>
    </form>
  );
}
