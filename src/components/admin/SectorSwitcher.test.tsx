import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectorSwitcher } from "./SectorSwitcher";

const uld = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "ULD",
  color: "lilac",
} as const;
const gelo = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Água & Gelo",
  color: "peach",
} as const;
const sectors = [uld, gelo];

describe("SectorSwitcher", () => {
  it("é uma navegação 'Setor' com um link por setor", () => {
    render(
      <SectorSwitcher
        sectors={sectors}
        selectedId={uld.id}
        pathname="/admin/turnos"
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Setor" });
    expect(within(nav).getAllByRole("link")).toHaveLength(2);
    expect(within(nav).getByRole("link", { name: "ULD" })).toHaveAttribute(
      "href",
      `/admin/turnos?setor=${uld.id}`,
    );
  });

  it("marca só o setor escolhido com aria-current", () => {
    render(
      <SectorSwitcher
        sectors={sectors}
        selectedId={gelo.id}
        pathname="/admin/itens"
      />,
    );

    expect(screen.getByRole("link", { name: "Água & Gelo" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "ULD" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "ULD" })).toHaveAttribute(
      "href",
      `/admin/itens?setor=${uld.id}`,
    );
  });

  it("não marca ninguém quando o id escolhido não está na lista", () => {
    render(
      <SectorSwitcher
        sectors={sectors}
        selectedId="inexistente"
        pathname="/admin/turnos"
      />,
    );

    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });
});
