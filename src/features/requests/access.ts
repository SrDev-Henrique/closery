import { type Authz, canAccessSector } from "@/features/authz/authz";

import type { RequestStatus } from "@/lib/requestStatuses";

export type RequestCapabilities = {
  canView: boolean;
  canMove: boolean;
  canCancel: boolean;
  canComment: boolean;
};

// O que a pessoa pode fazer com uma solicitação. Operador: só o próprio setor;
// admin: todos. Setor inativo é só leitura para todo mundo. O domínio
// revalida: isto só decide o que a tela oferece.
export function requestCapabilities(
  actor: Authz,
  request: { sectorId: string; status: RequestStatus },
  sector: { active: boolean },
): RequestCapabilities {
  const canView = canAccessSector(actor, request.sectorId);
  const canMove = canView && sector.active;
  return {
    canView,
    canMove,
    canCancel: canMove && request.status !== "cancelled",
    canComment: canMove,
  };
}

// Criar: qualquer pessoa do setor (e o admin) num setor ativo.
export function canCreateRequest(
  actor: Authz,
  sector: { id: string; active: boolean },
): boolean {
  return canAccessSector(actor, sector.id) && sector.active;
}

// Apagar comentário: só o autor, só o próprio, nunca o motivo de cancelamento
// (nem o admin apaga o de outra pessoa), nunca um já apagado, nunca em setor
// inativo.
export function canDeleteComment(
  actor: Authz,
  comment: {
    authorId: string;
    statusEventId: string | null;
    deletedAt: Date | null;
  },
  sector: { active: boolean },
): boolean {
  return (
    comment.authorId === actor.userId &&
    comment.statusEventId === null &&
    comment.deletedAt === null &&
    sector.active
  );
}
