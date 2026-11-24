import { notFound, redirect } from "next/navigation";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import { z } from "zod";

import { fail, ok } from "@/features/admin/result";
import type { Authz } from "@/features/authz/authz";

import { authzOf } from "../../../test/authz";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  fakeDb: { marker: "fake-db" },
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
// O módulo de banco real exige DATABASE_URL; aqui só passa uma identidade.
vi.mock("@/db", () => ({ db: mocks.fakeDb }));

const { runHandoverAction } = await import("./runHandoverAction");

const schema = z.object({
  name: z
    .string({ error: "Informe o nome." })
    .min(1, { error: "Informe o nome." }),
});
const actor = authzOf({ role: "operator" });

type RunContext = { db: unknown; now: Date; actor: Authz; input: unknown };

describe("runHandoverAction", () => {
  let consoleError: MockInstance;

  beforeEach(() => {
    mocks.revalidatePath.mockReset();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("entrada inválida: INVALID_INPUT com a mensagem do campo, sem rodar nem revalidar", async () => {
    const run = vi.fn();

    const result = await runHandoverAction({
      actor,
      schema,
      input: { name: "" },
      revalidate: true,
      run,
    });

    expect(result).toEqual({
      ok: false,
      code: "INVALID_INPUT",
      message: "Informe o nome.",
      fieldErrors: { name: "Informe o nome." },
    });
    expect(run).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("entrada que nem é objeto: mensagem genérica em pt-BR, nunca o texto do Zod", async () => {
    const run = vi.fn();

    for (const input of [null, undefined, 42, "texto", []]) {
      const result = await runHandoverAction({
        actor,
        schema,
        input,
        revalidate: false,
        run,
      });
      expect(result).toEqual({
        ok: false,
        code: "INVALID_INPUT",
        message: "Confira os campos e tente de novo.",
        fieldErrors: {},
      });
    }
    expect(run).not.toHaveBeenCalled();
  });

  it("sucesso: passa db, now, actor e a entrada já validada; com revalidate revalida o layout (app) uma vez", async () => {
    const run = vi.fn(async (_ctx: RunContext) => ok({ id: "abc" }));
    const before = Date.now();

    const result = await runHandoverAction({
      actor,
      schema: z.object({ name: z.string().transform((value) => value.trim()) }),
      input: { name: "  ULD  ", extra: "descartado" },
      revalidate: true,
      run,
    });

    expect(result).toEqual({ ok: true, id: "abc" });
    expect(run).toHaveBeenCalledTimes(1);
    const ctx = run.mock.calls[0]?.[0];
    expect(ctx?.db).toBe(mocks.fakeDb);
    expect(ctx?.actor).toBe(actor);
    expect(ctx?.input).toEqual({ name: "ULD" });
    expect(ctx?.now).toBeInstanceOf(Date);
    expect(ctx?.now.getTime()).toBeGreaterThanOrEqual(before);
    expect(ctx?.now.getTime()).toBeLessThanOrEqual(Date.now());
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)", "layout");
  });

  it("sucesso com revalidate false (salvamento automático): nunca revalida", async () => {
    const result = await runHandoverAction({
      actor,
      schema,
      input: { name: "ULD" },
      revalidate: false,
      run: async () => ok({ id: "abc" }),
    });

    expect(result).toEqual({ ok: true, id: "abc" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("falha de domínio é repassada como veio e não revalida, mesmo com revalidate", async () => {
    const failure = fail(
      "ALREADY_DELIVERED",
      "Esta passagem já foi entregue por Ana Teste às 14:05.",
    );

    const result = await runHandoverAction({
      actor,
      schema,
      input: { name: "ULD" },
      revalidate: true,
      run: async () => failure,
    });

    expect(result).toBe(failure);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("exceção inesperada vira INTERNAL sem vazar o texto do erro", async () => {
    const secret =
      'duplicate key value violates unique constraint "handover_sector_shift_date_uq" (senha=hunter2)';

    const result = await runHandoverAction({
      actor,
      schema,
      input: { name: "ULD" },
      revalidate: true,
      run: async () => {
        throw new Error(secret);
      },
    });

    expect(result).toEqual({
      ok: false,
      code: "INTERNAL",
      message: "Não foi possível concluir. Tente de novo.",
    });
    expect(JSON.stringify(result)).not.toContain("hunter2");
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("valor que não é Error também vira INTERNAL", async () => {
    const result = await runHandoverAction({
      actor,
      schema,
      input: { name: "ULD" },
      revalidate: false,
      run: async () => {
        throw "texto solto";
      },
    });

    expect(result).toMatchObject({ ok: false, code: "INTERNAL" });
  });

  it("notFound() passa intacto: a página 404 aparece, nada de INTERNAL", async () => {
    let thrown: unknown;
    try {
      notFound();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeDefined();

    await expect(
      runHandoverAction({
        actor,
        schema,
        input: { name: "ULD" },
        revalidate: true,
        run: async () => {
          throw thrown;
        },
      }),
    ).rejects.toBe(thrown);
    expect(consoleError).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("redirect() passa intacto", async () => {
    let thrown: unknown;
    try {
      redirect("/entrar");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeDefined();

    await expect(
      runHandoverAction({
        actor,
        schema,
        input: { name: "ULD" },
        revalidate: true,
        run: async () => {
          throw thrown;
        },
      }),
    ).rejects.toBe(thrown);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
