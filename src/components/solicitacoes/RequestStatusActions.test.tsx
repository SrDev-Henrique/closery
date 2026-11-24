import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail, ok } from "@/features/admin/result";
import type { RequestStatus } from "@/features/requests/types";
import { RequestStatusActions } from "./RequestStatusActions";

const mocks = vi.hoisted(() => ({
  moveRequestAction: vi.fn(),
  cancelRequestAction: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/solicitacoes/actions", () => ({
  moveRequestAction: mocks.moveRequestAction,
  cancelRequestAction: mocks.cancelRequestAction,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const ID = "11111111-1111-4111-8111-111111111111";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function setup(
  status: RequestStatus = "requested",
  props: Partial<Parameters<typeof RequestStatusActions>[0]> = {},
) {
  render(
    <RequestStatusActions
      requestId={ID}
      status={status}
      description="Rolos para a doca"
      canCancel
      {...props}
    />,
  );
}

const names = () =>
  screen.getAllByRole("button").map((button) => button.textContent);

describe("RequestStatusActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    [
      "requested",
      [
        "Mover para Em separação / Trânsito",
        "Mover para Entregue",
        "Cancelar solicitação",
      ],
    ],
    [
      "in_transit",
      ["Mover para Solicitada", "Mover para Entregue", "Cancelar solicitação"],
    ],
    [
      "delivered",
      [
        "Mover para Solicitada",
        "Mover para Em separação / Trânsito",
        "Cancelar solicitação",
      ],
    ],
  ] as const)("%s: um botão por status alvo e o cancelar", (status, expected) => {
    setup(status);

    expect(names()).toEqual(expected);
  });

  it("Cancelada reabre para qualquer status e não oferece cancelar", () => {
    setup("cancelled", { canCancel: false });

    expect(names()).toEqual([
      "Mover para Solicitada",
      "Mover para Em separação / Trânsito",
      "Mover para Entregue",
    ]);
  });

  it("cada botão tem a cor do status de destino", () => {
    setup("requested");

    expect(
      screen.getByRole("button", { name: "Mover para Em separação / Trânsito" })
        .className,
    ).toContain("bg-warning");
    expect(
      screen.getByRole("button", { name: "Mover para Entregue" }).className,
    ).toContain("bg-success");
  });

  it("sucesso: manda o status visto e o destino e avisa pelo nome", async () => {
    mocks.moveRequestAction.mockResolvedValue(ok());
    setup("requested");

    await userEvent.click(
      screen.getByRole("button", {
        name: "Mover para Em separação / Trânsito",
      }),
    );

    expect(mocks.moveRequestAction).toHaveBeenCalledExactlyOnceWith({
      id: ID,
      from: "requested",
      to: "in_transit",
    });
    expect(mocks.toastSuccess).toHaveBeenCalledExactlyOnceWith(
      "“Rolos para a doca” movida para Em separação / Trânsito.",
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("falha comum: toast de erro nomeando a solicitação, sem refresh", async () => {
    mocks.moveRequestAction.mockResolvedValue(
      fail("SECTOR_INACTIVE", "Setor inativo."),
    );
    setup("requested");

    await userEvent.click(
      screen.getByRole("button", { name: "Mover para Entregue" }),
    );

    expect(mocks.toastError).toHaveBeenCalledExactlyOnceWith(
      "Não foi possível mover “Rolos para a doca”. Setor inativo.",
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it.each([
    "STATUS_CONFLICT",
    "NO_CHANGES",
    "NOT_FOUND",
  ] as const)("%s atualiza a tela depois do toast", async (code) => {
    mocks.moveRequestAction.mockResolvedValue(fail(code, "Mudou."));
    setup("requested");

    await userEvent.click(
      screen.getByRole("button", { name: "Mover para Entregue" }),
    );

    expect(mocks.toastError).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("exceção vira o erro interno no toast", async () => {
    mocks.moveRequestAction.mockRejectedValue(new Error("rede"));
    setup("requested");

    await userEvent.click(
      screen.getByRole("button", { name: "Mover para Entregue" }),
    );

    expect(mocks.toastError).toHaveBeenCalledExactlyOnceWith(
      "Não foi possível mover “Rolos para a doca”. Não foi possível concluir. Tente de novo.",
    );
  });

  it("enquanto um movimento está em voo todos os botões ficam desativados", async () => {
    const pending = deferred<ReturnType<typeof ok>>();
    mocks.moveRequestAction.mockReturnValue(pending.promise);
    setup("requested");

    await userEvent.click(
      screen.getByRole("button", { name: "Mover para Entregue" }),
    );

    expect(
      screen.getByRole("button", { name: "Mover para Entregue" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Mover para Em separação / Trânsito",
      }),
    ).toBeDisabled();
    expect(mocks.moveRequestAction).toHaveBeenCalledTimes(1);

    pending.resolve(ok());
  });
});
