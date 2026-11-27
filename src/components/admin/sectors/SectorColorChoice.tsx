"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { useId } from "react";

import { FieldLegend, FieldSet } from "@/components/ui/field";
import {
  SECTOR_COLOR_BG,
  SECTOR_COLOR_LABELS,
  SECTOR_COLORS,
  type SectorColor,
} from "@/features/sectors/colors";
import { cn } from "@/lib/utils";

// Escolha da cor do setor: cinco opções fixas, cada uma com a amostra (16px) E o nome
// (ui-rules §2.1: a cor nunca é a única pista). Conjunto fechado e conhecido, então é um
// grupo de escolha, nunca um campo de texto. Nunca fica sem cor: o grupo sempre nasce com
// uma marcada (`defaultValue`) e clicar na marcada não a desmarca. Não guarda a escolha
// em formulário nativo; quem usa lê `onValueChange` e remonta (`key`) para voltar ao padrão.
export function SectorColorChoice({
  defaultValue,
  onValueChange,
  name = "color",
  legend = "Cor",
  disabled = false,
}: {
  defaultValue: SectorColor;
  onValueChange?: (color: SectorColor) => void;
  name?: string;
  legend?: string;
  disabled?: boolean;
}) {
  const legendId = useId();

  return (
    <FieldSet>
      <FieldLegend id={legendId} variant="label">
        {legend}
      </FieldLegend>
      <RadioGroup
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        aria-labelledby={legendId}
        onValueChange={(next) => onValueChange?.(next)}
        className="flex flex-wrap gap-2"
      >
        {SECTOR_COLORS.map((color) => (
          <Radio.Root
            key={color}
            value={color}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border border-input bg-transparent px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none max-md:h-11",
              "hover:bg-muted focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
              "data-checked:border-foreground data-checked:bg-muted",
              "data-disabled:pointer-events-none data-disabled:opacity-50",
            )}
          >
            <span
              data-slot="sector-color-swatch"
              aria-hidden="true"
              className={cn(
                "size-4 shrink-0 rounded-full border border-foreground/20",
                SECTOR_COLOR_BG[color],
              )}
            />
            {SECTOR_COLOR_LABELS[color]}
          </Radio.Root>
        ))}
      </RadioGroup>
    </FieldSet>
  );
}
