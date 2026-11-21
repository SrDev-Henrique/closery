"use client";

import { type FormEvent, useId, useState } from "react";

import { confirmHandoverAction } from "@/app/(app)/passagens/actions";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { FieldErrors } from "@/features/admin/result";
import { firstFieldErrors } from "@/features/admin/schemas";
import { CONFIRMATION_NOTE_MAX_LENGTH } from "@/features/handovers/limits";
import { confirmHandoverSchema } from "@/features/handovers/schemas";

// Observação opcional; o servidor normaliza e a confirmação revalida a página
// sozinha (a action chama revalidatePath), então nada de router.refresh aqui.
export function ConfirmReceiptForm({ id }: { id: string }) {
  const uid = useId();
  const { pending, run } = useAdminAction();
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFieldErrors({});
    setFormError(null);

    const parsed = confirmHandoverSchema.safeParse({ id, note });
    if (!parsed.success) {
      setFieldErrors(firstFieldErrors(parsed.error));
      return;
    }

    const result = await run(() => confirmHandoverAction({ id, note }), {
      showError: false,
      success: "Recebimento confirmado.",
    });
    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.fieldErrors?.note ? null : result.message);
    }
  }

  const noteError = fieldErrors.note;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={noteError ? true : undefined}>
          <FieldLabel htmlFor={`${uid}-note`}>
            Observação do recebimento (opcional)
          </FieldLabel>
          <Textarea
            id={`${uid}-note`}
            maxLength={CONFIRMATION_NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            aria-invalid={noteError ? true : undefined}
            aria-describedby={noteError ? `${uid}-note-error` : undefined}
          />
          {noteError && (
            <FieldError id={`${uid}-note-error`}>{noteError}</FieldError>
          )}
        </Field>

        {formError && <FieldError>{formError}</FieldError>}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Confirmando…" : "Confirmar recebimento"}
        </Button>
      </FieldGroup>
    </form>
  );
}
