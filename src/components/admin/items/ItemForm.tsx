"use client";

import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";

import {
  createItemAction,
  updateItemAction,
} from "@/app/(app)/admin/itens/actions";
import { ChoiceGroup } from "@/components/admin/ChoiceGroup";
import { SelectField } from "@/components/admin/SelectField";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  ITEM_KIND_HELP,
  ITEM_KIND_LABELS,
  ITEM_UNIT_LABELS,
  ITEM_UNITS,
  type ItemFormValues,
  OTHER_UNIT,
  type UnitChoice,
} from "@/features/admin/itemOptions";
import type { FieldErrors } from "@/features/admin/result";
import {
  createItemSchema,
  firstFieldErrors,
  updateItemSchema,
} from "@/features/admin/schemas";
import { ITEM_KINDS } from "@/lib/itemKinds";

type ItemFormProps = {
  sectorId: string;
  initial: ItemFormValues & { id?: string };
  submitLabel: string;
  onDone?: () => void;
};

const UNIT_OPTIONS = [
  ...ITEM_UNITS.map((unit) => ({ value: unit, label: ITEM_UNIT_LABELS[unit] })),
  { value: OTHER_UNIT, label: "Outro…" },
];

const KIND_OPTIONS = ITEM_KINDS.map((kind) => ({
  value: kind,
  label: ITEM_KIND_LABELS[kind],
}));

function isUnitChoice(value: string): value is UnitChoice {
  return UNIT_OPTIONS.some((option) => option.value === value);
}

export function ItemForm({
  sectorId,
  initial,
  submitLabel,
  onDone,
}: ItemFormProps) {
  const uid = useId();
  const { pending, run } = useAdminAction();
  const [name, setName] = useState(initial.name);
  const [unitChoice, setUnitChoice] = useState<UnitChoice>(initial.unitChoice);
  const [unitOther, setUnitOther] = useState(initial.unitOther);
  const [kind, setKind] = useState(initial.kind);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFieldErrors({});
    setFormError(null);

    const values = { name, unitChoice, unitOther, kind };
    const parsed = initial.id
      ? updateItemSchema.safeParse({ id: initial.id, ...values })
      : createItemSchema.safeParse({ sectorId, ...values });
    if (!parsed.success) {
      setFieldErrors(firstFieldErrors(parsed.error));
      return;
    }

    const result = await run<object>(
      () =>
        initial.id
          ? updateItemAction({ id: initial.id, ...values })
          : createItemAction({ sectorId, ...values }),
      { showError: false },
    );
    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.fieldErrors ? null : result.message);
      return;
    }
    toast.success(initial.id ? "Alterações salvas." : "Item criado.");
    onDone?.();
  }

  const nameError = fieldErrors.name;
  const otherError = fieldErrors.unitOther;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={nameError ? true : undefined}>
          <FieldLabel htmlFor={`${uid}-name`}>Nome do item</FieldLabel>
          <Input
            id={`${uid}-name`}
            type="text"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${uid}-name-error` : undefined}
          />
          {nameError && (
            <FieldError id={`${uid}-name-error`}>{nameError}</FieldError>
          )}
        </Field>

        <SelectField
          label="Unidade"
          value={unitChoice}
          onValueChange={(value) => {
            if (isUnitChoice(value)) setUnitChoice(value);
          }}
          options={UNIT_OPTIONS}
          error={fieldErrors.unitChoice}
        />

        {unitChoice === OTHER_UNIT && (
          <Field data-invalid={otherError ? true : undefined}>
            <FieldLabel htmlFor={`${uid}-unitOther`}>Outra unidade</FieldLabel>
            <Input
              id={`${uid}-unitOther`}
              type="text"
              autoComplete="off"
              value={unitOther}
              onChange={(event) => setUnitOther(event.target.value)}
              aria-invalid={otherError ? true : undefined}
              aria-describedby={
                otherError ? `${uid}-unitOther-error` : undefined
              }
            />
            {otherError && (
              <FieldError id={`${uid}-unitOther-error`}>
                {otherError}
              </FieldError>
            )}
          </Field>
        )}

        <ChoiceGroup
          legend="Tipo"
          value={kind}
          onValueChange={setKind}
          options={KIND_OPTIONS}
          description={ITEM_KIND_HELP[kind]}
        />

        {formError && <FieldError>{formError}</FieldError>}

        <Button type="submit" size="lg" disabled={pending}>
          {submitLabel}
        </Button>
      </FieldGroup>
    </form>
  );
}
