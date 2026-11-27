import { describe, expect, it } from "vitest";

import {
  INVITE_LABEL_TOO_LONG_MESSAGE,
  INVITE_NOT_PENDING_MESSAGE,
  LAST_ADMIN_MESSAGE,
  nameTakenMessage,
  notFoundMessage,
  PASSWORD_RESET_FORBIDDEN_MESSAGE,
  PERSON_RESET_INACTIVE_MESSAGE,
  PERSON_SECTOR_INACTIVE_MESSAGE,
  SECTOR_INACTIVE_MESSAGE,
  SECTOR_REQUIRED_MESSAGE,
  SELF_DEACTIVATE_MESSAGE,
  SELF_ROLE_MESSAGE,
  sectorBlockedMessage,
} from "@/features/admin/messages";

describe("nameTakenMessage", () => {
  it("diz o que já existe, por entidade", () => {
    expect(nameTakenMessage("setor", false)).toBe(
      "Já existe um setor com este nome.",
    );
    expect(nameTakenMessage("turno", false)).toBe(
      "Já existe um turno com este nome neste setor.",
    );
    expect(nameTakenMessage("item", false)).toBe(
      "Já existe um item com este nome neste setor.",
    );
    expect(nameTakenMessage("destino", false)).toBe(
      "Já existe um destino com este nome.",
    );
  });

  it("acrescenta a dica de reativar quando o conflitante está inativo", () => {
    expect(nameTakenMessage("setor", true)).toBe(
      "Já existe um setor com este nome. Ele está inativo: reative-o na lista.",
    );
    expect(nameTakenMessage("turno", true)).toBe(
      "Já existe um turno com este nome neste setor. Ele está inativo: reative-o na lista.",
    );
  });
});

describe("notFoundMessage", () => {
  it("uma mensagem por entidade", () => {
    expect(notFoundMessage("setor")).toBe(
      "Setor não encontrado. Atualize a página.",
    );
    expect(notFoundMessage("turno")).toBe(
      "Turno não encontrado. Atualize a página.",
    );
    expect(notFoundMessage("item")).toBe(
      "Item não encontrado. Atualize a página.",
    );
    expect(notFoundMessage("destino")).toBe(
      "Destino não encontrado. Atualize a página.",
    );
    expect(notFoundMessage("pessoa")).toBe(
      "Pessoa não encontrada. Atualize a página.",
    );
  });
});

describe("sectorBlockedMessage", () => {
  it("pessoas e convites, no plural", () => {
    expect(sectorBlockedMessage(3, 2)).toBe(
      "Este setor tem 3 pessoas ativas e 2 convites pendentes. Mova, desative ou cancele antes.",
    );
  });

  it("pessoas e convites, no singular", () => {
    expect(sectorBlockedMessage(1, 1)).toBe(
      "Este setor tem 1 pessoa ativa e 1 convite pendente. Mova, desative ou cancele antes.",
    );
  });

  it("só pessoas", () => {
    expect(sectorBlockedMessage(3, 0)).toBe(
      "Este setor tem 3 pessoas ativas. Mova ou desative antes.",
    );
    expect(sectorBlockedMessage(1, 0)).toBe(
      "Este setor tem 1 pessoa ativa. Mova ou desative antes.",
    );
  });

  it("só convites", () => {
    expect(sectorBlockedMessage(0, 2)).toBe(
      "Este setor tem 2 convites pendentes. Cancele antes.",
    );
    expect(sectorBlockedMessage(0, 1)).toBe(
      "Este setor tem 1 convite pendente. Cancele antes.",
    );
  });

  it("sem pessoas nem convites não há o que dizer: lança RangeError", () => {
    expect(() => sectorBlockedMessage(0, 0)).toThrow(RangeError);
  });
});

describe("mensagens fixas", () => {
  it("são os textos da tabela de mensagens de domínio", () => {
    expect(SELF_DEACTIVATE_MESSAGE).toBe(
      "Você não pode desativar a sua própria conta. Peça a outro administrador.",
    );
    expect(SELF_ROLE_MESSAGE).toBe(
      "Você não pode mudar o seu próprio papel. Peça a outro administrador.",
    );
    expect(LAST_ADMIN_MESSAGE).toBe(
      "Este é o último administrador ativo. Nomeie outro antes.",
    );
    expect(SECTOR_REQUIRED_MESSAGE).toBe("Escolha o setor do operador.");
    expect(SECTOR_INACTIVE_MESSAGE).toBe(
      "Este setor está inativo. Escolha outro.",
    );
    expect(INVITE_NOT_PENDING_MESSAGE).toBe(
      "Este convite não está mais pendente. Atualize a página.",
    );
    expect(INVITE_LABEL_TOO_LONG_MESSAGE).toBe(
      "O nome de referência pode ter no máximo 80 caracteres.",
    );
    expect(PERSON_SECTOR_INACTIVE_MESSAGE).toBe(
      "O setor desta pessoa está inativo. Edite a pessoa e escolha outro setor antes de reativar.",
    );
    expect(PERSON_RESET_INACTIVE_MESSAGE).toBe(
      "Esta conta está desativada. Reative antes de gerar um link de redefinição.",
    );
    expect(PASSWORD_RESET_FORBIDDEN_MESSAGE).toBe(
      "Só administradores geram links de redefinição.",
    );
  });
});
