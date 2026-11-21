import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { MoveButtons } from "./MoveButtons";

function setup(props: Partial<Parameters<typeof MoveButtons>[0]> = {}) {
  const onMove = vi.fn();
  render(
    <TooltipProvider>
      <MoveButtons
        label="Turno Manhã"
        canMoveUp
        canMoveDown
        onMove={onMove}
        {...props}
      />
    </TooltipProvider>,
  );
  return { onMove };
}

function hover(element: HTMLElement) {
  fireEvent.pointerEnter(element, { pointerType: "mouse" });
  fireEvent.mouseEnter(element);
  fireEvent.pointerMove(element, { pointerType: "mouse" });
  fireEvent.mouseMove(element);
}

describe("MoveButtons", () => {
  it("tem dois botões com aria-label que citam o item", () => {
    setup();

    expect(
      screen.getByRole("button", { name: "Subir Turno Manhã" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Descer Turno Manhã" }),
    ).toBeEnabled();
  });

  it("clicar chama onMove com a direção", async () => {
    const { onMove } = setup();

    await userEvent.click(
      screen.getByRole("button", { name: "Subir Turno Manhã" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Descer Turno Manhã" }),
    );

    expect(onMove).toHaveBeenNthCalledWith(1, "up");
    expect(onMove).toHaveBeenNthCalledWith(2, "down");
  });

  it("funciona pelo teclado (Tab e Enter)", async () => {
    const { onMove } = setup();

    await userEvent.tab();
    expect(
      screen.getByRole("button", { name: "Subir Turno Manhã" }),
    ).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await userEvent.tab();
    expect(
      screen.getByRole("button", { name: "Descer Turno Manhã" }),
    ).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(onMove).toHaveBeenNthCalledWith(1, "up");
    expect(onMove).toHaveBeenNthCalledWith(2, "down");
  });

  it("o primeiro item não sobe", async () => {
    const { onMove } = setup({ canMoveUp: false });
    const up = screen.getByRole("button", { name: "Subir Turno Manhã" });

    expect(up).toBeDisabled();
    await userEvent.click(up);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("o último item não desce", async () => {
    const { onMove } = setup({ canMoveDown: false });
    const down = screen.getByRole("button", { name: "Descer Turno Manhã" });

    expect(down).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Subir Turno Manhã" }),
    ).toBeEnabled();
    await userEvent.click(down);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("pendente desabilita os dois botões", () => {
    setup({ pending: true });

    expect(
      screen.getByRole("button", { name: "Subir Turno Manhã" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Descer Turno Manhã" }),
    ).toBeDisabled();
  });

  it("mostra o tooltip 'Subir' e 'Descer' ao passar o mouse", async () => {
    setup();
    expect(screen.queryByText("Subir")).not.toBeInTheDocument();

    hover(screen.getByRole("button", { name: "Subir Turno Manhã" }));
    await waitFor(() => expect(screen.getByText("Subir")).toBeInTheDocument());

    hover(screen.getByRole("button", { name: "Descer Turno Manhã" }));
    await waitFor(() => expect(screen.getByText("Descer")).toBeInTheDocument());
  });
});
