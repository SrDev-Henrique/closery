import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renderiza o rótulo como botão acessível", () => {
    render(<Button>Entregar turno</Button>);
    expect(
      screen.getByRole("button", { name: "Entregar turno" }),
    ).toBeInTheDocument();
  });

  it("dispara onClick ao clicar", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salvar</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("desabilitado não dispara onClick", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Salvar
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
