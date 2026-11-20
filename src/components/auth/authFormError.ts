import { authErrorMessage } from "@/lib/auth/errors";

export type AuthFieldName = "email" | "password";
export type AuthFormError = { message: string; field: AuthFieldName | null };

const FIELD_BY_CODE: Readonly<Record<string, AuthFieldName>> = {
  INVALID_EMAIL: "email",
  USER_ALREADY_EXISTS: "email",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "email",
  PASSWORD_TOO_SHORT: "password",
  PASSWORD_TOO_LONG: "password",
};

// Mensagem em pt-BR + o campo que deve receber aria-invalid. O texto vem
// sempre do mapa do contrato, nunca cru do servidor.
export function authFormError(code: string | null | undefined): AuthFormError {
  const field =
    code && Object.hasOwn(FIELD_BY_CODE, code)
      ? (FIELD_BY_CODE[code] ?? null)
      : null;
  return { message: authErrorMessage(code), field };
}

// Alguns erros do Better Auth (ex.: signIn.passkey) vêm sem `code` no tipo, e
// o bloqueio do limite de tentativas (429) vem sem `code` algum.
export function errorCodeOf(error: object): string | null {
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("status" in error && error.status === 429) return "RATE_LIMITED";
  return null;
}
