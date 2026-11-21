import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SectorCreateForm } from "@/components/admin/sectors/SectorCreateForm";

const mocks = vi.hoisted(() => ({
  createSectorAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/setores/actions", () => ({
  createSectorAction: mocks.createSectorAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

describe("SectorCreateForm", () => {
  beforeEach(() => {
    mocks.createSectorAction.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
  });

  it("mostra o campo 'Nome do setor' vazio e o botão 'Criar setor'", () => {
    render(<SectorCreateForm />);

    expect(screen.getByLabelText("Nome do setor")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Criar setor" }),
    ).toBeInTheDocument();
  });

  it("cria o setor, avisa com toast e limpa o campo", async () => {
    mocks.createSectorAction.mockResolvedValue({ ok: true, id: "s1" });
    render(<SectorCreateForm />);

    await userEvent.type(screen.getByLabelText("Nome do setor"), "  Pátio ");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Setor criado."),
    );
    expect(mocks.createSectorAction).toHaveBeenCalledWith({ name: "Pátio" });
    expect(screen.getByLabelText("Nome do setor")).toHaveValue("");
  });

  it("nome vazio mostra o erro sem chamar o servidor", async () => {
    render(<SectorCreateForm />);

    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Informe o nome.",
    );
    expect(mocks.createSectorAction).not.toHaveBeenCalled();
  });

  it("nome com 61 caracteres mostra o erro de tamanho", async () => {
    render(<SectorCreateForm />);

    await userEvent.click(screen.getByLabelText("Nome do setor"));
    await userEvent.paste("a".repeat(61));
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O nome pode ter no máximo 60 caracteres.",
    );
    expect(mocks.createSectorAction).not.toHaveBeenCalled();
  });

  it("quando o servidor recusa, mostra a mensagem e preserva o que foi digitado", async () => {
    mocks.createSectorAction.mockResolvedValue({
      ok: false,
      code: "NAME_TAKEN",
      message: "Já existe um setor com este nome.",
      fieldErrors: { name: "Já existe um setor com este nome." },
    });
    render(<SectorCreateForm />);

    await userEvent.type(screen.getByLabelText("Nome do setor"), "ULD");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe um setor com este nome.",
    );
    expect(screen.getByLabelText("Nome do setor")).toHaveValue("ULD");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("falha de rede mostra a mensagem genérica e preserva o texto", async () => {
    mocks.createSectorAction.mockRejectedValue(new Error("fetch failed"));
    render(<SectorCreateForm />);

    await userEvent.type(screen.getByLabelText("Nome do setor"), "ULD");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir. Tente de novo.",
    );
    expect(screen.getByLabelText("Nome do setor")).toHaveValue("ULD");
  });
});
