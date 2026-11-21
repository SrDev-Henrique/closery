"use client";

import { createDestinationAction } from "@/app/(app)/admin/destinos/actions";
import { NameForm } from "@/components/admin/NameForm";

export function DestinationCreateForm() {
  return (
    <NameForm
      entity="destino"
      initialName=""
      submitLabel="Criar destino"
      successMessage="Destino criado."
      onSubmit={(name) => createDestinationAction({ name })}
    />
  );
}
