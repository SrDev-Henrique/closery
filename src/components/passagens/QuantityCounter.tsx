"use client";

import { Minus, Plus } from "lucide-react";
import { type ChangeEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MAX_QUANTITY } from "@/features/handovers/limits";
import {
  parseQuantity,
  sanitizeQuantityInput,
  stepQuantity,
} from "@/features/handovers/quantity";

// Contador de uma contagem inteira de 0 a 99.999 (ui-rules §2.2: número nunca
// em branco). Só dígitos; o campo pode ficar vazio enquanto a pessoa digita
// (buffer local), mas ao sair vira 0 e o 0 é o valor salvo.
export function QuantityCounter({
  label,
  unit,
  value,
  onChange,
  onCommit,
  disabled = false,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  disabled?: boolean;
}) {
  // null = o campo mostra `value`; texto = a pessoa está digitando.
  const [draft, setDraft] = useState<string | null>(null);

  function step(delta: 1 | -1) {
    const next = stepQuantity(value, delta);
    setDraft(null);
    onChange(next);
    onCommit?.(next);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const text = sanitizeQuantityInput(event.target.value);
    setDraft(text);
    const parsed = parseQuantity(text);
    if (parsed !== null) onChange(parsed);
  }

  function handleBlur() {
    if (draft === null) return;
    const final = parseQuantity(draft) ?? 0;
    setDraft(null);
    onChange(final);
    onCommit?.(final);
  }

  return (
    <fieldset className="flex min-w-0 items-center gap-1.5">
      <legend className="sr-only">{label}</legend>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Diminuir ${label}`}
              disabled={disabled || value <= 0}
              onClick={() => step(-1)}
            />
          }
        >
          <Minus />
        </TooltipTrigger>
        <TooltipContent>Diminuir</TooltipContent>
      </Tooltip>
      <Input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={String(MAX_QUANTITY).length}
        autoComplete="off"
        className="w-20 text-center text-base tabular-nums md:text-base"
        aria-label={`Quantidade de ${label}`}
        value={draft ?? String(value)}
        disabled={disabled}
        onFocus={(event) => event.currentTarget.select()}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Aumentar ${label}`}
              disabled={disabled || value >= MAX_QUANTITY}
              onClick={() => step(1)}
            />
          }
        >
          <Plus />
        </TooltipTrigger>
        <TooltipContent>Aumentar</TooltipContent>
      </Tooltip>
      <span className="text-sm text-muted-foreground">{unit}</span>
    </fieldset>
  );
}
