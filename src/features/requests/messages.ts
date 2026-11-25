import { formatDateAtTimeBR } from "@/features/handovers/saoPaulo";
import type { RequestStatus } from "@/lib/requestStatuses";

import { REQUEST_STATUS_LABEL } from "./status";

// Mensagens das solicitações, prontas para a tela. Os testes e o E2E dependem
// do texto exato; os números batem com ./limits (messages.test.ts confere).
export const REQUEST_NOT_FOUND_MESSAGE =
  "Solicitação não encontrada. Atualize a página.";
export const COMMENT_NOT_FOUND_MESSAGE =
  "Comentário não encontrado. Atualize a página.";
export const DESTINATION_INACTIVE_MESSAGE =
  "Este destino está inativo. Escolha outro.";
export const DESTINATION_OTHER_REQUIRED_MESSAGE = "Informe o destino.";
export const DESTINATION_OTHER_TOO_LONG_MESSAGE =
  "O destino pode ter no máximo 80 caracteres.";
export const DESCRIPTION_REQUIRED_MESSAGE = "Descreva a solicitação.";
export const DESCRIPTION_TOO_LONG_MESSAGE =
  "A descrição pode ter no máximo 500 caracteres.";
export const ITEM_QUANTITY_MESSAGE = "Informe um número inteiro de 1 a 99.999.";
export const TOO_MANY_ITEMS_MESSAGE =
  "Uma solicitação pode ter no máximo 50 itens.";
export const ITEM_NOT_ALLOWED_MESSAGE =
  "Escolha um item de estoque ativo deste setor.";
export const ORIGIN_SECTOR_MISMATCH_MESSAGE =
  "A solicitação precisa ser do setor da passagem. Atualize a página.";
export const ORIGIN_LOCKED_MESSAGE =
  "Esta passagem já foi confirmada. Crie a solicitação pela tela Solicitações.";
export const INVALID_STATUS_MESSAGE = "Status inválido. Atualize a página.";
export const CANCEL_NEEDS_REASON_MESSAGE =
  "Para cancelar, use “Cancelar solicitação” e informe o motivo.";
export const CANCEL_REASON_REQUIRED_MESSAGE =
  "Informe o motivo do cancelamento.";
export const CANCEL_REASON_TOO_LONG_MESSAGE =
  "O motivo pode ter no máximo 500 caracteres.";
export const COMMENT_REQUIRED_MESSAGE = "Escreva o comentário.";
export const COMMENT_TOO_LONG_MESSAGE =
  "O comentário pode ter no máximo 2.000 caracteres.";
export const COMMENT_DELETE_FORBIDDEN_MESSAGE =
  "Só quem escreveu o comentário pode apagá-lo.";
export const CANCEL_REASON_LOCKED_MESSAGE =
  "O motivo do cancelamento não pode ser apagado.";

/** "O status desta solicitação já é {status}." */
export function sameStatusMessage(status: RequestStatus): string {
  return `O status desta solicitação já é ${REQUEST_STATUS_LABEL[status]}.`;
}

/** Outra pessoa já fez o mesmo movimento: "Esta solicitação já foi movida para {status} por {nome} em {dd/mm/aaaa} às {HH:mm}." */
export function alreadyMovedMessage(
  status: RequestStatus,
  byName: string,
  at: Date,
): string {
  return `Esta solicitação já foi movida para ${REQUEST_STATUS_LABEL[status]} por ${byName} em ${formatDateAtTimeBR(at)}.`;
}

/** "Esta solicitação já foi cancelada por {nome} em {dd/mm/aaaa} às {HH:mm}." */
export function alreadyCancelledMessage(byName: string, at: Date): string {
  return `Esta solicitação já foi cancelada por ${byName} em ${formatDateAtTimeBR(at)}.`;
}

/** Outra pessoa moveu para outro status: o status que a tela mostrava ficou velho. */
export function statusConflictMessage(
  status: RequestStatus,
  byName: string,
  at: Date,
): string {
  return `Esta solicitação mudou para ${REQUEST_STATUS_LABEL[status]} por ${byName} em ${formatDateAtTimeBR(at)}. Confira e tente de novo.`;
}

/** Toast de sucesso: “{prévia}” movida para {status}. */
export function movedToastMessage(
  preview: string,
  status: RequestStatus,
): string {
  return `“${preview}” movida para ${REQUEST_STATUS_LABEL[status]}.`;
}

/** Toast de falha: Não foi possível mover “{prévia}”. {mensagem} */
export function moveFailedToastMessage(
  preview: string,
  message: string,
): string {
  return `Não foi possível mover “${preview}”. ${message}`;
}
