import { describe, expect, it } from "vitest";

import {
  AUTH_ERROR_MESSAGES,
  authErrorMessage,
  FALLBACK_AUTH_ERROR,
} from "./errors";

const EXPECTED: ReadonlyArray<readonly [string, string]> = [
  [
    "SIGNUP_INVITE_ONLY",
    "O cadastro é só por convite. Abra de novo o link que você recebeu.",
  ],
  ["signup_disabled", "Conta não encontrada. Peça um convite."],
  [
    "ACCOUNT_DEACTIVATED",
    "Esta conta foi desativada. Fale com o administrador.",
  ],
  [
    "USER_ALREADY_EXISTS",
    'Já existe uma conta com este e-mail. Entre por "Entrar".',
  ],
  [
    "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
    'Já existe uma conta com este e-mail. Entre por "Entrar".',
  ],
  ["INVALID_EMAIL_OR_PASSWORD", "E-mail ou senha incorretos."],
  ["INVALID_EMAIL", "Informe um e-mail válido."],
  [
    "INVALID_TOKEN",
    "Este link de redefinição venceu ou já foi usado. Peça outro ao administrador.",
  ],
  ["PASSWORD_TOO_SHORT", "A senha precisa ter pelo menos 8 caracteres."],
  ["PASSWORD_TOO_LONG", "A senha pode ter no máximo 128 caracteres."],
  [
    "email_not_found",
    "Essa conta não informou um e-mail. Use outro jeito de entrar.",
  ],
  [
    "account_not_linked",
    "Esse e-mail já tem conta com outro jeito de entrar. Entre como da primeira vez.",
  ],
  ["unable_to_create_user", "Não foi possível criar a conta. Tente de novo."],
  ["access_denied", "Você cancelou o acesso. Tente de novo quando quiser."],
  [
    "SESSION_NOT_FRESH",
    "Por segurança, entre de novo antes de criar uma passkey.",
  ],
  ["AUTH_CANCELLED", "Login com passkey cancelado."],
  ["REGISTRATION_CANCELLED", "Criação da passkey cancelada."],
  ["PREVIOUSLY_REGISTERED", "Esta passkey já está cadastrada."],
  ["AUTHENTICATION_FAILED", "Não foi possível entrar com a passkey."],
  ["PASSKEY_NOT_FOUND", "Passkey não encontrada."],
  [
    "RATE_LIMITED",
    "Muitas tentativas nesta rede. Espere um minuto e tente de novo.",
  ],
];

describe("authErrorMessage", () => {
  it("o fallback é o texto do contrato", () => {
    expect(FALLBACK_AUTH_ERROR).toBe(
      "Não foi possível concluir. Tente de novo.",
    );
  });

  it("o mapa tem exatamente os 21 códigos do contrato", () => {
    expect(Object.keys(AUTH_ERROR_MESSAGES).sort()).toEqual(
      EXPECTED.map(([code]) => code).sort(),
    );
  });

  it.each(EXPECTED)("traduz %s", (code, message) => {
    expect(authErrorMessage(code)).toBe(message);
  });

  it.each([
    undefined,
    null,
    "",
    "CODIGO_QUE_NAO_EXISTE",
    "signup_Disabled",
  ])("devolve o fallback para %s", (code) => {
    expect(authErrorMessage(code)).toBe(FALLBACK_AUTH_ERROR);
  });

  it.each([
    "toString",
    "constructor",
    "__proto__",
    "hasOwnProperty",
  ])("não confunde %s (propriedade herdada) com um código", (code) => {
    expect(authErrorMessage(code)).toBe(FALLBACK_AUTH_ERROR);
  });

  it("nunca devolve o código cru nem texto do servidor", () => {
    const hostile = "<script>alert(1)</script> Sua conta foi hackeada";
    expect(authErrorMessage(hostile)).toBe(FALLBACK_AUTH_ERROR);
    for (const [code] of EXPECTED) {
      expect(authErrorMessage(code)).not.toBe(code);
    }
  });

  it("o mapa é imutável", () => {
    expect(Object.isFrozen(AUTH_ERROR_MESSAGES)).toBe(true);
  });
});
