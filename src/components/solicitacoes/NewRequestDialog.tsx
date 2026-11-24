"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { SectorChoice } from "@/features/admin/sectors";
import type { HandoverRef } from "@/features/handovers/types";
import type { RequestFormChoices } from "@/features/requests/types";

import { RequestForm } from "./RequestForm";

// Gatilho "Nova solicitação" + diálogo com o RequestForm. O conteúdo desmonta
// ao fechar, então cada abertura começa com o estado novo (destino padrão,
// descrição vazia, sem itens). "Voltar" fecha; o X do primitivo fica desligado
// porque um botão só com ícone precisaria de tooltip (padrão do ConfirmDialog).
export function NewRequestDialog({
  sectors,
  initialSectorId,
  choices,
  originRef,
  triggerVariant = "default",
}: {
  sectors: readonly SectorChoice[] | null;
  initialSectorId: string;
  choices: RequestFormChoices;
  originRef: HandoverRef | null;
  triggerVariant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant={triggerVariant} />}>
        <Plus aria-hidden="true" />
        Nova solicitação
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>Nova solicitação</DialogTitle>
          <DialogDescription>
            Ela entra como Solicitada. A equipe do setor move o status até a
            entrega.
          </DialogDescription>
        </DialogHeader>
        <RequestForm
          sectors={sectors}
          initialSectorId={initialSectorId}
          choices={choices}
          originRef={originRef}
          onCreated={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
