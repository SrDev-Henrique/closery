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

const { runAdminAction } = await import("./runAdminAction");

const schema = z.object({
  name: z
    .string({ error: "Informe o nome." })
    .min(1, { error: "Informe o nome." }),
});
const actor = authzOf({ role: "admin" });

type RunContext = { db: unknown; now: Date; actor: Authz; input: unknown };

describe("runAdminAction", () => {
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

    const result = await runAdminAction({
      actor,
      schema,
      input: { name: "" },
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
      const result = await runAdminAction({ actor, schema, input, run });
      expect(result).toEqual({
        ok: false,
        code: "INVALID_INPUT",
        message: "Confira os campos e tente de novo.",
        fieldErrors: {},
      });
    }
    expect(run).not.toHaveBeenCalled();
  });

  it("sucesso: passa db, now, actor e a entrada já validada; revalida /admin (layout) uma vez", async () => {
    const run = vi.fn(async (_ctx: RunContext) => ok({ id: "abc" }));
    const before = Date.now();

    const result = await runAdminAction({
      actor,
      schema: z.object({ name: z.string().transform((value) => value.trim()) }),
      input: { name: "  ULD  ", extra: "descartado" },
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
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)/admin", "layout");
  });

  it("falha de domínio é repassada como veio e não revalida", async () => {
    const failure = fail("NAME_TAKEN", "Já existe um setor com este nome.", {
      name: "Já existe um setor com este nome.",
    });

    const result = await runAdminAction({
      actor,
      schema,
      input: { name: "ULD" },
      run: async () => failure,
    });

    expect(result).toBe(failure);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("exceção inesperada vira INTERNAL sem vazar o texto do erro", async () => {
    const secret =
      'duplicate key value violates unique constraint "sector_name_lower_uq" (senha=hunter2)';

    const result = await runAdminAction({
      actor,
      schema,
      input: { name: "ULD" },
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
    const result = await runAdminAction({
      actor,
      schema,
      input: { name: "ULD" },
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
      runAdminAction({
        actor,
        schema,
        input: { name: "ULD" },
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
      runAdminAction({
        actor,
        schema,
        input: { name: "ULD" },
        run: async () => {
          throw thrown;
        },
      }),
    ).rejects.toBe(thrown);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
