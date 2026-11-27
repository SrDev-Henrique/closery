"use client";

import { useState } from "react";

import { createSectorAction } from "@/app/(app)/admin/setores/actions";
import { NameForm } from "@/components/admin/NameForm";
import { SectorColorChoice } from "@/components/admin/sectors/SectorColorChoice";
import type { SectorColor } from "@/features/sectors/colors";

// `suggestedColor` vem do servidor (`suggestColorForNewSector`): a cor já nasce marcada, o
// formulário nunca começa em branco. Depois de criar, a tela é revalidada e chega uma nova
// sugestão; a `key` remonta a escolha quando ela muda, e o `resets` cobre o caso em que a
// sugestão continua a mesma (a cor escolhida não "gruda" no próximo cadastro).
export function SectorCreateForm({
  suggestedColor,
}: {
  suggestedColor: SectorColor;
}) {
  // A escolha da pessoa; `null` = não tocou, e a cor é a sugestão ATUAL do servidor. A cor é
  // derivada a cada renderização, nunca copiada: o `onDone` é o da renderização em que o envio
  // começou (o NameForm o captura) e, se a tela revalidada chegar antes dele, uma cópia da
  // sugestão daquela renderização traria a sugestão velha de volta.
  const [chosen, setChosen] = useState<SectorColor | null>(null);
  const [resets, setResets] = useState(0);
  const color = chosen ?? suggestedColor;

  return (
    <NameForm
      entity="setor"
      initialName=""
      submitLabel="Criar setor"
      successMessage="Setor criado."
      onSubmit={(name) => createSectorAction({ name, color })}
      onDone={() => {
        setChosen(null);
        setResets((count) => count + 1);
      }}
    >
      <SectorColorChoice
        key={`${suggestedColor}-${resets}`}
        defaultValue={color}
        onValueChange={setChosen}
      />
    </NameForm>
  );
}
