import { formatTimeBR } from "./saoPaulo";

// Mensagens da passagem, prontas para a tela. Os testes e o E2E dependem do
// texto exato; os números batem com ./limits (messages.test.ts confere).
export const HANDOVER_NOT_FOUND_MESSAGE =
  "Passagem não encontrada. Atualize a página.";
export const SECTOR_INACTIVE_HANDOVER_MESSAGE =
  "Este setor está inativo. Peça a um administrador para reativá-lo.";
export const SHIFT_INACTIVE_MESSAGE =
  "Este turno está inativo. Escolha outro turno.";
export const DATE_OUT_OF_RANGE_MESSAGE =
  "Escolha uma data de hoje ou dos últimos 31 dias.";
export const EDIT_FORBIDDEN_MESSAGE =
  "Só quem entregou o turno ou um administrador pode editar esta passagem.";
export const HANDOVER_LOCKED_MESSAGE =
  "Esta passagem já foi confirmada. Só um administrador corrige, com motivo.";
export const NOT_DELIVERED_MESSAGE = "Esta passagem ainda não foi entregue.";
export const OWN_HANDOVER_MESSAGE =
  "Quem entregou o turno não pode confirmar o recebimento. Peça a outra pessoa do setor.";
export const NOT_CONFIRMED_MESSAGE =
  "Só passagens confirmadas passam pela correção com motivo. Edite a passagem direto.";
export const CORRECTION_FORBIDDEN_MESSAGE =
  "Só um administrador pode corrigir uma passagem confirmada.";
export const NO_CHANGES_MESSAGE =
  "Nada foi alterado. Mude algum campo para registrar a correção.";
export const REASON_REQUIRED_MESSAGE = "Informe o motivo da correção.";
export const REASON_TOO_LONG_MESSAGE =
  "O motivo pode ter no máximo 500 caracteres.";
export const QUANTITY_MESSAGE = "Informe um número inteiro de 0 a 99.999.";
export const TEXT_TOO_LONG_MESSAGE =
  "O texto pode ter no máximo 2.000 caracteres.";
export const NOTE_TOO_LONG_MESSAGE =
  "A observação pode ter no máximo 200 caracteres.";
export const CONFIRMATION_NOTE_TOO_LONG_MESSAGE =
  "A observação pode ter no máximo 500 caracteres.";
export const INVALID_DATE_MESSAGE = "Data inválida.";
export const DUPLICATE_ITEM_MESSAGE = "Item repetido. Atualize a página.";
export const UNSAVED_DELIVER_MESSAGE =
  "Há alterações sem salvar. Toque em “Tentar de novo” e entregue de novo.";
export const SWITCH_FAILED_MESSAGE =
  "Não foi possível salvar. Tente de novo antes de trocar de turno.";

/** "Esta passagem já foi entregue por {nome} às {HH:mm}." (hora de São Paulo) */
export function alreadyDeliveredMessage(
  deliveredByName: string,
  deliveredAt: Date,
): string {
  return `Esta passagem já foi entregue por ${deliveredByName} às ${formatTimeBR(deliveredAt)}.`;
}

/** "Esta passagem já foi confirmada por {nome} às {HH:mm}." (hora de São Paulo) */
export function alreadyConfirmedMessage(
  confirmedByName: string,
  confirmedAt: Date,
): string {
  return `Esta passagem já foi confirmada por ${confirmedByName} às ${formatTimeBR(confirmedAt)}.`;
}
