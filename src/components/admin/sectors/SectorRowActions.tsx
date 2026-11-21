"use client";

import {
  renameSectorAction,
  setSectorActiveAction,
} from "@/app/(app)/admin/setores/actions";
import { ActiveToggleButton } from "@/components/admin/ActiveToggleButton";
import { EditDialog } from "@/components/admin/EditDialog";
import { NameForm } from "@/components/admin/NameForm";
import type { SectorRow } from "@/features/admin/sectors";

export function SectorRowActions({ sector }: { sector: SectorRow }) {
  return (
    <>
      <EditDialog title="Editar setor" name={sector.name}>
        {(close) => (
          <NameForm
            entity="setor"
            initialName={sector.name}
            submitLabel="Salvar alterações"
            successMessage="Alterações salvas."
            onSubmit={(name) => renameSectorAction({ id: sector.id, name })}
            onDone={close}
          />
        )}
      </EditDialog>
      <ActiveToggleButton
        entity="Setor"
        name={sector.name}
        active={sector.active}
        onToggle={(active) => setSectorActiveAction({ id: sector.id, active })}
      />
    </>
  );
}
