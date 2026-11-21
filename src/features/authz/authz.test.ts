import { describe, expect, it } from "vitest";

import { type Authz, canAccessSector, isAdmin, toAuthz } from "./authz";

const SECTOR_A = "11111111-1111-4111-8111-111111111111";
const SECTOR_B = "22222222-2222-4222-8222-222222222222";

const BASE = { id: "u1", name: "Pessoa Um", email: "um@example.com" };

describe("toAuthz", () => {
  it("admin vira Authz com sectorId null", () => {
    expect(toAuthz({ ...BASE, role: "admin", sectorId: null })).toEqual({
      userId: "u1",
      name: "Pessoa Um",
      email: "um@example.com",
      role: "admin",
      sectorId: null,
    });
  });

  it("admin com setor gravado no banco continua sem setor (admin vê todos)", () => {
    expect(
      toAuthz({ ...BASE, role: "admin", sectorId: SECTOR_A })?.sectorId,
    ).toBe(null);
  });

  it("operador com setor mantém o setor", () => {
    expect(toAuthz({ ...BASE, role: "operator", sectorId: SECTOR_A })).toEqual({
      userId: "u1",
      name: "Pessoa Um",
      email: "um@example.com",
      role: "operator",
      sectorId: SECTOR_A,
    });
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["string vazia", ""],
  ])("operador com sectorId %s → null", (_label, sectorId) => {
    expect(toAuthz({ ...BASE, role: "operator", sectorId })).toBeNull();
  });

  it("operador com sectorId que não é string → null", () => {
    expect(toAuthz({ ...BASE, role: "operator", sectorId: 42 })).toBeNull();
  });

  it("desativado (Date) → null, mesmo sendo admin", () => {
    expect(
      toAuthz({
        ...BASE,
        role: "admin",
        sectorId: null,
        deactivatedAt: new Date(0),
      }),
    ).toBeNull();
  });

  it("desativado (string ISO) → null", () => {
    expect(
      toAuthz({
        ...BASE,
        role: "operator",
        sectorId: SECTOR_A,
        deactivatedAt: "2026-11-20T00:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("deactivatedAt null ou ausente não desativa", () => {
    expect(
      toAuthz({ ...BASE, role: "admin", sectorId: null, deactivatedAt: null }),
    ).not.toBeNull();
    expect(toAuthz({ ...BASE, role: "admin", sectorId: null })).not.toBeNull();
  });

  it.each([
    ["superuser"],
    ["ADMIN"],
    [""],
    [null],
    [undefined],
    [1],
    [{ toString: () => "admin" }],
  ])("role desconhecido (%j) → null", (role) => {
    expect(toAuthz({ ...BASE, role, sectorId: SECTOR_A })).toBeNull();
  });

  it("sem role → null", () => {
    expect(toAuthz({ ...BASE, sectorId: SECTOR_A })).toBeNull();
  });

  it.each([null, undefined])("user %s → null", (user) => {
    expect(toAuthz(user)).toBeNull();
  });
});

describe("isAdmin", () => {
  const admin: Authz = {
    userId: "a",
    name: "A",
    email: "a@example.com",
    role: "admin",
    sectorId: null,
  };
  const operator: Authz = { ...admin, role: "operator", sectorId: SECTOR_A };

  it("é true só para admin", () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(operator)).toBe(false);
  });

  describe("canAccessSector", () => {
    it("admin acessa qualquer setor", () => {
      expect(canAccessSector(admin, SECTOR_A)).toBe(true);
      expect(canAccessSector(admin, SECTOR_B)).toBe(true);
    });

    it("operador acessa só o próprio setor", () => {
      expect(canAccessSector(operator, SECTOR_A)).toBe(true);
      expect(canAccessSector(operator, SECTOR_B)).toBe(false);
    });

    it("operador não acessa setor vazio", () => {
      expect(canAccessSector(operator, "")).toBe(false);
    });

    it("operador sem setor (estado inválido) não acessa nada", () => {
      const broken: Authz = { ...operator, sectorId: null };
      expect(canAccessSector(broken, SECTOR_A)).toBe(false);
      expect(canAccessSector(broken, "")).toBe(false);
    });
  });
});
