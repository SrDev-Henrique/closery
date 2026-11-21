import { describe, expect, it } from "vitest";

import { buildInviteUrl, isHttpUrl } from "./inviteUrl";

const TOKEN = "t".repeat(43);

describe("buildInviteUrl", () => {
  it("monta o link a partir da origem", () => {
    expect(buildInviteUrl("http://localhost:3000", TOKEN)).toBe(
      `http://localhost:3000/convite/${TOKEN}`,
    );
  });

  it("não duplica a barra quando baseURL termina em /", () => {
    expect(buildInviteUrl("https://closery.example/", TOKEN)).toBe(
      `https://closery.example/convite/${TOKEN}`,
    );
  });

  it("ignora caminho, query e hash de baseURL", () => {
    expect(buildInviteUrl("https://closery.example/app?x=1#y", TOKEN)).toBe(
      `https://closery.example/convite/${TOKEN}`,
    );
  });

  it("lança para baseURL que não é URL http(s) absoluta", () => {
    expect(() => buildInviteUrl("closery.example", TOKEN)).toThrow();
    expect(() => buildInviteUrl("", TOKEN)).toThrow();
    expect(() => buildInviteUrl("localhost:3000", TOKEN)).toThrow(
      "URL base inválida para o convite",
    );
    expect(() => buildInviteUrl("ftp://closery.example", TOKEN)).toThrow();
  });
});

describe("isHttpUrl", () => {
  it("aceita http e https", () => {
    expect(isHttpUrl("http://localhost:3000")).toBe(true);
    expect(isHttpUrl("https://closery.example/x")).toBe(true);
  });

  it("rejeita sem esquema, outros esquemas e lixo", () => {
    expect(isHttpUrl("localhost:3000")).toBe(false);
    expect(isHttpUrl("closery.example")).toBe(false);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
  });
});
