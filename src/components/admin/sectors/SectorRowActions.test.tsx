import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SectorRowActions } from "@/components/admin/sectors/SectorRowActions";
import type { SectorRow } from "@/features/admin/sectors";

const mocks = vi.hoisted(() => ({
  renameSectorAction: vi.fn(),
  setSectorActiveAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/setores/actions", () => ({
  renameSectorAction: mocks.renameSectorAction,
  setSectorActiveAction: mocks.setSectorActiveAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const SECTOR: SectorRow = {
  id: "s1",
  name: "Pátio",
  active: true,
  activePeople: 0,
  pendingInvites: 0,
};

describe("SectorRowActions", () => {
  beforeEach(() => {
    mocks.renameSectorAction.mockReset();
    mocks.setSectorActiveAction.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
  });

  it("setor ativo: botões 'Editar Pátio' e 'Desativar Pátio'", () => {
    render(<SectorRowActions sector={SECTOR} />);

    expect(
      screen.getByRole("button", { name: "Editar Pátio" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Desativar Pátio" }),
    ).toBeInTheDocument();
  });

  it("setor inativo: botão 'Reativar Pátio' e nenhum 'Desativar'", () => {
    render(<SectorRowActions sector={{ ...SECTOR, active: false }} />);

    expect(
      screen.getByRole("button", { name: "Reativar Pátio" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Desativar Pátio" }),
    ).not.toBeInTheDocument();
  });

  it("desativar chama a action e avisa 'Setor desativado.'", async () => {
    mocks.setSectorActiveAction.mockResolvedValue({ ok: true });
    render(<SectorRowActions sector={SECTOR} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Desativar Pátio" }),
    );

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Setor desativado."),
    );
    expect(mocks.setSectorActiveAction).toHaveBeenCalledWith({
      id: "s1",
      active: false,
    });
  });

  it("reativar chama a action e avisa 'Setor reativado.'", async () => {
    mocks.setSectorActiveAction.mockResolvedValue({ ok: true });
    render(<SectorRowActions sector={{ ...SECTOR, active: false }} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Reativar Pátio" }),
    );

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Setor reativado."),
    );
    expect(mocks.setSectorActiveAction).toHaveBeenCalledWith({
      id: "s1",
      active: true,
    });
  });

  it("desativar bloqueado mostra a mensagem de SECTOR_IN_USE em toast, sem aviso de sucesso", async () => {
    const message =
      "Este setor tem 3 pessoas ativas e 1 convite pendente. Mova, desative ou cancele antes.";
    mocks.setSectorActiveAction.mockResolvedValue({
      ok: false,
      code: "SECTOR_IN_USE",
      message,
    });
    render(<SectorRowActions sector={SECTOR} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Desativar Pátio" }),
    );

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(message));
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Desativar Pátio" }),
    ).toBeEnabled();
  });

  it("Editar abre o diálogo 'Editar setor' com o nome atual e salva", async () => {
    mocks.renameSectorAction.mockResolvedValue({ ok: true });
    render(<SectorRowActions sector={SECTOR} />);

    await userEvent.click(screen.getByRole("button", { name: "Editar Pátio" }));

    const dialog = await screen.findByRole("dialog", { name: "Editar setor" });
    const field = screen.getByLabelText("Nome do setor");
    expect(field).toHaveValue("Pátio");

    await userEvent.clear(field);
    await userEvent.type(field, "Pátio Norte");
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Alterações salvas."),
    );
    expect(mocks.renameSectorAction).toHaveBeenCalledWith({
      id: "s1",
      name: "Pátio Norte",
    });
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("nome repetido na edição mantém o diálogo aberto com o erro", async () => {
    mocks.renameSectorAction.mockResolvedValue({
      ok: false,
      code: "NAME_TAKEN",
      message: "Já existe um setor com este nome.",
      fieldErrors: { name: "Já existe um setor com este nome." },
    });
    render(<SectorRowActions sector={SECTOR} />);

    await userEvent.click(screen.getByRole("button", { name: "Editar Pátio" }));
    const field = await screen.findByLabelText("Nome do setor");
    await userEvent.clear(field);
    await userEvent.type(field, "ULD");
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe um setor com este nome.",
    );
    expect(
      screen.getByRole("dialog", { name: "Editar setor" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do setor")).toHaveValue("ULD");
  });
});
