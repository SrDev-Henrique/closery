"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";

import { cancelRequestAction } from "@/app/(app)/solicitacoes/actions";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { CANCEL_REASON_MAX_LENGTH } from "@/features/requests/limits";
import { cancelRequestSchema } from "@/features/requests/schemas";
import { isStaleScreenCode } from "@/features/requests/staleScreen";
import type { RequestStatus } from "@/lib/requestStatuses";

// Cancelar exige motivo (≤ 500). Só fecha sozinho no sucesso; qualquer outra
// falha fica no diálogo, com o texto digitado.
export function CancelRequestDialog({
  requestId,
  from,
  disabled = false,
}: {
  requestId: string;
  from: RequestStatus;
  disabled?: boolean;
}) {
  const router = useRouter();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [footerError, setFooterError] = useState<string | null>(null);
  const { pending, run } = useAdminAction();

  function handleOpenChange(next: boolean) {
    if (pending) return;
    if (next) {
      setReason("");
      setReasonError(null);
      setFooterError(null);
    }
    setOpen(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = cancelRequestSchema.safeParse({
      id: requestId,
      from,
      reason,
    });
    if (!parsed.success) {
      setReasonError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setReasonError(null);
    setFooterError(null);
    const result = await run(
      () => cancelRequestAction({ id: requestId, from, reason }),
      { showError: false, success: "Solicitação cancelada." },
    );
    if (result.ok) {
      setOpen(false);
      return;
    }
    if (isStaleScreenCode(result.code)) {
      toast.error(result.message);
      setOpen(false);
      router.refresh();
      return;
    }
    if (result.fieldErrors?.reason) {
      setReasonError(result.fieldErrors.reason);
      return;
    }
    setFooterError(result.message);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        disabled={disabled}
        render={<Button type="button" variant="destructive" />}
      >
        Cancelar solicitação
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Cancelar solicitação</DialogTitle>
          <DialogDescription>
            O motivo fica na linha do tempo e nos comentários.
          </DialogDescription>
        </DialogHeader>
        <form
          id={`${fieldId}-form`}
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          noValidate
        >
          <Field data-invalid={reasonError ? "true" : undefined}>
            <FieldLabel htmlFor={fieldId}>Motivo do cancelamento</FieldLabel>
            <Textarea
              id={fieldId}
              className="text-base md:text-base"
              rows={3}
              maxLength={CANCEL_REASON_MAX_LENGTH}
              value={reason}
              disabled={pending}
              aria-invalid={reasonError ? true : undefined}
              onChange={(event) => setReason(event.target.value)}
            />
            <FieldDescription>Obrigatório.</FieldDescription>
            {reasonError && <FieldError>{reasonError}</FieldError>}
          </Field>
          <FieldError>{footerError}</FieldError>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => handleOpenChange(false)}
            >
              Voltar
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Cancelando…" : "Cancelar solicitação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
