import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ITEM_FORM_DEFAULTS } from "@/features/admin/itemOptions";
import { ItemForm } from "./ItemForm";

const SECTOR_ID = "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b";
const ITEM_ID = "7a2e3b4c-5d6e-4f70-8b9c-1d2e3f4a5b6c";

const mocks = vi.hoisted(() => ({
  createItemAction: vi.fn(),
  updateItemAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/itens/actions", () => ({
  createItemAction: mocks.createItemAction,
  updateItemAction: mocks.updateItemAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

function setup(props: Partial<ComponentProps<typeof ItemForm>> = {}) {
  const onDone = vi.fn();
  render(
    <ItemForm
      sectorId={SECTOR_ID}
      initial={ITEM_FORM_DEFAULTS}
      submitLabel="Criar item"
      onDone={onDone}
      {...props}
    />,
  );
  return { onDone };
}

const nameField = () => screen.getByLabelText("Nome do item");
const unitField = () => screen.getByLabelText("Unidade");
const submit = () => screen.getByRole("button", { name: "Criar item" });

describe("ItemForm", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("começa com os padrões: Unidade 'Unidade' e tipo Controle com a ajuda", () => {
    setup();
    expect(nameField()).toHaveValue("");
    expect(unitField()).toHaveValue("unidade");
    expect(screen.queryByLabelText("Outra unidade")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Controle" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByText("Controle: soma no período, como redes danificadas."),
    ).toBeInTheDocument();
  });

  it("oferece as unidades da lista e 'Outro…'", () => {
    setup();
    const labels = Array.from(
      unitField().querySelectorAll("option"),
      (option) => option.textContent,
    );
    expect(labels).toEqual([
      "Unidade",
      "Rolo",
      "Par",
      "Pacote",
      "Caixa",
      "Saco",
      "Metro",
      "kg",
      "Outro…",
    ]);
  });

  it("escolher Estoque troca a ajuda; clicar de novo no selecionado não desmarca", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Estoque" }));
    expect(
      screen.getByText("Estoque: vale a última contagem, nunca a soma."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Estoque" }));
    expect(screen.getByRole("button", { name: "Estoque" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("criar com unidade da lista envia as escolhas e avisa 'Item criado.'", async () => {
    mocks.createItemAction.mockResolvedValue({ ok: true, id: "x" });
    const { onDone } = setup();

    await userEvent.type(nameField(), "Rede de proteção");
    await userEvent.selectOptions(unitField(), "rolo");
    await userEvent.click(screen.getByRole("button", { name: "Estoque" }));
    await userEvent.click(submit());

    await waitFor(() =>
      expect(mocks.createItemAction).toHaveBeenCalledWith({
        sectorId: SECTOR_ID,
        name: "Rede de proteção",
        unitChoice: "rolo",
        unitOther: "",
        kind: "stock",
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Item criado.");
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("'Outro…' mostra o campo 'Outra unidade' e envia o texto", async () => {
    mocks.createItemAction.mockResolvedValue({ ok: true, id: "x" });
    setup();

    await userEvent.type(nameField(), "Folha");
    await userEvent.selectOptions(unitField(), "outro");
    await userEvent.type(
      screen.getByLabelText("Outra unidade"),
      "folha grande",
    );
    await userEvent.click(submit());

    await waitFor(() =>
      expect(mocks.createItemAction).toHaveBeenCalledWith({
        sectorId: SECTOR_ID,
        name: "Folha",
        unitChoice: "outro",
        unitOther: "folha grande",
        kind: "control",
      }),
    );
  });

  it("voltar para uma unidade da lista esconde 'Outra unidade'", async () => {
    setup();
    await userEvent.selectOptions(unitField(), "outro");
    expect(screen.getByLabelText("Outra unidade")).toBeInTheDocument();
    await userEvent.selectOptions(unitField(), "kg");
    expect(screen.queryByLabelText("Outra unidade")).not.toBeInTheDocument();
  });

  it("nome vazio: erro no campo, sem chamar a action", async () => {
    setup();
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Informe o nome.",
    );
    expect(nameField()).toHaveAttribute("aria-invalid", "true");
    expect(mocks.createItemAction).not.toHaveBeenCalled();
  });

  it("'Outro…' vazio: erro em 'Outra unidade', sem chamar a action", async () => {
    setup();
    await userEvent.type(nameField(), "Folha");
    await userEvent.selectOptions(unitField(), "outro");
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Informe a unidade.",
    );
    expect(screen.getByLabelText("Outra unidade")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(mocks.createItemAction).not.toHaveBeenCalled();
  });

  it("'Outro…' com 21 caracteres: erro de tamanho", async () => {
    setup();
    await userEvent.type(nameField(), "Folha");
    await userEvent.selectOptions(unitField(), "outro");
    await userEvent.type(
      screen.getByLabelText("Outra unidade"),
      "x".repeat(21),
    );
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A unidade pode ter no máximo 20 caracteres.",
    );
    expect(mocks.createItemAction).not.toHaveBeenCalled();
  });

  it("recusa do servidor: mostra o erro e preserva o digitado", async () => {
    mocks.createItemAction.mockResolvedValue({
      ok: false,
      code: "NAME_TAKEN",
      message: "Já existe um item com este nome neste setor.",
      fieldErrors: { name: "Já existe um item com este nome neste setor." },
    });
    const { onDone } = setup();
    await userEvent.type(nameField(), "Rede");
    await userEvent.selectOptions(unitField(), "caixa");
    await userEvent.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe um item com este nome neste setor.",
    );
    expect(nameField()).toHaveValue("Rede");
    expect(unitField()).toHaveValue("caixa");
    expect(onDone).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("erro sem campo (setor inativo) aparece no formulário", async () => {
    mocks.createItemAction.mockResolvedValue({
      ok: false,
      code: "SECTOR_INACTIVE",
      message: "Este setor está inativo. Reative-o para cadastrar itens.",
    });
    setup();
    await userEvent.type(nameField(), "Rede");
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este setor está inativo. Reative-o para cadastrar itens.",
    );
  });

  it("falha de rede vira a mensagem genérica", async () => {
    mocks.createItemAction.mockRejectedValue(new Error("fetch failed"));
    setup();
    await userEvent.type(nameField(), "Rede");
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir. Tente de novo.",
    );
  });

  it("editar com unidade fora da lista abre em 'Outro…' com o texto", async () => {
    mocks.updateItemAction.mockResolvedValue({ ok: true });
    const { onDone } = setup({
      initial: {
        id: ITEM_ID,
        name: "Folha",
        unitChoice: "outro",
        unitOther: "folha grande",
        kind: "stock",
      },
      submitLabel: "Salvar alterações",
    });

    expect(unitField()).toHaveValue("outro");
    expect(screen.getByLabelText("Outra unidade")).toHaveValue("folha grande");
    expect(screen.getByRole("button", { name: "Estoque" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    await waitFor(() =>
      expect(mocks.updateItemAction).toHaveBeenCalledWith({
        id: ITEM_ID,
        name: "Folha",
        unitChoice: "outro",
        unitOther: "folha grande",
        kind: "stock",
      }),
    );
    expect(mocks.createItemAction).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Alterações salvas.");
    expect(onDone).toHaveBeenCalledOnce();
  });
});
