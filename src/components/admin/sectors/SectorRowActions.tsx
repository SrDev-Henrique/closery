"use client";

import { useState } from "react";

import {
  renameSectorAction,
  setSectorActiveAction,
} from "@/app/(app)/admin/setores/actions";
import { ActiveToggleButton } from "@/components/admin/ActiveToggleButton";
import { EditDialog } from "@/components/admin/EditDialog";
import { NameForm } from "@/components/admin/NameForm";
import { SectorColorChoice } from "@/components/admin/sectors/SectorColorChoice";
import type { SectorRow } from "@/features/admin/sectors";
import type { SectorColor } from "@/features/sectors/colors";

export function SectorRowActions({ sector }: { sector: SectorRow }) {
  return (
    <>
      <EditDialog title="Editar setor" name={sector.name}>
        {(close) => <SectorEditForm sector={sector} onDone={close} />}
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

// Monta quando o diálogo abre (o conteúdo do diálogo desmonta ao fechar), então a cor sempre
// começa na atual do setor e fechar sem salvar descarta a troca.
function SectorEditForm({
  sector,
  onDone,
}: {
  sector: SectorRow;
  onDone: () => void;
}) {
  const [color, setColor] = useState<SectorColor>(sector.color);

  return (
    <NameForm
      entity="setor"
      initialName={sector.name}
      submitLabel="Salvar alterações"
      successMessage="Alterações salvas."
      onSubmit={(name) => renameSectorAction({ id: sector.id, name, color })}
      onDone={onDone}
    >
      <SectorColorChoice defaultValue={sector.color} onValueChange={setColor} />
    </NameForm>
  );
}
