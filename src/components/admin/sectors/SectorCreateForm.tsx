"use client";

import { useState } from "react";

import { createSectorAction } from "@/app/(app)/admin/setores/actions";
import { NameForm } from "@/components/admin/NameForm";
import { SectorColorChoice } from "@/components/admin/sectors/SectorColorChoice";
import type { SectorColor } from "@/features/sectors/colors";

// `suggestedColor` vem do servidor (`suggestColorForNewSector`): a cor já nasce marcada, o
// formulário nunca começa em branco. Depois de criar, a tela é revalidada e chega uma nova
// sugestão; a `key` remonta a escolha quando ela muda, e o `reset` cobre o caso em que a
// sugestão continua a mesma (a cor escolhida não "gruda" no próximo cadastro).
export function SectorCreateForm({
  suggestedColor,
}: {
  suggestedColor: SectorColor;
}) {
  const [color, setColor] = useState(suggestedColor);
  // A cor só acompanha o servidor enquanto a pessoa não escolheu a dela.
  const [touched, setTouched] = useState(false);
  const [syncedFrom, setSyncedFrom] = useState(suggestedColor);
  const [resets, setResets] = useState(0);

  // Sugestão nova vinda do servidor: acompanha (padrão "ajustar estado durante a renderização").
  if (syncedFrom !== suggestedColor) {
    setSyncedFrom(suggestedColor);
    if (!touched) setColor(suggestedColor);
  }

  return (
    <NameForm
      entity="setor"
      initialName=""
      submitLabel="Criar setor"
      successMessage="Setor criado."
      onSubmit={(name) => createSectorAction({ name, color })}
      onDone={() => {
        setColor(suggestedColor);
        setTouched(false);
        setResets((count) => count + 1);
      }}
    >
      <SectorColorChoice
        key={`${suggestedColor}-${resets}`}
        defaultValue={color}
        onValueChange={(next) => {
          setTouched(true);
          setColor(next);
        }}
      />
    </NameForm>
  );
}
