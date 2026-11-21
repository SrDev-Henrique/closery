"use client";

import {
  renameDestinationAction,
  setDestinationActiveAction,
} from "@/app/(app)/admin/destinos/actions";
import { ActiveToggleButton } from "@/components/admin/ActiveToggleButton";
import { EditDialog } from "@/components/admin/EditDialog";
import { NameForm } from "@/components/admin/NameForm";
import type { DestinationRow } from "@/features/admin/destinations";

export function DestinationRowActions({
  destination,
}: {
  destination: DestinationRow;
}) {
  return (
    <>
      <EditDialog title="Editar destino" name={destination.name}>
        {(close) => (
          <NameForm
            entity="destino"
            initialName={destination.name}
            submitLabel="Salvar alterações"
            successMessage="Alterações salvas."
            onSubmit={(name) =>
              renameDestinationAction({ id: destination.id, name })
            }
            onDone={close}
          />
        )}
      </EditDialog>
      <ActiveToggleButton
        entity="Destino"
        name={destination.name}
        active={destination.active}
        onToggle={(active) =>
          setDestinationActiveAction({ id: destination.id, active })
        }
      />
    </>
  );
}
