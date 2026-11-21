import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SummaryItem } from "@/features/handovers/summary";
import { SummaryItemList } from "./SummaryItemList";

function line(overrides: Partial<SummaryItem> = {}): SummaryItem {
  return {
    itemId: "item-1",
    name: "Rede de proteção",
    unit: "unidade",
    kind: "control",
    quantity: 3,
    note: null,
    ...overrides,
  };
}

describe("SummaryItemList", () => {
  it("lista título, nome e quantidade com a unidade", () => {
    render(<SummaryItemList title="Controles" items={[line()]} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Controles" }),
    ).toBeInTheDocument();
    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Rede de proteção")).toBeInTheDocument();
    expect(within(row).getByText("3 unidade")).toBeInTheDocument();
  });

  it("formata milhar em pt-BR e alinha o número com tabular-nums", () => {
    render(
      <SummaryItemList
        title="Estoque"
        items={[line({ quantity: 1234, unit: "rolo" })]}
      />,
    );

    const value = screen.getByText("1.234 rolo");
    expect(value).toHaveClass("tabular-nums");
  });

  it("mostra a observação abaixo do item", () => {
    render(
      <SummaryItemList
        title="Controles"
        items={[line({ quantity: 0, note: "Faltou fita" })]}
      />,
    );

    expect(screen.getByText("Faltou fita")).toBeInTheDocument();
    expect(screen.getByText("0 unidade")).toBeInTheDocument();
  });

  it("não escreve nada quando não há itens", () => {
    const { container } = render(
      <SummaryItemList title="Controles" items={[]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("mantém a ordem recebida", () => {
    render(
      <SummaryItemList
        title="Controles"
        items={[
          line({ itemId: "a", name: "Primeiro" }),
          line({ itemId: "b", name: "Segundo" }),
        ]}
      />,
    );

    const names = screen
      .getAllByRole("listitem")
      .map(
        (row) => within(row).getAllByText(/Primeiro|Segundo/)[0]?.textContent,
      );
    expect(names).toEqual(["Primeiro", "Segundo"]);
  });
});
