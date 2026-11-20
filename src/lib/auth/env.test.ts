import { describe, expect, it } from "vitest";

import { enabledSocialProviders, parseAuthEnv } from "./env";

const SECRET = "x".repeat(32);

const VALID = {
  BETTER_AUTH_SECRET: SECRET,
  BETTER_AUTH_URL: "http://localhost:3000",
};

describe("parseAuthEnv", () => {
  it("aceita o mínimo e deixa os provedores sociais como null", () => {
    expect(parseAuthEnv(VALID)).toEqual({
      secret: SECRET,
      baseURL: "http://localhost:3000",
      google: null,
      facebook: null,
    });
  });

  it("normaliza a URL para a origem (sem barra final nem caminho)", () => {
    const env = parseAuthEnv({
      ...VALID,
      BETTER_AUTH_URL: "https://closery.app/",
    });
    expect(env.baseURL).toBe("https://closery.app");
  });

  it("falha dizendo que BETTER_AUTH_SECRET está ausente", () => {
    expect(() =>
      parseAuthEnv({ BETTER_AUTH_URL: VALID.BETTER_AUTH_URL }),
    ).toThrow(/BETTER_AUTH_SECRET.*ausente/);
  });

  it("trata string vazia como ausente", () => {
    expect(() => parseAuthEnv({ ...VALID, BETTER_AUTH_SECRET: "" })).toThrow(
      /BETTER_AUTH_SECRET.*ausente/,
    );
    expect(() => parseAuthEnv({ ...VALID, BETTER_AUTH_SECRET: "   " })).toThrow(
      /BETTER_AUTH_SECRET.*ausente/,
    );
  });

  it("recusa secret com menos de 32 caracteres (limite: 31 falha, 32 passa)", () => {
    expect(() =>
      parseAuthEnv({ ...VALID, BETTER_AUTH_SECRET: "x".repeat(31) }),
    ).toThrow(/BETTER_AUTH_SECRET.*32 caracteres/);
    expect(
      parseAuthEnv({ ...VALID, BETTER_AUTH_SECRET: "x".repeat(32) }).secret,
    ).toHaveLength(32);
  });

  it("falha quando BETTER_AUTH_URL está ausente", () => {
    expect(() => parseAuthEnv({ BETTER_AUTH_SECRET: SECRET })).toThrow(
      /BETTER_AUTH_URL.*ausente/,
    );
  });

  it.each([
    "not-a-url",
    "localhost:3000",
    "ftp://closery.app",
    "javascript:alert(1)",
  ])("recusa BETTER_AUTH_URL inválida: %s", (value) => {
    expect(() => parseAuthEnv({ ...VALID, BETTER_AUTH_URL: value })).toThrow(
      /BETTER_AUTH_URL/,
    );
  });

  it("lista todos os problemas de uma vez", () => {
    expect(() => parseAuthEnv({})).toThrow(
      /BETTER_AUTH_SECRET[\s\S]*BETTER_AUTH_URL/,
    );
  });

  it("habilita Google quando id e secret estão completos", () => {
    const env = parseAuthEnv({
      ...VALID,
      GOOGLE_CLIENT_ID: "gid",
      GOOGLE_CLIENT_SECRET: "gsecret",
    });
    expect(env.google).toEqual({ clientId: "gid", clientSecret: "gsecret" });
    expect(env.facebook).toBeNull();
    expect(enabledSocialProviders(env)).toEqual(["google"]);
  });

  it("habilita os dois provedores, na ordem google, facebook", () => {
    const env = parseAuthEnv({
      ...VALID,
      GOOGLE_CLIENT_ID: "gid",
      GOOGLE_CLIENT_SECRET: "gsecret",
      FACEBOOK_CLIENT_ID: "fid",
      FACEBOOK_CLIENT_SECRET: "fsecret",
    });
    expect(enabledSocialProviders(env)).toEqual(["google", "facebook"]);
  });

  it("sem nenhum provedor, enabledSocialProviders é vazio", () => {
    expect(enabledSocialProviders(parseAuthEnv(VALID))).toEqual([]);
  });

  it("recusa par incompleto: só o id do Google", () => {
    expect(() => parseAuthEnv({ ...VALID, GOOGLE_CLIENT_ID: "gid" })).toThrow(
      /GOOGLE_CLIENT_SECRET.*ausente/,
    );
  });

  it("recusa par incompleto: só o secret do Facebook", () => {
    expect(() =>
      parseAuthEnv({ ...VALID, FACEBOOK_CLIENT_SECRET: "fsecret" }),
    ).toThrow(/FACEBOOK_CLIENT_ID.*ausente/);
  });

  it("par com um lado vazio conta como incompleto", () => {
    expect(() =>
      parseAuthEnv({
        ...VALID,
        GOOGLE_CLIENT_ID: "gid",
        GOOGLE_CLIENT_SECRET: "",
      }),
    ).toThrow(/GOOGLE_CLIENT_SECRET.*ausente/);
  });

  it("par totalmente vazio conta como provedor desligado", () => {
    const env = parseAuthEnv({
      ...VALID,
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    });
    expect(env.google).toBeNull();
  });

  it("a mensagem de erro nunca contém o valor do secret", () => {
    const secret = "curto-demais-mas-sigiloso";
    try {
      parseAuthEnv({ ...VALID, BETTER_AUTH_SECRET: secret });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
