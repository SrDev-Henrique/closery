import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { EditDialog } from "./EditDialog";

function setup() {
  render(
    <EditDialog title="Editar setor" name="Almoxarifado">
      {(close) => (
        <div>
          <label htmlFor="campo">Nome do setor</label>
          <input id="campo" defaultValue="Almoxarifado" />
          <button type="button" onClick={close}>
            Salvar alterações
          </button>
        </div>
      )}
    </EditDialog>,
  );
  return screen.getByRole("button", { name: "Editar Almoxarifado" });
}

describe("EditDialog", () => {
  it("o gatilho mostra 'Editar' e se chama 'Editar {nome}'", () => {
    const trigger = setup();

    expect(trigger).toHaveTextContent("Editar");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre o diálogo com título, nome como descrição e o formulário", async () => {
    const trigger = setup();

    await userEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Editar setor" });
    expect(dialog).toHaveAccessibleDescription("Almoxarifado");
    expect(screen.getByLabelText("Nome do setor")).toBeInTheDocument();
  });

  it("move o foco para dentro do diálogo", async () => {
    const trigger = setup();

    await userEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Editar setor" });
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true),
    );
  });

  it("a função recebida fecha o diálogo", async () => {
    const trigger = setup();
    await userEvent.click(trigger);
    await screen.findByRole("dialog", { name: "Editar setor" });

    await userEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("Esc fecha e devolve o foco ao gatilho", async () => {
    const trigger = setup();
    await userEvent.click(trigger);
    await screen.findByRole("dialog", { name: "Editar setor" });

    await userEvent.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("o botão 'Fechar' fecha sem salvar", async () => {
    const trigger = setup();
    await userEvent.click(trigger);
    await screen.findByRole("dialog", { name: "Editar setor" });

    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("ao abrir de novo o formulário volta ao valor salvo", async () => {
    const trigger = setup();
    await userEvent.click(trigger);
    const field = await screen.findByLabelText("Nome do setor");
    await userEvent.clear(field);
    await userEvent.type(field, "Outro nome");
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await userEvent.click(trigger);

    expect(await screen.findByLabelText("Nome do setor")).toHaveValue(
      "Almoxarifado",
    );
  });
});
