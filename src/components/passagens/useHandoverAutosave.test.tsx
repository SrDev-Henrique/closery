import { act, render, renderHook } from "@testing-library/react";
import { Activity } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AdminResult, fail, ok } from "@/features/admin/result";
import type { SavedField } from "@/features/handovers/draft";
import type { SavedMark, SaveFieldInput } from "@/features/handovers/types";
import { spDate } from "../../../test/clock";
import { useHandoverAutosave } from "./useHandoverAutosave";

const REF = {
  sectorId: "11111111-1111-4111-8111-111111111111",
  shiftId: "22222222-2222-4222-8222-222222222222",
  operationalDate: "2026-11-20",
};
const ITEM_A = "33333333-3333-4333-8333-333333333333";
const ITEM_B = "44444444-4444-4444-8444-444444444444";

type Deferred = { resolve: (result: AdminResult<SavedField>) => void };

// Cada chamada da action fica pendente até o teste resolver: dá para provar a
// fila serial e a ordem.
function setup(initial: SavedMark | null = null) {
  const calls: SaveFieldInput[] = [];
  const pending: Deferred[] = [];
  const save = vi.fn((input: SaveFieldInput) => {
    calls.push(input);
    return new Promise<AdminResult<SavedField>>((resolve) => {
      pending.push({ resolve });
    });
  });
  const view = renderHook(() =>
    useHandoverAutosave({ ref: REF, save, initial }),
  );
  return { ...view, save, calls, pending };
}

const saved = (hour = "10:00") =>
  ok({
    handoverId: "h1",
    savedAt: spDate("2026-11-20", hour),
    savedByName: "Ana Teste",
    savedById: "u-ana",
  });

const quantity = (itemId: string, value: number) =>
  ({ field: "quantity", itemId, value }) as const;

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function settle(
  pending: Deferred[],
  index: number,
  result: AdminResult<SavedField>,
) {
  await act(async () => {
    pending[index]?.resolve(result);
    await Promise.resolve();
  });
}

describe("useHandoverAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("começa parado, com o último salvamento vindo do servidor", () => {
    const initial = {
      at: spDate("2026-11-20", "09:00"),
      byName: "Bia Teste",
      byId: "u-bia",
    };
    const { result } = setup(initial);

    expect(result.current.status).toEqual({ kind: "idle" });
    expect(result.current.lastSaved).toEqual(initial);
    expect(result.current.hasUnsaved).toBe(false);
  });

  it("agrupa a digitação: só o último valor sai, 800 ms depois", async () => {
    const { result, save, calls, pending } = setup();

    act(() => result.current.change(quantity(ITEM_A, 1)));
    await advance(300);
    act(() => result.current.change(quantity(ITEM_A, 12)));
    await advance(799);
    expect(save).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ kind: "saving" });

    await advance(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(calls[0]).toEqual({
      ...REF,
      field: "quantity",
      itemId: ITEM_A,
      value: 12,
    });

    await settle(pending, 0, saved());
    expect(result.current.status).toEqual({
      kind: "saved",
      at: spDate("2026-11-20", "10:00"),
    });
    expect(result.current.lastSaved).toEqual({
      at: spDate("2026-11-20", "10:00"),
      byName: "Ana Teste",
      byId: "u-ana",
    });
    expect(result.current.hasUnsaved).toBe(false);
  });

  it("commit envia já e cancela o debounce do campo", async () => {
    const { result, save, calls, pending } = setup();

    act(() => result.current.change(quantity(ITEM_A, 3)));
    act(() => result.current.commit(quantity(ITEM_A, 4)));
    expect(save).toHaveBeenCalledTimes(1);
    expect(calls[0]).toMatchObject({ field: "quantity", value: 4 });

    await settle(pending, 0, saved());
    await advance(2000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("fila serial: a segunda requisição só sai depois da primeira", async () => {
    const { result, save, calls, pending } = setup();

    act(() => result.current.commit(quantity(ITEM_A, 1)));
    act(() => result.current.commit({ field: "occurrences", value: "Texto" }));
    expect(save).toHaveBeenCalledTimes(1);

    await settle(pending, 0, saved("10:00"));
    expect(save).toHaveBeenCalledTimes(2);
    expect(calls.map((call) => call.field)).toEqual([
      "quantity",
      "occurrences",
    ]);
  });

  it("o valor mais novo do mesmo campo vence: o intermediário nunca sai", async () => {
    const { result, save, calls, pending } = setup();

    act(() => result.current.commit(quantity(ITEM_A, 1)));
    act(() => result.current.change(quantity(ITEM_A, 2)));
    await advance(400);
    act(() => result.current.change(quantity(ITEM_A, 3)));
    await advance(800);
    // O 1 ainda está em voo: nada mais sai.
    expect(save).toHaveBeenCalledTimes(1);

    await settle(pending, 0, saved());
    expect(save).toHaveBeenCalledTimes(2);
    expect(
      calls.map((call) => call.field === "quantity" && call.value),
    ).toEqual([1, 3]);
  });

  it("campos diferentes têm debounce independente e saem em fila", async () => {
    const { result, calls, pending } = setup();

    act(() => result.current.change(quantity(ITEM_A, 1)));
    act(() => result.current.change(quantity(ITEM_B, 2)));
    await advance(800);
    expect(calls).toHaveLength(1);

    await settle(pending, 0, saved());
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => "itemId" in call && call.itemId)).toEqual([
      ITEM_A,
      ITEM_B,
    ]);
  });

  it("falha: mostra o erro, mantém o digitado e para a fila até o retry", async () => {
    const { result, save, calls, pending } = setup();

    act(() => result.current.commit(quantity(ITEM_A, 5)));
    await settle(
      pending,
      0,
      fail("INTERNAL", "Não foi possível concluir. Tente de novo."),
    );

    expect(result.current.status).toEqual({
      kind: "error",
      message: "Não foi possível concluir. Tente de novo.",
    });
    expect(result.current.hasUnsaved).toBe(true);

    // Outro campo não passa enquanto a fila está parada.
    act(() => result.current.commit({ field: "nextShift", value: "Aviso" }));
    expect(save).toHaveBeenCalledTimes(1);

    act(() => result.current.retry());
    expect(save).toHaveBeenCalledTimes(2);
    expect(calls[1]).toMatchObject({ field: "quantity", value: 5 });

    await settle(pending, 1, saved("10:05"));
    expect(save).toHaveBeenCalledTimes(3);
    expect(calls[2]).toMatchObject({ field: "nextShift", value: "Aviso" });
    await settle(pending, 2, saved("10:06"));
    expect(result.current.status.kind).toBe("saved");
    expect(result.current.hasUnsaved).toBe(false);
  });

  it("depois da falha, um valor mais novo do campo substitui o que falhou", async () => {
    const { result, calls, pending } = setup();

    act(() => result.current.commit(quantity(ITEM_A, 5)));
    await settle(pending, 0, fail("INTERNAL", "Falhou."));
    act(() => result.current.change(quantity(ITEM_A, 9)));
    act(() => result.current.retry());

    expect(calls[1]).toMatchObject({ field: "quantity", value: 9 });
  });

  it("exceção da action vira erro sem lançar", async () => {
    const calls: SaveFieldInput[] = [];
    const save = vi.fn(async (input: SaveFieldInput) => {
      calls.push(input);
      throw new Error("Failed to fetch");
    });
    const { result } = renderHook(() =>
      useHandoverAutosave({ ref: REF, save, initial: null }),
    );

    await act(async () => {
      result.current.commit({ field: "occurrences", value: "x" });
      await Promise.resolve();
    });

    expect(result.current.status).toEqual({
      kind: "error",
      message: "Não foi possível concluir. Tente de novo.",
    });
    expect(result.current.hasUnsaved).toBe(true);
  });

  it("falha de permissão (ok:false) mostra a mensagem da action", async () => {
    const { result, pending } = setup();

    act(() => result.current.commit(quantity(ITEM_A, 1)));
    await settle(
      pending,
      0,
      fail(
        "HANDOVER_LOCKED",
        "Esta passagem já foi confirmada. Só um administrador corrige, com motivo.",
      ),
    );

    expect(result.current.status).toEqual({
      kind: "error",
      message:
        "Esta passagem já foi confirmada. Só um administrador corrige, com motivo.",
    });
  });

  it("flush envia o pendente sem esperar o debounce e devolve true", async () => {
    const { result, save, pending } = setup();

    act(() => result.current.change(quantity(ITEM_A, 7)));
    let outcome: boolean | undefined;
    await act(async () => {
      const done = result.current.flush().then((value) => {
        outcome = value;
      });
      await Promise.resolve();
      pending[0]?.resolve(saved());
      await done;
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(outcome).toBe(true);
    expect(result.current.hasUnsaved).toBe(false);
  });

  it("flush sem nada pendente devolve true na hora", async () => {
    const { result, save } = setup();

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.flush();
    });

    expect(outcome).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it("flush devolve false quando o salvamento falha", async () => {
    const { result, pending } = setup();

    act(() => result.current.change(quantity(ITEM_A, 7)));
    let outcome: boolean | undefined;
    await act(async () => {
      const done = result.current.flush().then((value) => {
        outcome = value;
      });
      await Promise.resolve();
      pending[0]?.resolve(fail("INTERNAL", "Falhou."));
      await done;
    });

    expect(outcome).toBe(false);
    expect(result.current.status.kind).toBe("error");
  });

  it("o evento online reenvia o que falhou", async () => {
    const { result, save, pending } = setup();

    act(() => result.current.commit(quantity(ITEM_A, 2)));
    await settle(pending, 0, fail("INTERNAL", "Sem rede."));
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(2);
  });

  it("beforeunload só avisa enquanto houver algo não salvo", async () => {
    const { result, pending } = setup();
    const unload = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(unload()).toBe(false);

    act(() => result.current.change(quantity(ITEM_A, 1)));
    expect(unload()).toBe(true);

    await advance(800);
    expect(unload()).toBe(true);

    await settle(pending, 0, saved());
    expect(unload()).toBe(false);
  });

  it("beforeunload também avisa depois de uma falha", async () => {
    const { result, pending } = setup();

    act(() => result.current.commit(quantity(ITEM_A, 1)));
    await settle(pending, 0, fail("INTERNAL", "Falhou."));

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("ao desmontar, envia o pendente sem esperar o debounce", async () => {
    const { result, save, calls, unmount } = setup();

    act(() =>
      result.current.change({ field: "occurrences", value: "Rascunho" }),
    );
    expect(save).not.toHaveBeenCalled();

    unmount();

    expect(save).toHaveBeenCalledTimes(1);
    expect(calls[0]).toEqual({
      ...REF,
      field: "occurrences",
      value: "Rascunho",
    });
  });

  it("depois de desmontar, o timer velho não envia de novo", async () => {
    const { result, save, pending, unmount } = setup();

    act(() =>
      result.current.change({ field: "occurrences", value: "Rascunho" }),
    );
    unmount();
    await settle(pending, 0, saved());
    await advance(2000);

    expect(save).toHaveBeenCalledTimes(1);
  });

  it("Activity: o que terminou com o formulário escondido aparece quando ele volta", async () => {
    const calls: SaveFieldInput[] = [];
    const pending: Deferred[] = [];
    const save = vi.fn((input: SaveFieldInput) => {
      calls.push(input);
      return new Promise<AdminResult<SavedField>>((resolve) => {
        pending.push({ resolve });
      });
    });
    let current: ReturnType<typeof useHandoverAutosave> | undefined;
    function Probe() {
      current = useHandoverAutosave({ ref: REF, save, initial: null });
      return null;
    }
    const tree = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <Probe />
      </Activity>
    );
    const { rerender } = render(tree("visible"));

    act(() => current?.commit(quantity(ITEM_A, 3)));
    expect(current?.status.kind).toBe("saving");

    rerender(tree("hidden"));
    await settle(pending, 0, saved());
    rerender(tree("visible"));

    expect(current?.status.kind).toBe("saved");
    expect(current?.hasUnsaved).toBe(false);
  });
});
