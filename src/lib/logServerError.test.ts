import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logServerError, summarizeError } from "./logServerError";

const SECRET = "ana@exemplo.test";

function pgError(code: string): Error {
  const error = new Error(`duplicate key value (${SECRET})`);
  error.name = "error";
  Object.assign(error, { code });
  return error;
}

describe("summarizeError", () => {
  it("erro do Drizzle: pega o SQLSTATE de cause.code e nunca a mensagem", () => {
    const error = new DrizzleQueryError(
      "insert into user values ($1)",
      [SECRET],
      pgError("23505"),
    );
    const summary = summarizeError(error);

    expect(summary).toEqual({
      name: "Error",
      code: "23505",
      digest: null,
    });
    expect(JSON.stringify(summary)).not.toContain(SECRET);
    expect(error.message).toContain(SECRET);
  });

  it("código direto no erro (rede) e digest do Next", () => {
    const error = Object.assign(new Error("boom"), {
      code: "ECONNREFUSED",
      digest: "1234567890",
    });
    expect(summarizeError(error)).toEqual({
      name: "Error",
      code: "ECONNREFUSED",
      digest: "1234567890",
    });
  });

  it("não-Error (string, null, objeto) vira NonError sem conteúdo", () => {
    for (const value of [SECRET, null, undefined, 42, { message: SECRET }]) {
      const summary = summarizeError(value);
      expect(summary.name).toBe("NonError");
      expect(JSON.stringify(summary)).not.toContain(SECRET);
    }
  });

  it("descarta code, digest e name com formato suspeito", () => {
    const error = Object.assign(new Error("x"), {
      code: `bad code ${SECRET}`,
      digest: `d ${SECRET}`,
    });
    error.name = `Nome ${SECRET}`;
    expect(summarizeError(error)).toEqual({
      name: "Error",
      code: null,
      digest: null,
    });
  });

  it("limita a profundidade da cadeia de causas e tolera ciclo", () => {
    const a: Record<string, unknown> = {};
    a.cause = a;
    expect(
      summarizeError(Object.assign(new Error("x"), { cause: a })).code,
    ).toBe(null);

    const deep = { cause: { cause: { cause: { code: "23505" } } } };
    expect(summarizeError(Object.assign(new Error("x"), deep)).code).toBeNull();
  });
});

describe("logServerError", () => {
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    spy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  it("escreve uma linha de JSON com contexto, nome, code e digest", () => {
    logServerError(
      new DrizzleQueryError("select $1", [SECRET], pgError("40001")),
      "runAction",
    );

    expect(spy).toHaveBeenCalledTimes(1);
    const line = String(spy.mock.calls[0]?.[0]);
    expect(JSON.parse(line)).toEqual({
      level: "error",
      context: "runAction",
      name: "Error",
      code: "40001",
      digest: null,
    });
    expect(line).not.toContain(SECRET);
    expect(line).not.toContain("select");
  });

  it("nada além da linha: o erro original nunca vai ao console", () => {
    const error = new Error(SECRET);
    logServerError(error, "x");
    expect(spy.mock.calls[0]).toHaveLength(1);
    expect(spy.mock.calls[0]?.[0]).not.toBe(error);
  });

  it("corta contexto longo", () => {
    logServerError(new Error("x"), "c".repeat(500));
    const line = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(line.context).toHaveLength(80);
  });
});
