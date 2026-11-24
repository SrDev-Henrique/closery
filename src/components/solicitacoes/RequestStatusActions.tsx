"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { moveRequestAction } from "@/app/(app)/solicitacoes/actions";
import { useAdminAction } from "@/components/admin/useAdminAction";
import {
  movedToastMessage,
  moveFailedToastMessage,
} from "@/features/requests/messages";
import { isStaleScreenCode } from "@/features/requests/staleScreen";
import { moveTargets } from "@/features/requests/status";
import { requestPreview } from "@/features/requests/text";
import type { BoardStatus } from "@/features/requests/types";
import type { RequestStatus } from "@/lib/requestStatuses";

import { CancelRequestDialog } from "./CancelRequestDialog";
import { MoveStatusButton } from "./MoveStatusButton";

// "Mudar status" no detalhe: um botão por status alvo (na cor do destino) e,
// separado, "Cancelar solicitação" (pede o motivo).
export function RequestStatusActions({
  requestId,
  status,
  description,
  canCancel,
}: {
  requestId: string;
  status: RequestStatus;
  description: string;
  canCancel: boolean;
}) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const preview = requestPreview(description);

  async function move(to: BoardStatus) {
    const result = await run(
      () => moveRequestAction({ id: requestId, from: status, to }),
      { showError: false, success: movedToastMessage(preview, to) },
    );
    if (result.ok) return;
    toast.error(moveFailedToastMessage(preview, result.message));
    if (isStaleScreenCode(result.code)) router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {moveTargets(status).map((to) => (
        <MoveStatusButton
          key={to}
          to={to}
          disabled={pending}
          onClick={() => move(to)}
        />
      ))}
      {canCancel && (
        <CancelRequestDialog
          requestId={requestId}
          from={status}
          disabled={pending}
        />
      )}
    </div>
  );
}
