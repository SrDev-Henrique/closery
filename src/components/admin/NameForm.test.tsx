import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail, ok } from "@/features/admin/result";
import { NameForm } from "./NameForm";

const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function setup(
  props: Partial<Parameters<typeof NameForm>[0]> & {
    onSubmit?: Parameters<typeof NameForm>[0]["onSubmit"];
  } = {},
) {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(ok());
  render(
    <NameForm
      entity="setor"
      initialName=""
      submitLabel="Criar setor"
      successMessage="Setor criado."
      {...props}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit };
}

describe("NameForm", () => {
  it("o rótulo do campo depende da entidade", () => {
    const { unmount } = render(
      <NameForm
        entity="destino"
        initialName=""
        submitLabel="Criar destino"
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Nome do destino")).toBeInTheDocument();
    unmount();

    setup();
    expect(screen.getByLabelText("Nome do setor")).toBeInTheDocument();
  });

  it("começa com o nome inicial e o botão nomeia o resultado", () => {
    setup({ initialName: "Almoxarifado", submitLabel: "Salvar alterações" });

    expect(screen.getByLabelText("Nome do setor")).toHaveValue("Almoxarifado");
    expect(
      screen.getByRole("button", { name: "Salvar alterações" }),
    ).toBeEnabled();
  });

  it("envia o nome sem espaços sobrando, avisa com toast e limpa só no sucesso", async () => {
    const onDone = vi.fn();
    const { onSubmit } = setup({ onDone });

    await userEvent.type(
      screen.getByLabelText("Nome do setor"),
      "  Rede   de proteção ",
    );
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith("Rede de proteção");
    await waitFor(() =>
      expect(screen.getByLabelText("Nome do setor")).toHaveValue(""),
    );
    expect(mocks.success).toHaveBeenCalledWith("Setor criado.");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("Enter no campo envia o formulário", async () => {
    const { onSubmit } = setup();

    await userEvent.type(screen.getByLabelText("Nome do setor"), "ULD{Enter}");

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("ULD"));
  });

  it("nome vazio ou só espaços mostra o erro e nem chama o servidor", async () => {
    const { onSubmit } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Informe o nome.",
    );

    await userEvent.type(screen.getByLabelText("Nome do setor"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Informe o nome.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("nome com 61 caracteres é recusado no cliente, com 60 passa", async () => {
    const { onSubmit } = setup();
    const field = screen.getByLabelText("Nome do setor");

    await userEvent.click(field);
    await userEvent.paste("a".repeat(61));
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O nome pode ter no máximo 60 caracteres.",
    );
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.type(field, "{Backspace}");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("quando o servidor recusa mantém o que foi digitado e mostra o erro do campo", async () => {
    const onDone = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(
      fail("NAME_TAKEN", "Já existe um setor com este nome.", {
        name: "Já existe um setor com este nome. Ele está inativo: reative-o na lista.",
      }),
    );
    setup({ onSubmit, onDone });

    await userEvent.type(screen.getByLabelText("Nome do setor"), "ULD");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Já existe um setor com este nome. Ele está inativo: reative-o na lista.",
    );
    const field = screen.getByLabelText("Nome do setor");
    expect(field).toHaveValue("ULD");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAttribute("aria-describedby", alert.id);
    expect(mocks.success).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Criar setor" })).toBeEnabled();
  });

  it("falha sem erro de campo mostra a mensagem geral e mantém o texto", async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValue(
        fail("NOT_FOUND", "Setor não encontrado. Atualize a página."),
      );
    setup({ onSubmit });

    await userEvent.type(screen.getByLabelText("Nome do setor"), "ULD");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Setor não encontrado. Atualize a página.",
    );
    expect(screen.getByLabelText("Nome do setor")).toHaveValue("ULD");
  });

  it("exceção do servidor vira a mensagem genérica e mantém o texto", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("rede caiu"));
    setup({ onSubmit });

    await userEvent.type(screen.getByLabelText("Nome do setor"), "ULD");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir. Tente de novo.",
    );
    expect(screen.getByLabelText("Nome do setor")).toHaveValue("ULD");
    expect(screen.queryByText("rede caiu")).not.toBeInTheDocument();
  });

  it("o erro some quando a pessoa volta a digitar", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));
    await screen.findByRole("alert");

    await userEvent.type(screen.getByLabelText("Nome do setor"), "U");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nome do setor")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("trava o botão enquanto envia e não envia duas vezes", async () => {
    let finish: (value: ReturnType<typeof ok>) => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<ReturnType<typeof ok>>((resolve) => {
          finish = resolve;
        }),
    );
    setup({ onSubmit });

    await userEvent.type(screen.getByLabelText("Nome do setor"), "ULD");
    const button = screen.getByRole("button", { name: "Criar setor" });
    await userEvent.click(button);
    await userEvent.click(button);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    finish(ok());
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("sem successMessage não mostra toast de sucesso", async () => {
    const { onSubmit } = setup({ successMessage: undefined });

    await userEvent.type(screen.getByLabelText("Nome do setor"), "ULD");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(mocks.success).not.toHaveBeenCalled();
  });
});
