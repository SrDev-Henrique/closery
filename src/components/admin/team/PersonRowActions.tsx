"use client";

import { setPersonActiveAction } from "@/app/(app)/admin/equipe/actions";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EditDialog } from "@/components/admin/EditDialog";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import type { PersonRow } from "@/features/admin/people";
import type { SectorChoice } from "@/features/admin/sectors";
import { PasswordResetLinkButton } from "./PasswordResetLinkButton";
import { PersonForm } from "./PersonForm";

export function PersonRowActions({
  person,
  sectors,
}: {
  person: PersonRow;
  sectors: readonly SectorChoice[];
}) {
  const { pending, run } = useAdminAction();

  return (
    <>
      <EditDialog title="Editar pessoa" name={person.name}>
        {(close) => (
          <PersonForm person={person} sectors={sectors} onDone={close} />
        )}
      </EditDialog>

      {person.active && (
        <PasswordResetLinkButton
          personId={person.id}
          personName={person.name}
        />
      )}

      {person.active ? (
        <ConfirmDialog
          trigger={
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Desativar ${person.name}`}
            >
              Desativar
            </Button>
          }
          title={`Desativar ${person.name}?`}
          description="A pessoa perde o acesso agora e as sessões abertas são encerradas. O histórico dela continua. Você pode reativar depois."
          confirmLabel="Desativar"
          destructive
          onConfirm={() =>
            run(
              () => setPersonActiveAction({ userId: person.id, active: false }),
              { success: "Pessoa desativada.", showError: false },
            )
          }
        />
      ) : (
        <Button
          type="button"
          size="sm"
          aria-label={`Reativar ${person.name}`}
          disabled={pending}
          onClick={() =>
            run(
              () => setPersonActiveAction({ userId: person.id, active: true }),
              { success: "Pessoa reativada." },
            )
          }
        >
          Reativar
        </Button>
      )}
    </>
  );
}
