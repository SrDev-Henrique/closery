import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { ItemRow } from "@/features/admin/items";
import { ItemRowActions } from "./ItemRowActions";

const mocks = vi.hoisted(() => ({
  createItemAction: vi.fn(),
  updateItemAction: vi.fn(),
  setItemActiveAction: vi.fn(),
  moveItemAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/itens/actions", () => ({
  createItemAction: mocks.createItemAction,
  updateItemAction: mocks.updateItemAction,
  setItemActiveAction: mocks.setItemActiveAction,
  moveItemAction: mocks.moveItemAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const ITEM: ItemRow = {
  id: "7a2e3b4c-5d6e-4f70-8b9c-1d2e3f4a5b6c",
  sectorId: "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b",
  name: "Rede",
  unit: "rolo",
  kind: "control",
  sortOrder: 2,
  active: true,
  canMoveUp: true,
  canMoveDown: true,
};

function setup(item: Partial<ItemRow> = {}) {
  render(
    <TooltipProvider>
      <ItemRowActions item={{ ...ITEM, ...item }} />
    </TooltipProvider>,
  );
}

describe("ItemRowActions", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.moveItemAction.mockResolvedValue({ ok: true });
  });

  it("primeiro da lista não sobe", () => {
    setup({ canMoveUp: false });
    expect(screen.getByRole("button", { name: "Subir Rede" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descer Rede" })).toBeEnabled();
  });

  it("último da lista não desce", () => {
    setup({ canMoveDown: false });
    expect(screen.getByRole("button", { name: "Subir Rede" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Descer Rede" })).toBeDisabled();
  });

  it("subir chama a action sem toast de sucesso", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Subir Rede" }));
    await waitFor(() =>
      expect(mocks.moveItemAction).toHaveBeenCalledWith({
        id: ITEM.id,
        direction: "up",
      }),
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("erro ao mover aparece em toast", async () => {
    mocks.moveItemAction.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Item não encontrado. Atualize a página.",
    });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Descer Rede" }));
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Item não encontrado. Atualize a página.",
      ),
    );
  });

  it("Editar abre o diálogo com a unidade da lista selecionada", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Editar Rede" }));
    expect(
      await screen.findByRole("dialog", { name: "Editar item" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do item")).toHaveValue("Rede");
    expect(screen.getByLabelText("Unidade")).toHaveValue("rolo");
    expect(screen.queryByLabelText("Outra unidade")).not.toBeInTheDocument();
  });

  it("Editar um item com unidade antiga abre em 'Outro…' (splitUnit)", async () => {
    setup({ unit: "folha grande" });
    await userEvent.click(screen.getByRole("button", { name: "Editar Rede" }));
    await screen.findByRole("dialog", { name: "Editar item" });
    expect(screen.getByLabelText("Unidade")).toHaveValue("outro");
    expect(screen.getByLabelText("Outra unidade")).toHaveValue("folha grande");
  });

  it("salvar a edição chama updateItemAction e fecha o diálogo", async () => {
    mocks.updateItemAction.mockResolvedValue({ ok: true });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Editar Rede" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Salvar alterações" }),
    );
    await waitFor(() =>
      expect(mocks.updateItemAction).toHaveBeenCalledWith({
        id: ITEM.id,
        name: "Rede",
        unitChoice: "rolo",
        unitOther: "",
        kind: "control",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("Desativar chama a action e avisa 'Item desativado.'", async () => {
    mocks.setItemActiveAction.mockResolvedValue({ ok: true });
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Desativar Rede" }),
    );
    await waitFor(() =>
      expect(mocks.setItemActiveAction).toHaveBeenCalledWith({
        id: ITEM.id,
        active: false,
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Item desativado.");
  });

  it("item inativo mostra Reativar e avisa 'Item reativado.'", async () => {
    mocks.setItemActiveAction.mockResolvedValue({ ok: true });
    setup({ active: false });
    await userEvent.click(
      screen.getByRole("button", { name: "Reativar Rede" }),
    );
    await waitFor(() =>
      expect(mocks.setItemActiveAction).toHaveBeenCalledWith({
        id: ITEM.id,
        active: true,
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Item reativado.");
  });

  it("falha ao desativar mostra o erro e não avisa sucesso", async () => {
    mocks.setItemActiveAction.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Item não encontrado. Atualize a página.",
    });
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Desativar Rede" }),
    );
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
