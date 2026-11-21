import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail, ok } from "@/features/admin/result";
import { ActiveToggleButton } from "./ActiveToggleButton";

const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ActiveToggleButton", () => {
  it("ativo mostra 'Desativar' com aria-label que cita o nome", async () => {
    const onToggle = vi.fn().mockResolvedValue(ok());
    render(
      <ActiveToggleButton
        entity="Setor"
        name="Almoxarifado"
        active
        onToggle={onToggle}
      />,
    );

    const button = screen.getByRole("button", {
      name: "Desativar Almoxarifado",
    });
    expect(button).toHaveTextContent("Desativar");

    await userEvent.click(button);

    expect(onToggle).toHaveBeenCalledExactlyOnceWith(false);
    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith("Setor desativado."),
    );
  });

  it("inativo mostra 'Reativar' e pede o estado ativo", async () => {
    const onToggle = vi.fn().mockResolvedValue(ok());
    render(
      <ActiveToggleButton
        entity="Turno"
        name="Turno Manhã"
        active={false}
        onToggle={onToggle}
      />,
    );

    const button = screen.getByRole("button", { name: "Reativar Turno Manhã" });
    expect(button).toHaveTextContent("Reativar");

    await userEvent.click(button);

    expect(onToggle).toHaveBeenCalledExactlyOnceWith(true);
    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith("Turno reativado."),
    );
  });

  it.each([
    ["Item", "Item desativado."],
    ["Destino", "Destino desativado."],
  ] as const)("o toast de %s diz '%s'", async (entity, message) => {
    render(
      <ActiveToggleButton
        entity={entity}
        name="X"
        active
        onToggle={vi.fn().mockResolvedValue(ok())}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Desativar X" }));

    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(message));
  });

  it("falha mostra a mensagem em toast de erro e não celebra", async () => {
    const onToggle = vi
      .fn()
      .mockResolvedValue(
        fail(
          "SECTOR_IN_USE",
          "Este setor tem 1 pessoa ativa. Mova ou desative antes.",
        ),
      );
    render(
      <ActiveToggleButton
        entity="Setor"
        name="ULD"
        active
        onToggle={onToggle}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Desativar ULD" }),
    );

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        "Este setor tem 1 pessoa ativa. Mova ou desative antes.",
      ),
    );
    expect(mocks.success).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Desativar ULD" })).toBeEnabled();
  });

  it("exceção vira toast de erro genérico", async () => {
    render(
      <ActiveToggleButton
        entity="Setor"
        name="ULD"
        active
        onToggle={vi.fn().mockRejectedValue(new Error("boom"))}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Desativar ULD" }),
    );

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        "Não foi possível concluir. Tente de novo.",
      ),
    );
  });

  it("fica travado enquanto a ação roda e não repete no clique duplo", async () => {
    let finish: (value: ReturnType<typeof ok>) => void = () => {};
    const onToggle = vi.fn(
      () =>
        new Promise<ReturnType<typeof ok>>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <ActiveToggleButton
        entity="Setor"
        name="ULD"
        active
        onToggle={onToggle}
      />,
    );

    const button = screen.getByRole("button", { name: "Desativar ULD" });
    await userEvent.click(button);
    await userEvent.click(button);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    finish(ok());
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("funciona pelo teclado", async () => {
    const onToggle = vi.fn().mockResolvedValue(ok());
    render(
      <ActiveToggleButton
        entity="Setor"
        name="ULD"
        active
        onToggle={onToggle}
      />,
    );

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Desativar ULD" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(onToggle).toHaveBeenCalledWith(false));
  });
});
