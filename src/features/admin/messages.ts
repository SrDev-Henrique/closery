import { pluralize } from "@/lib/plural";

export type AdminEntity = "setor" | "turno" | "item" | "destino" | "pessoa";

const NAME_TAKEN: Record<Exclude<AdminEntity, "pessoa">, string> = {
  setor: "Já existe um setor com este nome.",
  turno: "Já existe um turno com este nome neste setor.",
  item: "Já existe um item com este nome neste setor.",
  destino: "Já existe um destino com este nome.",
};

const NOT_FOUND: Record<AdminEntity, string> = {
  setor: "Setor não encontrado. Atualize a página.",
  turno: "Turno não encontrado. Atualize a página.",
  item: "Item não encontrado. Atualize a página.",
  destino: "Destino não encontrado. Atualize a página.",
  pessoa: "Pessoa não encontrada. Atualize a página.",
};

/** `inactive`: o registro que já tem o nome está desativado; a tela diz onde reativar. */
export function nameTakenMessage(
  entity: Exclude<AdminEntity, "pessoa">,
  inactive: boolean,
): string {
  const base = NAME_TAKEN[entity];
  return inactive ? `${base} Ele está inativo: reative-o na lista.` : base;
}

export function notFoundMessage(entity: AdminEntity): string {
  return NOT_FOUND[entity];
}

/** Só faz sentido com pelo menos uma pessoa ou um convite; com zero e zero lança. */
export function sectorBlockedMessage(people: number, invites: number): string {
  const peopleText = pluralize(people, "pessoa ativa", "pessoas ativas");
  const invitesText = pluralize(
    invites,
    "convite pendente",
    "convites pendentes",
  );
  if (people > 0 && invites > 0) {
    return `Este setor tem ${peopleText} e ${invitesText}. Mova, desative ou cancele antes.`;
  }
  if (people > 0)
    return `Este setor tem ${peopleText}. Mova ou desative antes.`;
  if (invites > 0) return `Este setor tem ${invitesText}. Cancele antes.`;
  throw new RangeError(
    "O setor não tem pessoas nem convites: nada o bloqueia.",
  );
}

export const SELF_DEACTIVATE_MESSAGE =
  "Você não pode desativar a sua própria conta. Peça a outro administrador.";
export const SELF_ROLE_MESSAGE =
  "Você não pode mudar o seu próprio papel. Peça a outro administrador.";
export const LAST_ADMIN_MESSAGE =
  "Este é o último administrador ativo. Nomeie outro antes.";
export const SECTOR_REQUIRED_MESSAGE = "Escolha o setor do operador.";
export const SECTOR_COLOR_INVALID_MESSAGE = "Escolha uma das cores da lista.";
export const SECTOR_INACTIVE_MESSAGE =
  "Este setor está inativo. Escolha outro.";
export const INVITE_NOT_PENDING_MESSAGE =
  "Este convite não está mais pendente. Atualize a página.";
export const INVITE_LABEL_TOO_LONG_MESSAGE =
  "O nome de referência pode ter no máximo 80 caracteres.";
export const PERSON_SECTOR_INACTIVE_MESSAGE =
  "O setor desta pessoa está inativo. Edite a pessoa e escolha outro setor antes de reativar.";
export const PERSON_RESET_INACTIVE_MESSAGE =
  "Esta conta está desativada. Reative antes de gerar um link de redefinição.";
export const PASSWORD_RESET_FORBIDDEN_MESSAGE =
  "Só administradores geram links de redefinição.";
