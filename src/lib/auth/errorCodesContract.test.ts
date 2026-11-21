import { BASE_ERROR_CODES } from "@better-auth/core/error";
import { PASSKEY_ERROR_CODES } from "@better-auth/passkey";
import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";

import { AUTH_ERROR_MESSAGES } from "./errors";

// Se um upgrade do Better Auth renomear um código, este teste cai antes de a
// tela passar a mostrar o texto genérico em silêncio.

const CORE_CODES = [
  "USER_ALREADY_EXISTS",
  "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
  "INVALID_EMAIL_OR_PASSWORD",
  "INVALID_EMAIL",
  "PASSWORD_TOO_SHORT",
  "PASSWORD_TOO_LONG",
  "SESSION_NOT_FRESH",
] as const;

const PASSKEY_CODES = [
  "PREVIOUSLY_REGISTERED",
  "REGISTRATION_CANCELLED",
  "AUTH_CANCELLED",
  "AUTHENTICATION_FAILED",
  "PASSKEY_NOT_FOUND",
] as const;

// Código só do cliente: authFormError.errorCodeOf o deduz de status 429 (o
// Better Auth responde 429 sem `code`).
const CLIENT_CODES = ["RATE_LIMITED"] as const;

// Códigos nossos (lançados em createAuth) e de redirect do OAuth (texto fixo no
// Better Auth, sem objeto de erro exportado).
const OWN_OR_OAUTH_CODES = [
  "SIGNUP_INVITE_ONLY",
  "ACCOUNT_DEACTIVATED",
  "signup_disabled",
  "email_not_found",
  "account_not_linked",
  "unable_to_create_user",
  "access_denied",
] as const;

describe("contrato dos códigos de erro do Better Auth", () => {
  it.each(CORE_CODES)("o core ainda exporta %s", (code) => {
    expect(BASE_ERROR_CODES[code].code).toBe(code);
  });

  it.each(PASSKEY_CODES)("o plugin passkey ainda exporta %s", (code) => {
    expect(PASSKEY_ERROR_CODES[code].code).toBe(code);
  });

  it.each(CORE_CODES)("APIError.from carrega body.code %s", (code) => {
    const error = APIError.from("BAD_REQUEST", BASE_ERROR_CODES[code]);
    expect((error.body as { code?: string }).code).toBe(code);
  });

  it("todo código do mapa é coberto por um dos grupos acima (e vice-versa)", () => {
    const covered = [
      ...CORE_CODES,
      ...PASSKEY_CODES,
      ...OWN_OR_OAUTH_CODES,
      ...CLIENT_CODES,
    ];
    expect(Object.keys(AUTH_ERROR_MESSAGES).sort()).toEqual(
      [...covered].sort(),
    );
  });
});
