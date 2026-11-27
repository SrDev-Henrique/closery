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

  it("mostra o campo 'Nome do setor' vazio, a cor sugerida marcada e o botão 'Criar setor'", () => {
    render(<SectorCreateForm suggestedColor="sky" />);

    expect(screen.getByLabelText("Nome do setor")).toHaveValue("");
    expect(screen.getByRole("radiogroup", { name: "Cor" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Azul" })).toBeChecked();
    expect(screen.getAllByRole("radio", { checked: true })).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Criar setor" }),
    ).toBeInTheDocument();
  });

  it("cria o setor com a cor sugerida sem a pessoa tocar na cor", async () => {
    mocks.createSectorAction.mockResolvedValue({ ok: true, id: "s1" });
    render(<SectorCreateForm suggestedColor="peach" />);

    await userEvent.type(screen.getByLabelText("Nome do setor"), "  Pátio ");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Setor criado."),
    );
    expect(mocks.createSectorAction).toHaveBeenCalledWith({
      name: "Pátio",
      color: "peach",
    });
    expect(screen.getByLabelText("Nome do setor")).toHaveValue("");
  });

  it("cria o setor com a cor que a pessoa escolheu", async () => {
    mocks.createSectorAction.mockResolvedValue({ ok: true, id: "s1" });
    render(<SectorCreateForm suggestedColor="lilac" />);

    await userEvent.type(screen.getByLabelText("Nome do setor"), "Pátio");
    await userEvent.click(screen.getByRole("radio", { name: "Rosa" }));
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    await waitFor(() =>
      expect(mocks.createSectorAction).toHaveBeenCalledWith({
        name: "Pátio",
        color: "pink",
      }),
    );
  });

  it("depois de criar, a cor volta à sugerida (o formulário não começa em branco nem repete a escolha)", async () => {
    mocks.createSectorAction.mockResolvedValue({ ok: true, id: "s1" });
    render(<SectorCreateForm suggestedColor="lilac" />);

    await userEvent.type(screen.getByLabelText("Nome do setor"), "Pátio");
    await userEvent.click(screen.getByRole("radio", { name: "Verde" }));
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Setor criado."),
    );
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Lilás" })).toBeChecked(),
    );
    expect(screen.getByRole("radio", { name: "Verde" })).not.toBeChecked();
  });

  it("quando a sugestão do servidor muda (tela recarregada), a cor marcada acompanha", () => {
    const { rerender } = render(<SectorCreateForm suggestedColor="lilac" />);
    expect(screen.getByRole("radio", { name: "Lilás" })).toBeChecked();

    rerender(<SectorCreateForm suggestedColor="peach" />);

    expect(screen.getByRole("radio", { name: "Pêssego" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Lilás" })).not.toBeChecked();
  });

  it("a cor escolhida não volta para a sugestão quando a tela revalida com outra sugestão", async () => {
    const { rerender } = render(<SectorCreateForm suggestedColor="lilac" />);
    await userEvent.click(screen.getByRole("radio", { name: "Verde" }));

    rerender(<SectorCreateForm suggestedColor="peach" />);

    expect(screen.getByRole("radio", { name: "Verde" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Pêssego" })).not.toBeChecked();
  });

  it("depois de criar, volta a acompanhar a sugestão do servidor", async () => {
    mocks.createSectorAction.mockResolvedValue({ ok: true, id: "s1" });
    const { rerender } = render(<SectorCreateForm suggestedColor="lilac" />);
    await userEvent.type(screen.getByLabelText("Nome do setor"), "Pátio");
    await userEvent.click(screen.getByRole("radio", { name: "Verde" }));
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));
    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Setor criado."),
    );

    rerender(<SectorCreateForm suggestedColor="peach" />);

    expect(screen.getByRole("radio", { name: "Pêssego" })).toBeChecked();
  });

  it("nome vazio mostra o erro sem chamar o servidor", async () => {
    render(<SectorCreateForm suggestedColor="lilac" />);

    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Informe o nome.",
    );
    expect(mocks.createSectorAction).not.toHaveBeenCalled();
  });

  it("nome com 61 caracteres mostra o erro de tamanho", async () => {
    render(<SectorCreateForm suggestedColor="lilac" />);

    await userEvent.click(screen.getByLabelText("Nome do setor"));
    await userEvent.paste("a".repeat(61));
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O nome pode ter no máximo 60 caracteres.",
    );
    expect(mocks.createSectorAction).not.toHaveBeenCalled();
  });

  it("quando o servidor recusa, mostra a mensagem e preserva o nome e a cor escolhidos", async () => {
    mocks.createSectorAction.mockResolvedValue({
      ok: false,
      code: "NAME_TAKEN",
      message: "Já existe um setor com este nome.",
      fieldErrors: { name: "Já existe um setor com este nome." },
    });
    render(<SectorCreateForm suggestedColor="lilac" />);

    await userEvent.type(screen.getByLabelText("Nome do setor"), "ULD");
    await userEvent.click(screen.getByRole("radio", { name: "Azul" }));
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe um setor com este nome.",
    );
    expect(screen.getByLabelText("Nome do setor")).toHaveValue("ULD");
    expect(screen.getByRole("radio", { name: "Azul" })).toBeChecked();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("falha de rede mostra a mensagem genérica e preserva o texto", async () => {
    mocks.createSectorAction.mockRejectedValue(new Error("fetch failed"));
    render(<SectorCreateForm suggestedColor="lilac" />);

    await userEvent.type(screen.getByLabelText("Nome do setor"), "ULD");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir. Tente de novo.",
    );
    expect(screen.getByLabelText("Nome do setor")).toHaveValue("ULD");
  });
});
