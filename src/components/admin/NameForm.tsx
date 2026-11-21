"use client";

import { type FormEvent, useId, useState } from "react";

import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { validateName } from "@/features/admin/names";
import type { AdminResult } from "@/features/admin/result";

const LABELS = {
  setor: "Nome do setor",
  destino: "Nome do destino",
} as const;

// Formulário controlado de um único nome (criar ou renomear setor/destino).
// O texto só é limpo no sucesso: se o servidor recusar, a pessoa não perde o
// que digitou (ui-rules §3).
export function NameForm({
  entity,
  initialName,
  submitLabel,
  onSubmit,
  successMessage,
  onDone,
}: {
  entity: "setor" | "destino";
  initialName: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<AdminResult<object>>;
  successMessage?: string;
  onDone?: () => void;
}) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const { pending, run } = useAdminAction();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const checked = validateName(name);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }

    const result = await run(() => onSubmit(checked.name), {
      success: successMessage,
      showError: false,
    });
    if (result.ok) {
      setError(null);
      setName(initialName === "" ? "" : checked.name);
      onDone?.();
    } else {
      setError(result.fieldErrors?.name ?? result.message);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col items-start gap-3"
    >
      <Field data-invalid={error ? "true" : undefined} className="max-w-md">
        <FieldLabel htmlFor={fieldId}>{LABELS[entity]}</FieldLabel>
        <Input
          id={fieldId}
          name="name"
          value={name}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
        />
        {error && <FieldError id={errorId}>{error}</FieldError>}
      </Field>
      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
