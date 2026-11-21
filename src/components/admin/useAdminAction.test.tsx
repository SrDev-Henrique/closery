import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail, ok } from "@/features/admin/result";
import { useAdminAction } from "./useAdminAction";

const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAdminAction", () => {
  it("começa sem pendência", () => {
    const { result } = renderHook(() => useAdminAction());
    expect(result.current.pending).toBe(false);
  });

  it("devolve o resultado de sucesso e avisa só se houver mensagem", async () => {
    const { result } = renderHook(() => useAdminAction());

    let quiet: unknown;
    await act(async () => {
      quiet = await result.current.run(async () => ok({ id: "1" }));
    });
    expect(quiet).toEqual({ ok: true, id: "1" });
    expect(mocks.success).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.run(async () => ok(), { success: "Setor criado." });
    });
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith("Setor criado.");
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("falha devolve o resultado e mostra a mensagem em toast de erro", async () => {
    const { result } = renderHook(() => useAdminAction());
    const failure = fail(
      "NOT_FOUND",
      "Setor não encontrado. Atualize a página.",
    );

    let returned: unknown;
    await act(async () => {
      returned = await result.current.run(async () => failure, {
        success: "Nunca aparece.",
      });
    });

    expect(returned).toEqual(failure);
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith(
      "Setor não encontrado. Atualize a página.",
    );
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("showError: false não mostra toast (o formulário mostra o erro)", async () => {
    const { result } = renderHook(() => useAdminAction());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.run(
        async () => fail("NAME_TAKEN", "Já existe um setor com este nome."),
        { showError: false },
      );
    });

    expect(returned).toMatchObject({ ok: false, code: "NAME_TAKEN" });
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("exceção vira falha INTERNAL com a mensagem padrão, sem texto cru", async () => {
    const { result } = renderHook(() => useAdminAction());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.run(async () => {
        throw new Error("ECONNRESET");
      });
    });

    expect(returned).toEqual({
      ok: false,
      code: "INTERNAL",
      message: "Não foi possível concluir. Tente de novo.",
    });
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith(
      "Não foi possível concluir. Tente de novo.",
    );
  });

  it("pending fica true durante a ação e volta a false depois (inclusive na falha)", async () => {
    const { result } = renderHook(() => useAdminAction());
    let finish: (value: ReturnType<typeof ok>) => void = () => {};

    let pendingRun: Promise<unknown> = Promise.resolve();
    act(() => {
      pendingRun = result.current.run(
        () =>
          new Promise<ReturnType<typeof ok>>((resolve) => {
            finish = resolve;
          }),
      );
    });
    await waitFor(() => expect(result.current.pending).toBe(true));

    await act(async () => {
      finish(ok());
      await pendingRun;
    });
    expect(result.current.pending).toBe(false);

    await act(async () => {
      await result.current.run(async () => {
        throw new Error("x");
      });
    });
    expect(result.current.pending).toBe(false);
  });
});
