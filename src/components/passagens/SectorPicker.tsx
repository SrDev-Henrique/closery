"use client";

import { unstable_rethrow } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { chooseSectorAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { INTERNAL_ERROR_MESSAGE } from "@/features/admin/result";
import type { SectorChoice } from "@/features/admin/sectors";
import { ALL_SECTORS } from "@/features/handovers/limits";
import type { SectorPickerPath } from "@/features/handovers/urls";

// Escolha de setor do admin: grava o cookie e navega pela Server Action
// (F3-15). Clicar no setor já selecionado não faz nada. `query` é o query
// canônico dos filtros da tela (sem o setor): o servidor o reinterpreta e o
// leva ao setor novo (P45); sem ele, vai só o setor.
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
  const options: readonly Pick<SectorChoice, "id" | "name">[] = allowAll
    ? [...sectors, { id: ALL_SECTORS, name: "Todos os setores" }]
    : sectors;

  function choose(sectorId: string) {
    if (sectorId === selectedId) return;
    startTransition(async () => {
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
    <FieldSet className="flex-row flex-wrap gap-2">
      <FieldLegend className="sr-only">Setor</FieldLegend>
      {options.map((option) => {
        const selected = option.id === selectedId;
        return (
          <Button
            key={option.id}
            type="button"
            variant={selected ? "default" : "outline"}
            aria-pressed={selected}
            disabled={pending}
            onClick={() => choose(option.id)}
          >
            {option.name}
          </Button>
        );
      })}
    </FieldSet>
  );
}
