import { describe, expect, it } from "vitest";

import { REQUEST_STATUSES } from "@/lib/requestStatuses";

import { authzOf } from "../../../test/authz";
import {
  canCreateRequest,
  canDeleteComment,
  type RequestCapabilities,
  requestCapabilities,
} from "./access";

const SECTOR_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SECTOR_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const ANA = authzOf({ role: "operator", userId: "ana", sectorId: SECTOR_A });
const CAIO = authzOf({ role: "operator", userId: "caio", sectorId: SECTOR_B });
const ADMIN = authzOf({ role: "admin", userId: "admin" });

const NOTHING: RequestCapabilities = {
  canView: false,
  canMove: false,
  canCancel: false,
  canComment: false,
};

describe("requestCapabilities", () => {
  describe.each([
    ["operador do setor", ANA],
    ["admin", ADMIN],
  ] as const)("%s", (_who, actor) => {
    it.each(
      REQUEST_STATUSES,
    )("setor ativo, %s: vê, move e comenta; cancela se não estiver cancelada", (status) => {
      expect(
        requestCapabilities(
          actor,
          { sectorId: SECTOR_A, status },
          { active: true },
        ),
      ).toEqual({
        canView: true,
        canMove: true,
        canCancel: status !== "cancelled",
        canComment: true,
      });
    });
  });

  it.each(
    REQUEST_STATUSES,
  )("operador de outro setor não pode nada (%s)", (status) => {
    expect(
      requestCapabilities(
        CAIO,
        { sectorId: SECTOR_A, status },
        { active: true },
      ),
    ).toEqual(NOTHING);
  });

  it.each(
    REQUEST_STATUSES,
  )("setor inativo: vê, mas não escreve (%s), operador e admin", (status) => {
    for (const actor of [ANA, ADMIN]) {
      expect(
        requestCapabilities(
          actor,
          { sectorId: SECTOR_A, status },
          { active: false },
        ),
      ).toEqual({
        canView: true,
        canMove: false,
        canCancel: false,
        canComment: false,
      });
    }
  });

  it("operador de outro setor com setor inativo continua sem ver", () => {
    expect(
      requestCapabilities(
        CAIO,
        { sectorId: SECTOR_A, status: "requested" },
        { active: false },
      ),
    ).toEqual(NOTHING);
  });
});

describe("canCreateRequest", () => {
  it.each([
    ["operador do setor, setor ativo", ANA, true, true],
    ["operador do setor, setor inativo", ANA, false, false],
    ["operador de outro setor, setor ativo", CAIO, true, false],
    ["operador de outro setor, setor inativo", CAIO, false, false],
    ["admin, setor ativo", ADMIN, true, true],
    ["admin, setor inativo", ADMIN, false, false],
  ] as const)("%s → %s", (_label, actor, active, expected) => {
    expect(canCreateRequest(actor, { id: SECTOR_A, active })).toBe(expected);
  });
});

describe("canDeleteComment", () => {
  const own = { authorId: "ana", statusEventId: null, deletedAt: null };
  const ACTIVE = { active: true };

  it("o autor apaga o próprio comentário", () => {
    expect(canDeleteComment(ANA, own, ACTIVE)).toBe(true);
  });

  it("o admin também só apaga o próprio", () => {
    expect(canDeleteComment(ADMIN, { ...own, authorId: "admin" }, ACTIVE)).toBe(
      true,
    );
    expect(canDeleteComment(ADMIN, own, ACTIVE)).toBe(false);
  });

  it("outra pessoa do setor não apaga", () => {
    const bia = authzOf({
      role: "operator",
      userId: "bia",
      sectorId: SECTOR_A,
    });
    expect(canDeleteComment(bia, own, ACTIVE)).toBe(false);
  });

  it("o motivo de cancelamento não se apaga, nem o autor", () => {
    expect(
      canDeleteComment(ANA, { ...own, statusEventId: "evento-1" }, ACTIVE),
    ).toBe(false);
  });

  it("um comentário já apagado não se apaga de novo", () => {
    expect(
      canDeleteComment(
        ANA,
        { ...own, deletedAt: new Date("2026-11-20T12:00:00Z") },
        ACTIVE,
      ),
    ).toBe(false);
  });

  it("em setor inativo ninguém apaga", () => {
    expect(canDeleteComment(ANA, own, { active: false })).toBe(false);
  });
});
