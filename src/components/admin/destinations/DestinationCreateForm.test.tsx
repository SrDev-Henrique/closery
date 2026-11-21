import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DestinationCreateForm } from "@/components/admin/destinations/DestinationCreateForm";

const mocks = vi.hoisted(() => ({
  createDestinationAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/destinos/actions", () => ({
  createDestinationAction: mocks.createDestinationAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

describe("DestinationCreateForm", () => {
  beforeEach(() => {
    mocks.createDestinationAction.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
  });

  it("mostra o campo 'Nome do destino' vazio e o botão 'Criar destino'", () => {
    render(<DestinationCreateForm />);

    expect(screen.getByLabelText("Nome do destino")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Criar destino" }),
    ).toBeInTheDocument();
  });

  it("cria o destino, avisa com toast e limpa o campo", async () => {
    mocks.createDestinationAction.mockResolvedValue({ ok: true, id: "d1" });
    render(<DestinationCreateForm />);

    await userEvent.type(
      screen.getByLabelText("Nome do destino"),
      "Almoxarifado",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Criar destino" }),
    );

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Destino criado."),
    );
    expect(mocks.createDestinationAction).toHaveBeenCalledWith({
      name: "Almoxarifado",
    });
    expect(screen.getByLabelText("Nome do destino")).toHaveValue("");
  });

  it("nome vazio mostra o erro sem chamar o servidor", async () => {
    render(<DestinationCreateForm />);

    await userEvent.click(
      screen.getByRole("button", { name: "Criar destino" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Informe o nome.",
    );
    expect(mocks.createDestinationAction).not.toHaveBeenCalled();
  });

  it("servidor recusa nome repetido: mostra a mensagem e preserva o texto", async () => {
    mocks.createDestinationAction.mockResolvedValue({
      ok: false,
      code: "NAME_TAKEN",
      message:
        "Já existe um destino com este nome. Ele está inativo: reative-o na lista.",
      fieldErrors: {
        name: "Já existe um destino com este nome. Ele está inativo: reative-o na lista.",
      },
    });
    render(<DestinationCreateForm />);

    await userEvent.type(screen.getByLabelText("Nome do destino"), "Oficina");
    await userEvent.click(
      screen.getByRole("button", { name: "Criar destino" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ele está inativo: reative-o na lista.",
    );
    expect(screen.getByLabelText("Nome do destino")).toHaveValue("Oficina");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
