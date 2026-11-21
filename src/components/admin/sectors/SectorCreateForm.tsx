"use client";

import { createSectorAction } from "@/app/(app)/admin/setores/actions";
import { NameForm } from "@/components/admin/NameForm";

export function SectorCreateForm() {
  return (
    <NameForm
      entity="setor"
      initialName=""
      submitLabel="Criar setor"
      successMessage="Setor criado."
      onSubmit={(name) => createSectorAction({ name })}
    />
  );
}
