"use client";

import { type FormEvent, useId, useState } from "react";

import { addCommentAction } from "@/app/(app)/solicitacoes/actions";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { COMMENT_MAX_LENGTH } from "@/features/requests/limits";
import { addCommentSchema } from "@/features/requests/schemas";

// Compositor de comentário: limpa só no sucesso; o erro fica no campo e o
// texto digitado nunca se perde.
export function CommentComposer({ requestId }: { requestId: string }) {
  const fieldId = useId();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { pending, run } = useAdminAction();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = addCommentSchema.safeParse({ requestId, body });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setError(null);
    const result = await run(() => addCommentAction({ requestId, body }), {
      showError: false,
      success: "Comentário adicionado.",
    });
    if (result.ok) {
      setBody("");
    } else {
      setError(result.fieldErrors?.body ?? result.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2" noValidate>
      <Field data-invalid={error ? "true" : undefined}>
        <FieldLabel htmlFor={fieldId}>Novo comentário</FieldLabel>
        <Textarea
          id={fieldId}
          className="text-base md:text-base"
          rows={3}
          maxLength={COMMENT_MAX_LENGTH}
          value={body}
          disabled={pending}
          aria-invalid={error ? true : undefined}
          onChange={(event) => setBody(event.target.value)}
        />
        {error && <FieldError>{error}</FieldError>}
      </Field>
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Comentando…" : "Comentar"}
      </Button>
    </form>
  );
}
