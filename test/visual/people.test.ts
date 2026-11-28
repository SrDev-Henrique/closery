import { describe, expect, it } from "vitest";

import { signUpOutcome } from "../../scripts/visual/people.mjs";

// A leitura da resposta do sign-up do visual:people: "já existe" é sucesso (rodar duas
// vezes não quebra); o resto que não é 2xx falha.

describe("signUpOutcome", () => {
  it("2xx é cadastro novo", () => {
    expect(signUpOutcome(200, '{"token":null}')).toBe("ok");
    expect(signUpOutcome(201, "")).toBe("ok");
  });

  it("422 com USER_ALREADY_EXISTS é 'já existe'", () => {
    expect(
      signUpOutcome(
        422,
        '{"code":"USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL","message":"User already exists. Use another email."}',
      ),
    ).toBe("existe");
    expect(signUpOutcome(422, '{"code":"USER_ALREADY_EXISTS"}')).toBe("existe");
  });

  it("o resto falha: 422 de outro motivo, convite recusado, limite e erro do servidor", () => {
    expect(signUpOutcome(422, '{"code":"FAILED_TO_CREATE_USER"}')).toBe(
      "falhou",
    );
    expect(signUpOutcome(403, '{"code":"USER_ALREADY_EXISTS"}')).toBe("falhou");
    expect(signUpOutcome(429, "")).toBe("falhou");
    expect(signUpOutcome(500, "")).toBe("falhou");
    expect(signUpOutcome(0, "")).toBe("falhou");
  });
});
