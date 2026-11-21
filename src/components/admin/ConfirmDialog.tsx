"use client";

import { type ReactElement, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import {
  type AdminResult,
  fail,
  INTERNAL_ERROR_MESSAGE,
} from "@/features/admin/result";

// Confirmação de ação sem volta fácil. Só fecha no sucesso: se o servidor
// recusar, a mensagem aparece aqui dentro e a pessoa decide o que fazer.
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Voltar",
  destructive = false,
  onConfirm,
}: {
  trigger: ReactElement;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<AdminResult>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (pending) return;
    if (next) setError(null);
    setOpen(next);
  }

  async function handleConfirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    let result: AdminResult;
    try {
      result = await onConfirm();
    } catch {
      result = fail("INTERNAL", INTERNAL_ERROR_MESSAGE);
    }
    setPending(false);
    if (result.ok) {
      setOpen(false);
    } else {
      setError(result.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <FieldError>{error}</FieldError>
        <DialogFooter>
          <DialogClose
            disabled={pending}
            render={<Button type="button" variant="outline" />}
          >
            {cancelLabel}
          </DialogClose>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
