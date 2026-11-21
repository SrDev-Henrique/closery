import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DestinationRowActions } from "@/components/admin/destinations/DestinationRowActions";
import type { DestinationRow } from "@/features/admin/destinations";

const mocks = vi.hoisted(() => ({
  renameDestinationAction: vi.fn(),
  setDestinationActiveAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/destinos/actions", () => ({
  renameDestinationAction: mocks.renameDestinationAction,
  setDestinationActiveAction: mocks.setDestinationActiveAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const DESTINATION: DestinationRow = {
  id: "d1",
  name: "Oficina",
  active: true,
};

describe("DestinationRowActions", () => {
  beforeEach(() => {
    mocks.renameDestinationAction.mockReset();
    mocks.setDestinationActiveAction.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
  });

  it("destino ativo: 'Editar Oficina' e 'Desativar Oficina'", () => {
    render(<DestinationRowActions destination={DESTINATION} />);

    expect(
      screen.getByRole("button", { name: "Editar Oficina" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Desativar Oficina" }),
    ).toBeInTheDocument();
  });

  it("destino inativo: 'Reativar Oficina'", () => {
    render(
      <DestinationRowActions destination={{ ...DESTINATION, active: false }} />,
    );

    expect(
      screen.getByRole("button", { name: "Reativar Oficina" }),
    ).toBeInTheDocument();
  });

  it("desativar chama a action e avisa 'Destino desativado.'", async () => {
    mocks.setDestinationActiveAction.mockResolvedValue({ ok: true });
    render(<DestinationRowActions destination={DESTINATION} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Desativar Oficina" }),
    );

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Destino desativado."),
    );
    expect(mocks.setDestinationActiveAction).toHaveBeenCalledWith({
      id: "d1",
      active: false,
    });
  });

  it("falha ao desativar mostra o erro em toast", async () => {
    mocks.setDestinationActiveAction.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Destino não encontrado. Atualize a página.",
    });
    render(<DestinationRowActions destination={DESTINATION} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Desativar Oficina" }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Destino não encontrado. Atualize a página.",
      ),
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("Editar abre 'Editar destino' com o nome atual e salva", async () => {
    mocks.renameDestinationAction.mockResolvedValue({ ok: true });
    render(<DestinationRowActions destination={DESTINATION} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Editar Oficina" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Editar destino",
    });
    const field = screen.getByLabelText("Nome do destino");
    expect(field).toHaveValue("Oficina");

    await userEvent.clear(field);
    await userEvent.type(field, "Oficina Central");
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Alterações salvas."),
    );
    expect(mocks.renameDestinationAction).toHaveBeenCalledWith({
      id: "d1",
      name: "Oficina Central",
    });
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });
});
