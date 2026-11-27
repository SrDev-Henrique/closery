import { describe, expect, it } from "vitest";

import {
  type AdminErrorCode,
  fail,
  INTERNAL_ERROR_MESSAGE,
  INVALID_INPUT_MESSAGE,
  ok,
} from "@/features/admin/result";

describe("ok", () => {
  it("sem dados: só { ok: true }", () => {
    expect(ok()).toEqual({ ok: true });
  });

  it("com dados: espalha os campos ao lado de ok", () => {
    expect(ok({ id: "abc", warnings: [] })).toEqual({
      ok: true,
      id: "abc",
      warnings: [],
    });
  });

  it("ok não pode ser sobrescrito pelos dados", () => {
    expect(ok({ ok: false, id: "abc" }).ok).toBe(true);
  });
});

describe("fail", () => {
  it("monta a falha com código e mensagem, sem fieldErrors quando não há", () => {
    const failure = fail(
      "NOT_FOUND",
      "Setor não encontrado. Atualize a página.",
    );
    expect(failure).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Setor não encontrado. Atualize a página.",
    });
    expect("fieldErrors" in failure).toBe(false);
  });

  it("carrega os erros por campo", () => {
    expect(fail("NAME_TAKEN", "Já existe.", { name: "Já existe." })).toEqual({
      ok: false,
      code: "NAME_TAKEN",
      message: "Já existe.",
      fieldErrors: { name: "Já existe." },
    });
  });
});

describe("mensagens fixas", () => {
  it("são as do contrato", () => {
    expect(INTERNAL_ERROR_MESSAGE).toBe(
      "Não foi possível concluir. Tente de novo.",
    );
    expect(INVALID_INPUT_MESSAGE).toBe("Confira os campos e tente de novo.");
  });
});

describe("códigos da passagem (aditivos)", () => {
  it("fail aceita os 10 códigos novos e os da Fase 2 continuam valendo", () => {
    const codes: AdminErrorCode[] = [
      "SHIFT_INACTIVE",
      "DATE_OUT_OF_RANGE",
      "FORBIDDEN",
      "HANDOVER_LOCKED",
      "ALREADY_DELIVERED",
      "NOT_DELIVERED",
      "ALREADY_CONFIRMED",
      "OWN_HANDOVER",
      "NOT_CONFIRMED",
      "NO_CHANGES",
      "NOT_FOUND",
      "INTERNAL",
    ];
    for (const code of codes) {
      expect(fail(code, "x")).toEqual({ ok: false, code, message: "x" });
    }
  });
});

describe("códigos da Fase 4 (aditivos)", () => {
  // Record<AdminErrorCode, true> obriga esta lista a bater com a união: um
  // código a mais ou a menos não compila (bun run check-types).
  const CONTRACT: Record<AdminErrorCode, true> = {
    INVALID_INPUT: true,
    NAME_TAKEN: true,
    NOT_FOUND: true,
    SECTOR_REQUIRED: true,
    SECTOR_INACTIVE: true,
    SECTOR_IN_USE: true,
    SELF_CHANGE: true,
    PERSON_INACTIVE: true,
    LAST_ADMIN: true,
    INVITE_NOT_PENDING: true,
    SHIFT_INACTIVE: true,
    DATE_OUT_OF_RANGE: true,
    FORBIDDEN: true,
    HANDOVER_LOCKED: true,
    ALREADY_DELIVERED: true,
    NOT_DELIVERED: true,
    ALREADY_CONFIRMED: true,
    OWN_HANDOVER: true,
    NOT_CONFIRMED: true,
    NO_CHANGES: true,
    STATUS_CONFLICT: true,
    DESTINATION_INACTIVE: true,
    INTERNAL: true,
  };

  it("a lista do contrato tem os 23 códigos, sem repetição", () => {
    expect(Object.keys(CONTRACT)).toHaveLength(23);
  });

  it("fail aceita os 2 códigos novos e os de antes continuam valendo", () => {
    expect(fail("STATUS_CONFLICT", "mudou")).toEqual({
      ok: false,
      code: "STATUS_CONFLICT",
      message: "mudou",
    });
    expect(
      fail("DESTINATION_INACTIVE", "inativo", { destinationId: "inativo" }),
    ).toEqual({
      ok: false,
      code: "DESTINATION_INACTIVE",
      message: "inativo",
      fieldErrors: { destinationId: "inativo" },
    });
  });
});
