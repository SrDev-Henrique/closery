import { describe, expect, it } from "vitest";
import { FALLBACK_AUTH_ERROR } from "@/lib/auth/errors";
import { authFormError, errorCodeOf } from "./authFormError";

describe("authFormError", () => {
  it.each([
    ["INVALID_EMAIL", "email"],
    ["USER_ALREADY_EXISTS", "email"],
    ["USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", "email"],
    ["PASSWORD_TOO_SHORT", "password"],
    ["PASSWORD_TOO_LONG", "password"],
  ] as const)("%s aponta para o campo %s", (code, field) => {
    expect(authFormError(code).field).toBe(field);
  });

  it("erros gerais não apontam para campo", () => {
    expect(authFormError("INVALID_EMAIL_OR_PASSWORD")).toEqual({
      message: "E-mail ou senha incorretos.",
      field: null,
    });
  });

  it("código desconhecido, vazio ou ausente cai no texto padrão", () => {
    for (const code of ["QUALQUER_COISA", "", null, undefined]) {
      expect(authFormError(code)).toEqual({
        message: FALLBACK_AUTH_ERROR,
        field: null,
      });
    }
  });

  it("nunca repassa texto cru do servidor", () => {
    expect(authFormError("<script>alert(1)</script>").message).toBe(
      FALLBACK_AUTH_ERROR,
    );
  });
});

describe("errorCodeOf", () => {
  it("lê o code quando é texto", () => {
    expect(errorCodeOf({ code: "AUTH_CANCELLED", status: 400 })).toBe(
      "AUTH_CANCELLED",
    );
  });

  it("devolve null sem code ou com code que não é texto", () => {
    expect(errorCodeOf({ status: 500 })).toBeNull();
    expect(errorCodeOf({ code: 42 })).toBeNull();
    expect(errorCodeOf({})).toBeNull();
  });

  it("429 sem code vira RATE_LIMITED", () => {
    expect(errorCodeOf({ status: 429, statusText: "Too Many Requests" })).toBe(
      "RATE_LIMITED",
    );
  });

  it("429 com code mantém o code", () => {
    expect(errorCodeOf({ status: 429, code: "OUTRO" })).toBe("OUTRO");
  });

  it("outros status sem code continuam null", () => {
    expect(errorCodeOf({ status: 500 })).toBeNull();
    expect(errorCodeOf({ status: 429.5 })).toBeNull();
  });
});
