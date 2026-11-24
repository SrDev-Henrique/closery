import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MoveStatusButton } from "./MoveStatusButton";

describe("MoveStatusButton", () => {
  it.each([
    ["in_transit", "Mover para Em separação / Trânsito", "bg-warning"],
    ["delivered", "Mover para Entregue", "bg-success"],
    ["requested", "Mover para Solicitada", "bg-info"],
  ] as const)("destino %s: texto e cor do status de destino", (to, name, token) => {
    render(<MoveStatusButton to={to} onClick={() => {}} />);

    const button = screen.getByRole("button", { name });
    expect(button.className).toContain(token);
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("clicar chama onClick uma vez", async () => {
    const onClick = vi.fn();
    render(<MoveStatusButton to="delivered" onClick={onClick} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Mover para Entregue" }),
    );

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("desativado não chama onClick", async () => {
    const onClick = vi.fn();
    render(<MoveStatusButton to="delivered" onClick={onClick} disabled />);

    const button = screen.getByRole("button", { name: "Mover para Entregue" });
    expect(button).toBeDisabled();
    await userEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });
});
