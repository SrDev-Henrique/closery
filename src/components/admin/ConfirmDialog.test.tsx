import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { fail, ok } from "@/features/admin/result";
import { ConfirmDialog } from "./ConfirmDialog";

function setup(
  onConfirm: Parameters<typeof ConfirmDialog>[0]["onConfirm"],
  props: { cancelLabel?: string; destructive?: boolean } = {},
) {
  render(
    <ConfirmDialog
      trigger={<Button variant="outline">Desativar Ana</Button>}
      title="Desativar Ana?"
      description="A pessoa perde o acesso agora."
      confirmLabel="Desativar"
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return screen.getByRole("button", { name: "Desativar Ana" });
}

async function openDialog(trigger: HTMLElement) {
  await userEvent.click(trigger);
  return screen.findByRole("dialog", { name: "Desativar Ana?" });
}

describe("ConfirmDialog", () => {
  it("o gatilho abre o diálogo com título, descrição e os dois botões", async () => {
    const trigger = setup(vi.fn());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const dialog = await openDialog(trigger);

    expect(dialog).toHaveAccessibleDescription(
      "A pessoa perde o acesso agora.",
    );
    expect(screen.getByRole("button", { name: "Desativar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeEnabled();
  });

  it("'Voltar' fecha sem chamar a ação", async () => {
    const onConfirm = vi.fn();
    const trigger = setup(onConfirm);
    await openDialog(trigger);

    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("aceita outro rótulo para o botão que desiste", async () => {
    const trigger = setup(vi.fn(), { cancelLabel: "Manter convite" });
    await openDialog(trigger);

    expect(
      screen.getByRole("button", { name: "Manter convite" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Voltar" }),
    ).not.toBeInTheDocument();
  });

  it("sucesso chama a ação uma vez e fecha o diálogo", async () => {
    const onConfirm = vi.fn().mockResolvedValue(ok());
    const trigger = setup(onConfirm);
    await openDialog(trigger);

    await userEvent.click(screen.getByRole("button", { name: "Desativar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("falha mostra a mensagem no diálogo e NÃO fecha", async () => {
    const onConfirm = vi
      .fn()
      .mockResolvedValue(
        fail(
          "LAST_ADMIN",
          "Este é o último administrador ativo. Nomeie outro antes.",
        ),
      );
    const trigger = setup(onConfirm);
    const dialog = await openDialog(trigger);

    await userEvent.click(screen.getByRole("button", { name: "Desativar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este é o último administrador ativo. Nomeie outro antes.",
    );
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desativar" })).toBeEnabled();
  });

  it("exceção (rede, servidor) vira a mensagem genérica e não fecha", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("boom"));
    const trigger = setup(onConfirm);
    await openDialog(trigger);

    await userEvent.click(screen.getByRole("button", { name: "Desativar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir. Tente de novo.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
  });

  it("depois de uma falha dá para tentar de novo e fechar no sucesso", async () => {
    const onConfirm = vi
      .fn()
      .mockResolvedValueOnce(
        fail("INTERNAL", "Não foi possível concluir. Tente de novo."),
      )
      .mockResolvedValueOnce(ok());
    const trigger = setup(onConfirm);
    await openDialog(trigger);

    await userEvent.click(screen.getByRole("button", { name: "Desativar" }));
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Desativar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("enquanto a ação roda os botões ficam travados e o clique duplo não repete", async () => {
    let finish: (value: ReturnType<typeof ok>) => void = () => {};
    const onConfirm = vi.fn(
      () =>
        new Promise<ReturnType<typeof ok>>((resolve) => {
          finish = resolve;
        }),
    );
    const trigger = setup(onConfirm);
    await openDialog(trigger);

    const confirm = screen.getByRole("button", { name: "Desativar" });
    await userEvent.click(confirm);
    await userEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();

    finish(ok());
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("ao reabrir, a mensagem de erro anterior não aparece", async () => {
    const onConfirm = vi
      .fn()
      .mockResolvedValue(fail("INTERNAL", "Erro antigo."));
    const trigger = setup(onConfirm);
    await openDialog(trigger);
    await userEvent.click(screen.getByRole("button", { name: "Desativar" }));
    await screen.findByText("Erro antigo.");
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await openDialog(trigger);

    expect(screen.queryByText("Erro antigo.")).not.toBeInTheDocument();
  });

  it("Esc fecha sem agir", async () => {
    const onConfirm = vi.fn();
    const trigger = setup(onConfirm);
    await openDialog(trigger);

    await userEvent.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
