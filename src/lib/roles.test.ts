import { describe, expect, it } from "vitest";

import { isRole, ROLES } from "./roles";

describe("isRole", () => {
  it("aceita os papéis conhecidos", () => {
    for (const role of ROLES) {
      expect(isRole(role)).toBe(true);
    }
  });

  it("rejeita papel desconhecido, caixa diferente, vazio e não-string", () => {
    expect(isRole("owner")).toBe(false);
    expect(isRole("Admin")).toBe(false);
    expect(isRole("")).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(1)).toBe(false);
    expect(isRole({ role: "admin" })).toBe(false);
  });
});
