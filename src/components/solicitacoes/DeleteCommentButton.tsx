"use client";

import { toast } from "sonner";

import { deleteCommentAction } from "@/app/(app)/solicitacoes/actions";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { formatDateTimeBR } from "@/lib/dateTime";

// Apagar o próprio comentário, com confirmação; o motivo de cancelamento não
// chega aqui (o servidor também recusa).
export function DeleteCommentButton({
  commentId,
  createdAt,
}: {
  commentId: string;
  createdAt: Date;
}) {
  return (
    <ConfirmDialog
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Apagar comentário de ${formatDateTimeBR(createdAt)}`}
        >
          Apagar
        </Button>
      }
      title="Apagar comentário?"
      description="Ele some da solicitação para todos."
      confirmLabel="Apagar comentário"
      destructive
      onConfirm={async () => {
        const result = await deleteCommentAction({ id: commentId });
        if (result.ok) toast.success("Comentário apagado.");
        return result;
      }}
    />
  );
}
