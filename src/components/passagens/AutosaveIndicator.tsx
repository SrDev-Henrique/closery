"use client";

import { Button } from "@/components/ui/button";
import { formatTimeBR } from "@/features/handovers/saoPaulo";
import type { SavedMark } from "@/features/handovers/types";
import type { AutosaveStatus } from "./useHandoverAutosave";

// Estado do salvamento automático, sempre em texto (nunca só cor). O contêiner
// (<output>, papel status) é uma região viva fixa: o leitor de tela anuncia só o que muda.
export function AutosaveIndicator({
  status,
  lastSaved,
  onRetry,
}: {
  status: AutosaveStatus;
  lastSaved: SavedMark | null;
  onRetry: () => void;
}) {
  return (
    <output
      aria-live="polite"
      className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
    >
      {status.kind === "saving" && <span>Salvando…</span>}
      {status.kind === "saved" && (
        <span>Salvo às {formatTimeBR(status.at)}</span>
      )}
      {status.kind === "idle" &&
        (lastSaved ? (
          <span>
            Último salvamento às {formatTimeBR(lastSaved.at)} por{" "}
            {lastSaved.byName}
          </span>
        ) : (
          <span>Nada salvo ainda.</span>
        ))}
      {status.kind === "error" && (
        <>
          <span className="font-medium text-destructive">Não salvo.</span>
          <span>{status.message}</span>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Tentar de novo
          </Button>
        </>
      )}
    </output>
  );
}
