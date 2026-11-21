import { describe, expect, it } from "vitest";

import {
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
