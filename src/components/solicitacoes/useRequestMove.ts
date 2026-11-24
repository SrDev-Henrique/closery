"use client";

import { unstable_rethrow, useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { moveRequestAction } from "@/app/(app)/solicitacoes/actions";
import {
  type AdminResult,
  fail,
  INTERNAL_ERROR_MESSAGE,
} from "@/features/admin/result";
import { applyMove, toGroupView } from "@/features/requests/boardMove";
import {
  movedToastMessage,
  moveFailedToastMessage,
} from "@/features/requests/messages";
import { isStaleScreenCode } from "@/features/requests/staleScreen";
import { requestPreview } from "@/features/requests/text";
import type {
  BoardStatus,
  RequestGroup,
  RequestGroupView,
  RequestListItem,
  RequestStatus,
} from "@/features/requests/types";

// Mover pelo Quadro e pela Lista: o cartão muda de coluna antes da resposta
// (useOptimistic) e volta sozinho quando a transição termina sem sucesso.
// O setOptimistic roda DENTRO da transição, antes do primeiro await.
export function useRequestMove<K extends RequestStatus>(
  groups: Readonly<Record<K, RequestGroup>>,
): {
  groups: Record<K, RequestGroupView>;
  move: (request: RequestListItem, to: BoardStatus) => void;
} {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    toGroupView(groups),
    (
      current: Record<K, RequestGroupView>,
      intent: Parameters<typeof applyMove>[1],
    ) => applyMove(current, intent),
  );

  function move(request: RequestListItem, to: BoardStatus) {
    const preview = requestPreview(request.description);
    startTransition(async () => {
      setOptimistic({ id: request.id, to, at: new Date() });
      let result: AdminResult<{ status: RequestStatus }>;
      try {
        result = await moveRequestAction({
          id: request.id,
          from: request.status,
          to,
        });
      } catch (error) {
        // redirect() e notFound() são exceções do Next: têm de seguir adiante.
        unstable_rethrow(error);
        result = fail("INTERNAL", INTERNAL_ERROR_MESSAGE);
      }
      if (result.ok) {
        toast.success(movedToastMessage(preview, to));
        return;
      }
      toast.error(moveFailedToastMessage(preview, result.message));
      if (isStaleScreenCode(result.code)) router.refresh();
    });
  }

  return { groups: optimistic, move };
}
