import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RequestViewSwitcher } from "./RequestViewSwitcher";

const HREFS = {
  board: "/solicitacoes?visao=quadro",
  list: "/solicitacoes?visao=lista",
  table: "/solicitacoes?visao=tabela",
};

describe("RequestViewSwitcher", () => {
  it("é a navegação Visão com três links para as três visões", () => {
    render(<RequestViewSwitcher current="board" hrefs={HREFS} />);

    const nav = screen.getByRole("navigation", { name: "Visão" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Quadro", HREFS.board],
      ["Lista", HREFS.list],
      ["Tabela", HREFS.table],
    ]);
  });

  it.each([
    ["board", "Quadro"],
    ["list", "Lista"],
    ["table", "Tabela"],
  ] as const)("a visão %s é a única com aria-current", (current, name) => {
    render(<RequestViewSwitcher current={current} hrefs={HREFS} />);

    expect(screen.getByRole("link", { name })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen
        .getAllByRole("link")
        .filter((link) => link.hasAttribute("aria-current")),
    ).toHaveLength(1);
  });

  it("aceita classe de fora (a tela usa para mostrar um por largura)", () => {
    render(
      <RequestViewSwitcher
        current="list"
        hrefs={HREFS}
        className="md:hidden"
      />,
    );

    expect(screen.getByRole("navigation", { name: "Visão" })).toHaveClass(
      "md:hidden",
    );
  });

  it("os links são navegação com cara de botão (alvo de toque de 44px no celular)", () => {
    render(<RequestViewSwitcher current="board" hrefs={HREFS} />);

    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toContain("max-md:h-11");
    }
  });
});
