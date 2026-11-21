import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { ItemLine } from "@/features/handovers/types";
import { ItemLineField } from "./ItemLineField";

const LINE: ItemLine = {
  itemId: "a1",
  name: "Rede de proteção",
  unit: "rolo",
  kind: "control",
  quantity: 0,
  note: "",
};

function setup(props: { quantity?: number; note?: string } = {}) {
  const handlers = {
    onQuantityChange: vi.fn(),
    onQuantityCommit: vi.fn(),
    onNoteChange: vi.fn(),
    onNoteCommit: vi.fn(),
  };
  render(
    <TooltipProvider>
      <ul>
        <ItemLineField
          line={LINE}
          quantity={props.quantity ?? 0}
          note={props.note ?? ""}
          {...handlers}
        />
      </ul>
    </TooltipProvider>,
  );
  return handlers;
}

describe("ItemLineField", () => {
  it("mostra o nome, o contador e a unidade", () => {
    setup({ quantity: 3 });

    expect(
      screen.getByText("Rede de proteção", { selector: "span" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Quantidade de Rede de proteção" }),
    ).toHaveValue("3");
    expect(screen.getByText("rolo")).toBeInTheDocument();
  });

  it("a observação começa recolhida atrás de 'Adicionar observação'", async () => {
    setup();

    expect(
      screen.queryByLabelText("Observação de Rede de proteção"),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: "Adicionar observação em Rede de proteção",
      }),
    );

    expect(
      screen.getByLabelText("Observação de Rede de proteção"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Adicionar observação/ }),
    ).not.toBeInTheDocument();
  });

  it("observação já existente abre sozinha", () => {
    setup({ note: "box 4" });

    expect(screen.getByLabelText("Observação de Rede de proteção")).toHaveValue(
      "box 4",
    );
    expect(
      screen.queryByRole("button", { name: /Adicionar observação/ }),
    ).not.toBeInTheDocument();
  });

  it("a observação aceita 200 caracteres, com fonte de 16px", () => {
    setup({ note: "x" });

    const field = screen.getByLabelText("Observação de Rede de proteção");
    expect(field).toHaveAttribute("maxlength", "200");
    expect(field).toHaveClass("text-base");
  });

  it("digitar chama onNoteChange; sair do campo chama onNoteCommit", async () => {
    const { onNoteChange, onNoteCommit } = setup({ note: "a" });

    await userEvent.type(
      screen.getByLabelText("Observação de Rede de proteção"),
      "b",
    );
    expect(onNoteChange).toHaveBeenLastCalledWith("ab");

    await userEvent.tab();
    expect(onNoteCommit).toHaveBeenCalledWith("a");
  });
});
