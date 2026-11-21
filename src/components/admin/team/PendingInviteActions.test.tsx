import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail } from "@/features/admin/result";
import { PendingInviteActions } from "./PendingInviteActions";

const mocks = vi.hoisted(() => ({
  cancelInviteAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/equipe/actions", () => ({
  cancelInviteAction: mocks.cancelInviteAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const ID = "33333333-3333-4333-8333-333333333333";

function setup(label = "Maria do Turno") {
  const user = userEvent.setup();
  render(<PendingInviteActions id={ID} label={label} />);
  return { user };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.cancelInviteAction.mockResolvedValue({ ok: true });
});

describe("PendingInviteActions", () => {
  it("o botão nomeia o convite para quem usa leitor de tela", () => {
    setup();
    expect(
      screen.getByRole("button", { name: "Cancelar convite Maria do Turno" }),
    ).toHaveTextContent("Cancelar convite");
  });

  it("sem nome de referência o rótulo vira 'sem nome'", () => {
    setup("sem nome");
    expect(
      screen.getByRole("button", { name: "Cancelar convite sem nome" }),
    ).toBeInTheDocument();
  });

  it("pede confirmação com o texto exato e não age antes", async () => {
    const { user } = setup();

    await user.click(
      screen.getByRole("button", { name: "Cancelar convite Maria do Turno" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Cancelar convite?",
    });
    expect(
      within(dialog).getByText(
        "O link deixa de funcionar. Não dá para desfazer.",
      ),
    ).toBeInTheDocument();
    expect(mocks.cancelInviteAction).not.toHaveBeenCalled();
  });

  it("confirmar cancela, avisa e fecha o diálogo", async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole("button", { name: "Cancelar convite Maria do Turno" }),
    );

    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Cancelar convite" }),
    );

    await waitFor(() =>
      expect(mocks.cancelInviteAction).toHaveBeenCalledWith({ id: ID }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Convite cancelado.");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("Voltar fecha sem cancelar", async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole("button", { name: "Cancelar convite Maria do Turno" }),
    );

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Voltar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mocks.cancelInviteAction).not.toHaveBeenCalled();
  });

  it("convite que já não está pendente: mostra o motivo no diálogo e não fecha", async () => {
    mocks.cancelInviteAction.mockResolvedValue(
      fail(
        "INVITE_NOT_PENDING",
        "Este convite não está mais pendente. Atualize a página.",
      ),
    );
    const { user } = setup();
    await user.click(
      screen.getByRole("button", { name: "Cancelar convite Maria do Turno" }),
    );

    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Cancelar convite" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Este convite não está mais pendente. Atualize a página.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
