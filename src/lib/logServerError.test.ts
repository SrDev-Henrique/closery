import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logServerError, summarizeError } from "./logServerError";

// O SDK é trocado por um espião: aqui só se prova QUANDO o log captura no
// Sentry; o que sai no evento está provado em src/lib/sentry/options.test.ts.
const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => sentry);

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
    sentry.captureException.mockReset();
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

  it("nunca lança: getter que lança na causa ainda escreve uma linha só, sem o texto do getter", () => {
    const error = new Error("x", {
      cause: {
        get code(): string {
          throw new Error("hunter2");
        },
      },
    });

    expect(() => logServerError(error, "runAction")).not.toThrow();

    expect(spy).toHaveBeenCalledTimes(1);
    const line = String(spy.mock.calls[0]?.[0]);
    expect(JSON.parse(line)).toMatchObject({
      level: "error",
      context: "runAction",
      name: "Error",
      code: null,
      digest: null,
    });
    expect(line).not.toContain("hunter2");
  });

  it("nunca lança: Proxy revogado escreve a linha e não lança", () => {
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();

    expect(() => logServerError(proxy, "x")).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("logServerError: captura no Sentry (Fase 6)", () => {
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    spy = vi.spyOn(console, "error").mockImplementation(() => {});
    sentry.captureException.mockReset();
  });
  afterEach(() => spy.mockRestore());

  it("captura uma vez, com o erro e o contexto como tag", () => {
    const error = new Error("falha");

    logServerError(error, "runAction");

    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { context: "runAction" },
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("a tag leva o contexto já cortado em 80 caracteres", () => {
    logServerError(new Error("x"), "c".repeat(500));

    expect(sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { context: "c".repeat(80) },
    });
  });

  it("erro com digest não é capturado de novo (o servidor já o reportou), mas a linha sai", () => {
    const error = Object.assign(new Error("render"), { digest: "123456" });

    logServerError(error, "error-boundary");

    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("sem erro (null ou undefined) escreve a linha e não captura", () => {
    logServerError(null, "better-auth:ip-desconhecido");
    logServerError(undefined, "x");

    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(spy.mock.calls[0]?.[0]))).toEqual({
      level: "error",
      context: "better-auth:ip-desconhecido",
      name: "NonError",
      code: null,
      digest: null,
    });
  });

  it("valor que não é Error também é capturado (só o erro null e undefined não)", () => {
    logServerError("texto solto", "x");
    logServerError(0, "x");

    expect(sentry.captureException).toHaveBeenCalledTimes(2);
  });

  it("captureException que lança não quebra o log nem lança", () => {
    sentry.captureException.mockImplementation(() => {
      throw new Error("sentry fora do ar");
    });

    expect(() => logServerError(new Error("falha"), "runAction")).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
