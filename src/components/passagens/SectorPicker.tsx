"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { cn } from "cn";
import { unstable_rethrow } from "next/navigation";
import { type CSSProperties, useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { chooseSectorAction } from "@/app/(app)/actions";
import { INTERNAL_ERROR_MESSAGE } from "@/features/admin/result";
import type { SectorChoice } from "@/features/admin/sectors";
import { ALL_SECTORS } from "@/features/handovers/limits";
import type { SectorPickerPath } from "@/features/handovers/urls";
import { SECTOR_COLOR_BG, type SectorColor } from "@/features/sectors/colors";

// "Todos os setores" não é um setor: não tem cor, então não tem bolinha.
type PickerOption = { id: string; name: string; color: SectorColor | null };

// Largura mínima do segmento: 6.5rem (104px) nas classes abaixo (o Tailwind não
// aceita constante em classe arbitrária). Cabe "Operações" em Satoshi 15px/700
// com a bolinha e o respiro; o nome maior trunca com reticências. O trilho
// cresce até N * 104px (+ o padding de 4px de cada lado) antes de começar a rolar.

// Escolha de setor do admin: seletor deslizante (segmented control) que grava o
// cookie e navega pela Server Action (F3-15). Clicar no setor já selecionado
// não faz nada. `query` é o query canônico dos filtros da tela (sem o setor): o
// servidor o reinterpreta e o leva ao setor novo (P45); sem ele, vai só o setor.
export function SectorPicker({
  sectors,
  selectedId,
  path,
  allowAll = false,
  query,
}: {
  sectors: readonly SectorChoice[];
  selectedId: string | typeof ALL_SECTORS;
  path: SectorPickerPath;
  allowAll?: boolean;
  query?: string;
}) {
  const [pending, startTransition] = useTransition();
  // O thumb vai ao setor novo na hora; se a action falhar, a transição acaba e
  // o valor volta sozinho ao `selectedId` que o servidor mandou.
  const [shownId, setShownId] = useOptimistic<string>(selectedId);
  const options: readonly PickerOption[] = allowAll
    ? [...sectors, { id: ALL_SECTORS, name: "Todos os setores", color: null }]
    : sectors;
  const count = options.length;
  const index = options.findIndex((option) => option.id === shownId);

  function choose(sectorId: string) {
    if (sectorId === selectedId) return;
    startTransition(async () => {
      setShownId(sectorId);
      try {
        const result = await chooseSectorAction(
          query === undefined ? { sectorId, path } : { sectorId, path, query },
        );
        if (!result.ok) toast.error(result.message);
      } catch (error) {
        // O sucesso da action é um redirect, que chega aqui como exceção.
        unstable_rethrow(error);
        toast.error(INTERNAL_ERROR_MESSAGE);
      }
    });
  }

  return (
    <RadioGroup
      aria-label="Setor"
      value={shownId}
      onValueChange={(value) => choose(value)}
      disabled={pending}
      style={{ "--n": count } as CSSProperties}
      className="flex h-12 w-[min(100%,max(30rem,calc(var(--n)*6.5rem+0.5rem)))] overflow-x-auto rounded-full bg-seg p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="relative flex min-w-[max(100%,calc(var(--n)*6.5rem))] flex-1">
        <span
          aria-hidden="true"
          data-slot="sector-picker-thumb"
          style={{ "--i": Math.max(index, 0) } as CSSProperties}
          className={cn(
            "pointer-events-none absolute inset-y-0 left-[calc(var(--i)*100%/var(--n))] w-[calc(100%/var(--n))] rounded-full bg-thumb shadow-thumb transition-[left] duration-[400ms] ease-[cubic-bezier(.3,1.25,.4,1)] motion-reduce:transition-none",
            index < 0 && "opacity-0",
          )}
        />
        {options.map((option) => (
          <Radio.Root
            key={option.id}
            value={option.id}
            aria-label={option.name}
            className={cn(
              "relative z-10 flex min-w-[6.5rem] flex-1 cursor-pointer items-center justify-center gap-[7px] rounded-full px-3 font-heading text-[15px] font-medium text-foreground outline-none transition-colors duration-[250ms] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-checked:font-bold aria-checked:text-thumb-foreground aria-disabled:cursor-default motion-reduce:transition-none max-md:-my-0.5 max-md:h-11",
              pending && "opacity-60",
            )}
          >
            {option.color !== null && (
              <span
                aria-hidden="true"
                data-sector-dot=""
                className={cn(
                  "size-2 flex-none rounded-full",
                  SECTOR_COLOR_BG[option.color],
                )}
              />
            )}
            <span className="truncate">{option.name}</span>
          </Radio.Root>
        ))}
      </div>
    </RadioGroup>
  );
}
