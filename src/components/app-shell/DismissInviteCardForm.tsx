"use client";

import { unstable_rethrow } from "next/navigation";
import { toast } from "sonner";

import { dismissInviteCardAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { INTERNAL_ERROR_MESSAGE } from "@/features/admin/result";

// "Agora não" do InviteTeamCard: o mesmo `<form>` com a Server Action da Task
// 10 (grava o cookie; o `revalidatePath("/")` dela redesenha o Início sem o
// cartão), agora num filho client para pegar a falha de rede. Sem o `catch`, o
// `fetch` da ação rejeitado subia até o error.tsx de (app) e o Início virava
// "Algo deu errado"; agora o cartão fica e o toast genérico avisa (como no
// SectorPicker). O redirect e o notFound do `requireAdmin` seguem adiante
// (`unstable_rethrow`). Nada de `"use server"` aqui: o guarda
// `actionsGuards.test.ts` só aceita a diretiva num `actions.ts` de (app).
// A troca custa o funcionamento sem JS: o `<form action={ServerAction}>` de
// antes enviava antes da hidratação; uma ação de função do cliente não tem
// forma em HTML, e o clique antes da hidratação não faz nada (como no
// SectorPicker). Vale, porque o cartão agora fica de pé na falha de rede.
export function DismissInviteCardForm() {
  async function dismiss() {
    try {
      await dismissInviteCardAction();
    } catch (error) {
      unstable_rethrow(error);
      toast.error(INTERNAL_ERROR_MESSAGE);
    }
  }

  return (
    <form action={dismiss}>
      <Button
        type="submit"
        variant="on-pastel-secondary"
        size="pill"
        className="px-5"
      >
        Agora não
      </Button>
    </form>
  );
}
