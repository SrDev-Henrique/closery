"use client";

import { useId } from "react";

import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// Controle segmentado para um conjunto pequeno e fechado de respostas
// (ui-rules §2.1). Nunca fica sem seleção: clicar no item já escolhido não faz nada.
export function ChoiceGroup<T extends string>({
  legend,
  value,
  onValueChange,
  options,
  description,
  disabled = false,
}: {
  legend: string;
  value: T;
  onValueChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  description?: string;
  disabled?: boolean;
}) {
  const descriptionId = useId();

  return (
    <FieldSet aria-describedby={description ? descriptionId : undefined}>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <ToggleGroup
        variant="outline"
        size="lg"
        value={[value]}
        disabled={disabled}
        onValueChange={(next) => {
          // Clicar no item já escolhido chega aqui como lista vazia: ignora.
          const picked = options.find((option) => option.value === next[0]);
          if (picked) onValueChange(picked.value);
        }}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {description && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
    </FieldSet>
  );
}
