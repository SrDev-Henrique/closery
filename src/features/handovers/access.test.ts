import { describe, expect, it } from "vitest";

import type { HandoverStatus } from "@/db/schema/handovers";
import type { Authz } from "@/features/authz/authz";

import {
  formModeOf,
  type HandoverCapabilities,
  handoverCapabilities,
} from "./access";

const SECTOR_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SECTOR_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function operator(userId: string, sectorId: string): Authz {
  return {
    userId,
    name: "Ana Teste",
    email: `${userId}@example.test`,
    role: "operator",
    sectorId,
  };
}

const ANA = operator("ana", SECTOR_A); // quem entregou
const BIA = operator("bia", SECTOR_A); // outra pessoa do mesmo setor
const CAIO = operator("caio", SECTOR_B); // outro setor
const ADMIN: Authz = {
  userId: "admin",
  name: "Admin Teste",
  email: "admin@example.test",
  role: "admin",
  sectorId: null,
};

const NOTHING: HandoverCapabilities = {
  canView: false,
  canEditDirectly: false,
  canDeliver: false,
  canConfirm: false,
  canCorrectWithReason: false,
};

function caps(
  actor: Authz,
  status: HandoverStatus,
  deliveredBy: string | null,
): HandoverCapabilities {
  return handoverCapabilities(actor, {
    status,
    sectorId: SECTOR_A,
    deliveredBy,
  });
}

describe("handoverCapabilities", () => {
  it.each([
    "draft",
    "delivered",
    "confirmed",
  ] as const)("operador de outro setor não pode nada (%s)", (status) => {
    expect(caps(CAIO, status, "ana")).toEqual(NOTHING);
  });

  describe("rascunho", () => {
    it.each([
      ["operador do setor", ANA],
      ["outra pessoa do setor", BIA],
      ["admin", ADMIN],
    ])("%s: vê, edita direto e entrega; não confirma nem corrige", (_label, actor) => {
      expect(caps(actor, "draft", null)).toEqual({
        canView: true,
        canEditDirectly: true,
        canDeliver: true,
        canConfirm: false,
        canCorrectWithReason: false,
      });
    });
  });

  describe("entregue", () => {
    it("quem entregou: vê e edita direto; não entrega de novo, não confirma", () => {
      expect(caps(ANA, "delivered", "ana")).toEqual({
        canView: true,
        canEditDirectly: true,
        canDeliver: false,
        canConfirm: false,
        canCorrectWithReason: false,
      });
    });

    it("outra pessoa do setor: vê e confirma; não edita", () => {
      expect(caps(BIA, "delivered", "ana")).toEqual({
        canView: true,
        canEditDirectly: false,
        canDeliver: false,
        canConfirm: true,
        canCorrectWithReason: false,
      });
    });

    it("admin: edita direto e confirma (se não foi ele quem entregou)", () => {
      expect(caps(ADMIN, "delivered", "ana")).toEqual({
        canView: true,
        canEditDirectly: true,
        canDeliver: false,
        canConfirm: true,
        canCorrectWithReason: false,
      });
    });
  });

  describe("confirmada", () => {
    it.each([
      ["quem entregou", ANA],
      ["outra pessoa do setor", BIA],
    ])("%s: só vê", (_label, actor) => {
      expect(caps(actor, "confirmed", "ana")).toEqual({
        canView: true,
        canEditDirectly: false,
        canDeliver: false,
        canConfirm: false,
        canCorrectWithReason: false,
      });
    });

    it("admin: não edita direto; só corrige com motivo", () => {
      expect(caps(ADMIN, "confirmed", "ana")).toEqual({
        canView: true,
        canEditDirectly: false,
        canDeliver: false,
        canConfirm: false,
        canCorrectWithReason: true,
      });
    });
  });
});

describe("formModeOf", () => {
  const draftCaps = caps(BIA, "draft", null);

  it("sem passagem ou rascunho + pode editar → draft", () => {
    expect(formModeOf(null, draftCaps)).toBe("draft");
    expect(formModeOf("draft", draftCaps)).toBe("draft");
  });

  it("sem passagem e sem permissão → null", () => {
    expect(formModeOf(null, NOTHING)).toBeNull();
    expect(formModeOf("draft", NOTHING)).toBeNull();
  });

  it("entregue: quem entregou e o admin editam; os outros não", () => {
    expect(formModeOf("delivered", caps(ANA, "delivered", "ana"))).toBe("edit");
    expect(formModeOf("delivered", caps(ADMIN, "delivered", "ana"))).toBe(
      "edit",
    );
    expect(formModeOf("delivered", caps(BIA, "delivered", "ana"))).toBeNull();
    expect(formModeOf("delivered", caps(CAIO, "delivered", "ana"))).toBeNull();
  });

  it("confirmada: só o admin corrige", () => {
    expect(formModeOf("confirmed", caps(ADMIN, "confirmed", "ana"))).toBe(
      "correction",
    );
    expect(formModeOf("confirmed", caps(ANA, "confirmed", "ana"))).toBeNull();
    expect(formModeOf("confirmed", caps(CAIO, "confirmed", "ana"))).toBeNull();
  });
});
