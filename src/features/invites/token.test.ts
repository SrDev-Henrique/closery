import { describe, expect, it } from "vitest";

import {
  generateInviteToken,
  hashInviteToken,
  INVITE_TOKEN_PATTERN,
  isWellFormedInviteToken,
} from "./token";

describe("generateInviteToken", () => {
  it("gera token base64url de 43 caracteres e hash sha256 hex de 64", () => {
    const { token, tokenHash } = generateInviteToken();

    expect(token).toHaveLength(43);
    expect(token).toMatch(INVITE_TOKEN_PATTERN);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("devolve o hash do próprio token", () => {
    const { token, tokenHash } = generateInviteToken();

    expect(hashInviteToken(token)).toBe(tokenHash);
  });

  it("gera tokens e hashes diferentes a cada chamada", () => {
    const tokens = new Set<string>();
    const hashes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const { token, tokenHash } = generateInviteToken();
      tokens.add(token);
      hashes.add(tokenHash);
    }

    expect(tokens.size).toBe(50);
    expect(hashes.size).toBe(50);
  });
});

describe("hashInviteToken", () => {
  it("é determinístico e não devolve o token", () => {
    const token = "a".repeat(43);

    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
    expect(hashInviteToken(token)).not.toContain(token);
  });

  it("muda quando o token muda em um caractere", () => {
    expect(hashInviteToken("a".repeat(43))).not.toBe(
      hashInviteToken(`${"a".repeat(42)}b`),
    );
  });

  it("bate com o vetor conhecido do SHA-256", () => {
    expect(hashInviteToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("isWellFormedInviteToken", () => {
  it("aceita token gerado e os limites do alfabeto base64url", () => {
    expect(isWellFormedInviteToken(generateInviteToken().token)).toBe(true);
    expect(isWellFormedInviteToken("-".repeat(43))).toBe(true);
    expect(isWellFormedInviteToken("_".repeat(43))).toBe(true);
  });

  it("rejeita token curto, longo e vazio", () => {
    expect(isWellFormedInviteToken("a".repeat(42))).toBe(false);
    expect(isWellFormedInviteToken("a".repeat(44))).toBe(false);
    expect(isWellFormedInviteToken("")).toBe(false);
  });

  it("rejeita caracteres fora do alfabeto, inclusive quebra de linha final", () => {
    expect(isWellFormedInviteToken(`${"a".repeat(42)}+`)).toBe(false);
    expect(isWellFormedInviteToken(`${"a".repeat(42)}/`)).toBe(false);
    expect(isWellFormedInviteToken(`${"a".repeat(42)}=`)).toBe(false);
    expect(isWellFormedInviteToken(`${"a".repeat(42)} `)).toBe(false);
    expect(isWellFormedInviteToken(`${"a".repeat(42)}\n`)).toBe(false);
    expect(isWellFormedInviteToken(`${"a".repeat(42)}é`)).toBe(false);
  });

  it("rejeita o que não é string", () => {
    expect(isWellFormedInviteToken(undefined)).toBe(false);
    expect(isWellFormedInviteToken(null)).toBe(false);
    expect(isWellFormedInviteToken(123)).toBe(false);
    expect(isWellFormedInviteToken(["a".repeat(43)])).toBe(false);
    expect(isWellFormedInviteToken({})).toBe(false);
  });
});
