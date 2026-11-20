export const FALLBACK_AUTH_ERROR = "Não foi possível concluir. Tente de novo.";

const ALREADY_EXISTS =
  'Já existe uma conta com este e-mail. Entre por "Entrar".';

export const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> =
  Object.freeze({
    SIGNUP_INVITE_ONLY:
      "O cadastro é só por convite. Abra de novo o link que você recebeu.",
    signup_disabled: "Conta não encontrada. Peça um convite.",
    ACCOUNT_DEACTIVATED: "Esta conta foi desativada. Fale com o administrador.",
    USER_ALREADY_EXISTS: ALREADY_EXISTS,
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: ALREADY_EXISTS,
    INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
    INVALID_EMAIL: "Informe um e-mail válido.",
    PASSWORD_TOO_SHORT: "A senha precisa ter pelo menos 8 caracteres.",
    PASSWORD_TOO_LONG: "A senha pode ter no máximo 128 caracteres.",
    email_not_found:
      "Essa conta não informou um e-mail. Use outro jeito de entrar.",
    account_not_linked:
      "Esse e-mail já tem conta com outro jeito de entrar. Entre como da primeira vez.",
    unable_to_create_user: "Não foi possível criar a conta. Tente de novo.",
    access_denied: "Você cancelou o acesso. Tente de novo quando quiser.",
    SESSION_NOT_FRESH:
      "Por segurança, entre de novo antes de criar uma passkey.",
    AUTH_CANCELLED: "Login com passkey cancelado.",
    REGISTRATION_CANCELLED: "Criação da passkey cancelada.",
    PREVIOUSLY_REGISTERED: "Esta passkey já está cadastrada.",
    AUTHENTICATION_FAILED: "Não foi possível entrar com a passkey.",
    PASSKEY_NOT_FOUND: "Passkey não encontrada.",
  });

// Sempre devolve texto do mapa ou o fallback: o texto cru do servidor (por
// exemplo `error_description` na URL de retorno do OAuth) nunca chega à tela.
export function authErrorMessage(code: string | null | undefined): string {
  if (!code || !Object.hasOwn(AUTH_ERROR_MESSAGES, code)) {
    return FALLBACK_AUTH_ERROR;
  }
  return AUTH_ERROR_MESSAGES[code] ?? FALLBACK_AUTH_ERROR;
}
