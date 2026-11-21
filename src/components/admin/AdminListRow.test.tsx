import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminListRow } from "./AdminListRow";

function renderRow(props: Parameters<typeof AdminListRow>[0]) {
  return render(
    <ul>
      <AdminListRow {...props} />
    </ul>,
  );
}

describe("AdminListRow", () => {
  it("é um item de lista com título, subtítulo, selos, avisos e ações", () => {
    renderRow({
      title: "Turno Manhã",
      subtitle: "06:00–14:00",
      badges: <span>Atravessa a meia-noite</span>,
      notes: <p>Sobrepõe o turno Tarde (13:00–21:00)</p>,
      actions: <button type="button">Editar</button>,
    });

    const item = screen.getByRole("listitem");
    expect(within(item).getByText("Turno Manhã")).toBeInTheDocument();
    expect(within(item).getByText("06:00–14:00")).toBeInTheDocument();
    expect(
      within(item).getByText("Atravessa a meia-noite"),
    ).toBeInTheDocument();
    expect(
      within(item).getByText("Sobrepõe o turno Tarde (13:00–21:00)"),
    ).toBeInTheDocument();
    expect(
      within(item).getByRole("button", { name: "Editar" }),
    ).toBeInTheDocument();
  });

  it("ativo não mostra o selo 'Inativo'", () => {
    renderRow({ title: "Almoxarifado" });

    expect(screen.queryByText("Inativo")).not.toBeInTheDocument();
    expect(screen.getByText("Almoxarifado")).not.toHaveClass(
      "text-muted-foreground",
    );
  });

  it("inativo mostra o selo 'Inativo' e esmaece o título", () => {
    renderRow({ title: "Almoxarifado", inactive: true });

    expect(screen.getByText("Inativo")).toBeInTheDocument();
    expect(screen.getByText("Almoxarifado")).toHaveClass(
      "text-muted-foreground",
    );
  });

  it("só com o título não renderiza regiões vazias", () => {
    renderRow({ title: "Almoxarifado" });

    expect(screen.getByRole("listitem").textContent).toBe("Almoxarifado");
  });
});
