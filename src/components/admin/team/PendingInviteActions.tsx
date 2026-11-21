"use client";

import { cancelInviteAction } from "@/app/(app)/admin/equipe/actions";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";

export function PendingInviteActions({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  const { run } = useAdminAction();

  return (
    <ConfirmDialog
      trigger={
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Cancelar convite ${label}`}
        >
          Cancelar convite
        </Button>
      }
      title="Cancelar convite?"
      description="O link deixa de funcionar. Não dá para desfazer."
      confirmLabel="Cancelar convite"
      destructive
      onConfirm={() =>
        run(() => cancelInviteAction({ id }), {
          success: "Convite cancelado.",
          showError: false,
        })
      }
    />
  );
}
