import { describe, expect, it } from "vitest";

import { toAuthz } from "@/features/authz/authz";

import { authzOf } from "./authz";

describe("authzOf", () => {
  it("admin sai sem setor, mesmo que um setor seja informado", () => {
    expect(authzOf({ role: "admin" }).sectorId).toBeNull();
    expect(authzOf({ role: "admin", sectorId: "s1" }).sectorId).toBeNull();
  });

  it("operador sai com o setor informado", () => {
    expect(authzOf({ role: "operator", sectorId: "s1" })).toMatchObject({
      role: "operator",
      sectorId: "s1",
    });
  });

  it("operador sem setor informado ganha um setor padrão (nunca null)", () => {
    expect(authzOf({ role: "operator" }).sectorId).toEqual(expect.any(String));
  });

  it("operador com sectorId null lança: esse estado não existe de verdade", () => {
    expect(() => authzOf({ role: "operator", sectorId: null })).toThrow(
      "operador exige um setor",
    );
  });

  it("usa os campos informados e tem padrões estáveis", () => {
    expect(
      authzOf({
        role: "admin",
        userId: "u9",
        name: "Ana Teste",
        email: "ana@example.test",
      }),
    ).toEqual({
      userId: "u9",
      name: "Ana Teste",
      email: "ana@example.test",
      role: "admin",
      sectorId: null,
    });
    const padrao = authzOf({ role: "admin" });
    expect(padrao.userId).toBe("user-admin");
    expect(padrao.email).toBe("user-admin@example.test");
  });

  it("o resultado é o mesmo que toAuthz devolveria para a sessão correspondente", () => {
    const operator = authzOf({ role: "operator", sectorId: "s1" });
    expect(
      toAuthz({
        id: operator.userId,
        name: operator.name,
        email: operator.email,
        role: "operator",
        sectorId: "s1",
      }),
    ).toEqual(operator);
  });
});
